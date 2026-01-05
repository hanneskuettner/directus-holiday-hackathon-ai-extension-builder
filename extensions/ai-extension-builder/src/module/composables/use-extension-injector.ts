import { ref } from 'vue';
import { useSfcCompiler } from './use-sfc-compiler';
import { getDirectusApp, getExtensionsFromApp } from '../utils/get-directus-app';
import type { AiExtensionRecord } from '../types';

export function useExtensionInjector() {
  const { compile } = useSfcCompiler();
  const injectedExtensions = ref<Set<string>>(new Set());

  async function injectExtension(ext: AiExtensionRecord): Promise<boolean> {
    const app = getDirectusApp();
    if (!app) {
      console.error('[AI Extension Builder] Could not access Vue app');
      return false;
    }

    const extensions = getExtensionsFromApp();
    if (!extensions) {
      console.error('[AI Extension Builder] Could not access extensions registry');
      return false;
    }

    const { component, error } = await compile(ext.files, ext.entry, ext.slug);
    if (error || !component) {
      console.error(`Failed to compile extension ${ext.slug}:`, error);
      return false;
    }

    // Register Vue component
    app.component(`interface-${ext.slug}`, component);

    // Add to extensions registry (assign new array to trigger shallowRef reactivity)
    extensions.interfaces.value = [
      ...extensions.interfaces.value,
      {
        id: ext.slug,
        name: ext.name,
        icon: ext.icon,
        description: ext.description,
        component,
        types: ext.extension_config.types,
        group: ext.extension_config.group,
        options: ext.extension_config.options,
      },
    ];

    injectedExtensions.value.add(ext.slug);
    console.log(`[AI Extension Builder] Injected interface: ${ext.slug}`);
    return true;
  }

  async function removeExtension(slug: string): Promise<boolean> {
    const extensions = getExtensionsFromApp();
    if (!extensions) return false;

    const idx = extensions.interfaces.value.findIndex(
      (i: { id: string }) => i.id === slug
    );
    if (idx !== -1) {
      extensions.interfaces.value = extensions.interfaces.value.filter(
        (_, i) => i !== idx
      );
    }

    injectedExtensions.value.delete(slug);
    return true;
  }

  return {
    injectExtension,
    removeExtension,
    injectedExtensions,
  };
}
