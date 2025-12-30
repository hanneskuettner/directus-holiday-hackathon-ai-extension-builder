import * as extensionsSdk from '@directus/extensions-sdk';
import { ref, shallowRef } from 'vue';
import * as Vue from 'vue';

// Type for vue3-sfc-loader - loaded dynamically
interface SfcLoaderOptions {
  moduleCache: Record<string, unknown>;
  getFile: (url: string) => string | Promise<string>;
  addStyle: (css: string) => void;
}

interface AiExtensionFiles {
  [path: string]: string;
}

interface CompileResult {
  component: object | null;
  error: Error | null;
}

// Style registry to prevent CSS orphaning
const styleRegistry = new Map<string, HTMLStyleElement>();

function injectStyle(css: string, extSlug: string): void {
  // Remove old styles for this extension
  styleRegistry.get(extSlug)?.remove();

  const style = document.createElement('style');
  style.textContent = css;
  style.dataset.aiExtension = extSlug;
  document.head.appendChild(style);
  styleRegistry.set(extSlug, style);
}

function removeStyles(extSlug: string): void {
  styleRegistry.get(extSlug)?.remove();
  styleRegistry.delete(extSlug);
}

export function useSfcCompiler() {
  const isCompiling = ref(false);
  const lastError = ref<Error | null>(null);
  const compiledComponent = shallowRef<object | null>(null);

  let sfcLoader: { loadModule: (url: string, options: SfcLoaderOptions) => Promise<object> } | null = null;

  async function loadSfcLoader() {
    if (sfcLoader) return sfcLoader;

    // Dynamic import of vue3-sfc-loader
    const module = await import('vue3-sfc-loader');
    sfcLoader = module;
    return sfcLoader;
  }

  async function compile(
    files: AiExtensionFiles,
    entry: string,
    slug: string
  ): Promise<CompileResult> {
    isCompiling.value = true;
    lastError.value = null;

    try {
      const loader = await loadSfcLoader();

      const component = await loader.loadModule(`/${entry}`, {
        moduleCache: {
          vue: Vue,
          '@directus/extensions-sdk': extensionsSdk,
        },
        getFile(url: string) {
          const path = url.replace(/^\//, '');
          const content = files[path];
          if (!content) {
            throw new Error(`File not found: ${path}`);
          }
          return content;
        },
        addStyle(css: string) {
          injectStyle(css, slug);
        },
      });

      compiledComponent.value = component;
      return { component, error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError.value = error;
      compiledComponent.value = null;
      return { component: null, error };
    } finally {
      isCompiling.value = false;
    }
  }

  function cleanup(slug: string) {
    removeStyles(slug);
    compiledComponent.value = null;
  }

  return {
    compile,
    cleanup,
    isCompiling,
    lastError,
    compiledComponent,
  };
}
