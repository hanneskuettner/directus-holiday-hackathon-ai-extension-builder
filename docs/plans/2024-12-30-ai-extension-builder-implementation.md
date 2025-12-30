# AI Extension Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Directus module that generates custom interfaces via chat, compiles them in-browser, and injects them at runtime.

**Architecture:** Chat UI → AI generates Vue SFC → vue3-sfc-loader compiles → Preview via `<component :is>` → Publish injects to running app via `app.component()` + extensions store mutation.

**Tech Stack:** Vue 3, vue3-sfc-loader, Directus Extensions SDK, TypeScript

---

## Task 1: Create Extension Bundle Structure

**Files:**
- Create: `extensions/ai-extension-builder/package.json`
- Create: `extensions/ai-extension-builder/tsconfig.json`

**Step 1: Create package.json**

```json
{
  "name": "ai-extension-builder",
  "type": "module",
  "version": "1.0.0",
  "keywords": [
    "directus",
    "directus-extension",
    "directus-extension-bundle"
  ],
  "directus:extension": {
    "type": "bundle",
    "path": {
      "app": "dist/app.js",
      "api": "dist/api.js"
    },
    "entries": [
      {
        "type": "module",
        "name": "ai-extension-builder",
        "source": "src/module/index.ts"
      }
    ],
    "host": "^10.0.0 || ^11.0.0"
  },
  "scripts": {
    "build": "directus-extension build",
    "dev": "directus-extension build -w --no-minify"
  },
  "dependencies": {
    "vue3-sfc-loader": "^0.9.5"
  },
  "devDependencies": {
    "@directus/extensions-sdk": "17.0.4",
    "typescript": "5.6.3",
    "vue": "3.5.24"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Install dependencies**

Run: `cd extensions/ai-extension-builder && pnpm install`
Expected: Dependencies installed successfully

**Step 4: Commit**

```bash
git add extensions/ai-extension-builder/package.json extensions/ai-extension-builder/tsconfig.json
git commit -m "feat: scaffold ai-extension-builder bundle"
```

---

## Task 2: Create Module Entry Point

**Files:**
- Create: `extensions/ai-extension-builder/src/module/index.ts`
- Create: `extensions/ai-extension-builder/src/module/routes.ts`

**Step 1: Create module index.ts**

```typescript
import { defineModule } from '@directus/extensions-sdk';
import ModuleComponent from './routes';

export default defineModule({
  id: 'ai-extension-builder',
  name: 'AI Extension Builder',
  icon: 'auto_fix_high',
  routes: [
    {
      path: '',
      component: ModuleComponent,
    },
  ],
  // preRegisterCheck added in Task 13
});
```

**Step 2: Create routes.ts with placeholder**

```typescript
import { defineComponent, h } from 'vue';

export default defineComponent({
  name: 'AiExtensionBuilder',
  setup() {
    return () => h('div', { class: 'ai-extension-builder' }, 'AI Extension Builder - Loading...');
  },
});
```

**Step 3: Build and verify**

Run: `cd extensions/ai-extension-builder && pnpm build`
Expected: Build succeeds, dist/app.js created

**Step 4: Commit**

```bash
git add extensions/ai-extension-builder/src/module/
git commit -m "feat: add module entry point"
```

---

## Task 3: Create BuilderView Layout

**Files:**
- Create: `extensions/ai-extension-builder/src/module/views/BuilderView.vue`
- Modify: `extensions/ai-extension-builder/src/module/routes.ts`

**Step 1: Create BuilderView.vue with split-pane layout**

```vue
<template>
  <private-view title="AI Extension Builder">
    <template #title-outer:prepend>
      <v-button class="header-icon" rounded disabled icon secondary>
        <v-icon name="auto_fix_high" />
      </v-button>
    </template>

    <template #actions>
      <v-button
        v-tooltip.bottom="'Publish Extension'"
        rounded
        icon
        :disabled="!canPublish"
        @click="onPublish"
      >
        <v-icon name="publish" />
      </v-button>
    </template>

    <div class="builder-container">
      <div class="chat-section">
        <ChatPanel
          v-model:messages="messages"
          :loading="isGenerating"
          @send="onSendMessage"
        />
      </div>

      <div class="preview-section">
        <PreviewControls
          v-model:collection="selectedCollection"
          v-model:item="selectedItem"
          v-model:field="selectedField"
        />
        <PreviewPanel
          :component="previewComponent"
          :props="previewProps"
          :error="previewError"
        />
      </div>
    </div>
  </private-view>
</template>

<script setup lang="ts">
import { ref, computed, shallowRef } from 'vue';
import ChatPanel from '../components/ChatPanel.vue';
import PreviewPanel from '../components/PreviewPanel.vue';
import PreviewControls from '../components/PreviewControls.vue';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const messages = ref<ChatMessage[]>([]);
const isGenerating = ref(false);
const previewComponent = shallowRef<object | null>(null);
const previewError = ref<Error | null>(null);

const selectedCollection = ref<string | null>(null);
const selectedItem = ref<string | null>(null);
const selectedField = ref<string | null>(null);

const previewProps = computed(() => ({
  value: null, // TODO: fetch actual field value
  collection: selectedCollection.value,
  field: selectedField.value,
  primaryKey: selectedItem.value,
}));

const canPublish = computed(() => previewComponent.value !== null && !previewError.value);

async function onSendMessage(content: string) {
  messages.value.push({ role: 'user', content });
  isGenerating.value = true;
  // TODO: implement AI generation
  isGenerating.value = false;
}

async function onPublish() {
  // TODO: implement publish flow
}
</script>

<style scoped>
.builder-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--content-padding);
  height: calc(100vh - var(--header-bar-height) - 2 * var(--content-padding));
  padding: var(--content-padding);
}

.chat-section,
.preview-section {
  display: flex;
  flex-direction: column;
  gap: var(--content-padding);
  overflow: hidden;
}

.header-icon {
  --v-button-background-color: var(--theme--primary-background);
  --v-button-color: var(--theme--primary);
}
</style>
```

**Step 2: Update routes.ts to use BuilderView**

```typescript
import BuilderView from './views/BuilderView.vue';

export default BuilderView;
```

**Step 3: Build and verify**

Run: `cd extensions/ai-extension-builder && pnpm build`
Expected: Build succeeds (will have import errors for missing components - that's expected)

**Step 4: Commit**

```bash
git add extensions/ai-extension-builder/src/module/
git commit -m "feat: add BuilderView with split-pane layout"
```

---

## Task 4: Create ChatPanel Component

**Files:**
- Create: `extensions/ai-extension-builder/src/module/components/ChatPanel.vue`

**Step 1: Create ChatPanel.vue**

```vue
<template>
  <div class="chat-panel">
    <div class="messages" ref="messagesContainer">
      <div
        v-for="(message, index) in messages"
        :key="index"
        :class="['message', message.role]"
      >
        <div class="message-content">
          {{ message.content }}
        </div>
      </div>

      <div v-if="loading" class="message assistant">
        <div class="message-content">
          <v-progress-circular indeterminate small />
          Generating...
        </div>
      </div>
    </div>

    <div class="input-area">
      <v-textarea
        v-model="inputText"
        :placeholder="placeholder"
        :disabled="loading"
        @keydown.enter.ctrl="onSend"
      />
      <v-button
        :disabled="!inputText.trim() || loading"
        @click="onSend"
      >
        <v-icon name="send" />
        Send
      </v-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

defineProps<{
  messages: ChatMessage[];
  loading: boolean;
}>();

const emit = defineEmits<{
  send: [content: string];
}>();

const inputText = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const placeholder = 'Describe the interface you want to create... (Ctrl+Enter to send)';

function onSend() {
  const content = inputText.value.trim();
  if (!content) return;

  emit('send', content);
  inputText.value = '';
}

watch(() => messagesContainer.value?.scrollHeight, () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
});
</script>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--theme--background);
  border: var(--theme--border-width) solid var(--theme--border-color);
  border-radius: var(--theme--border-radius);
  overflow: hidden;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--content-padding);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message {
  max-width: 80%;
  padding: 12px 16px;
  border-radius: var(--theme--border-radius);
}

.message.user {
  align-self: flex-end;
  background: var(--theme--primary);
  color: var(--theme--primary-foreground, white);
}

.message.assistant {
  align-self: flex-start;
  background: var(--theme--background-subdued);
}

.message-content {
  white-space: pre-wrap;
  word-break: break-word;
}

.input-area {
  display: flex;
  gap: 8px;
  padding: var(--content-padding);
  border-top: var(--theme--border-width) solid var(--theme--border-color);
}

.input-area :deep(.v-textarea) {
  flex: 1;
}
</style>
```

**Step 2: Build and verify**

Run: `cd extensions/ai-extension-builder && pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add extensions/ai-extension-builder/src/module/components/ChatPanel.vue
git commit -m "feat: add ChatPanel component"
```

---

## Task 5: Create PreviewPanel Component

**Files:**
- Create: `extensions/ai-extension-builder/src/module/components/PreviewPanel.vue`

**Step 1: Create PreviewPanel.vue with error boundary**

```vue
<template>
  <div class="preview-panel">
    <div class="preview-header">
      <span class="preview-title">Preview</span>
      <v-chip v-if="error || runtimeError" small class="error-chip">Error</v-chip>
    </div>

    <div class="preview-content">
      <v-notice v-if="error || runtimeError" type="danger">
        <p><strong>{{ runtimeError ? 'Runtime' : 'Compile' }} Error:</strong></p>
        <pre>{{ (runtimeError || error)?.message }}</pre>
      </v-notice>

      <v-notice v-else-if="!component" type="normal">
        Generate an interface to see the preview here.
      </v-notice>

      <div v-else class="component-wrapper">
        <component
          :is="component"
          v-bind="props"
          @input="onInput"
        />
      </div>
    </div>

    <div v-if="lastInputValue !== undefined" class="preview-footer">
      <span class="label">Last emitted value:</span>
      <code>{{ JSON.stringify(lastInputValue) }}</code>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';

defineProps<{
  component: object | null;
  props: Record<string, unknown>;
  error: Error | null;
}>();

const lastInputValue = ref<unknown>(undefined);
const runtimeError = ref<Error | null>(null);

function onInput(value: unknown) {
  lastInputValue.value = value;
}

onErrorCaptured((err) => {
  runtimeError.value = err;
  return false; // Prevent propagation
});
</script>

<style scoped>
.preview-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  background: var(--theme--background);
  border: var(--theme--border-width) solid var(--theme--border-color);
  border-radius: var(--theme--border-radius);
  overflow: hidden;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px var(--content-padding);
  border-bottom: var(--theme--border-width) solid var(--theme--border-color);
  background: var(--theme--background-subdued);
}

.preview-title {
  font-weight: 600;
}

.error-chip {
  --v-chip-background-color: var(--theme--danger);
  --v-chip-color: white;
}

.preview-content {
  flex: 1;
  padding: var(--content-padding);
  overflow: auto;
}

.component-wrapper {
  min-height: 100px;
}

.preview-footer {
  padding: 8px var(--content-padding);
  border-top: var(--theme--border-width) solid var(--theme--border-color);
  background: var(--theme--background-subdued);
  font-size: 12px;
}

.preview-footer .label {
  color: var(--theme--foreground-subdued);
  margin-right: 8px;
}

.preview-footer code {
  background: var(--theme--background);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--theme--fonts--monospace--font-family);
}

pre {
  margin: 8px 0 0 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--theme--fonts--monospace--font-family);
  font-size: 12px;
}
</style>
```

**Step 2: Build and verify**

Run: `cd extensions/ai-extension-builder && pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add extensions/ai-extension-builder/src/module/components/PreviewPanel.vue
git commit -m "feat: add PreviewPanel with error boundary"
```

---

## Task 6: Create PreviewControls Component

**Files:**
- Create: `extensions/ai-extension-builder/src/module/components/PreviewControls.vue`

**Step 1: Create PreviewControls.vue**

```vue
<template>
  <div class="preview-controls">
    <div class="control-group">
      <label>Collection</label>
      <v-select
        :model-value="collection"
        :items="collectionItems"
        placeholder="Select collection..."
        @update:model-value="$emit('update:collection', $event)"
      />
    </div>

    <div class="control-group">
      <label>Item</label>
      <v-select
        :model-value="item"
        :items="itemOptions"
        :disabled="!collection"
        placeholder="Select item..."
        @update:model-value="$emit('update:item', $event)"
      />
    </div>

    <div class="control-group">
      <label>Field</label>
      <v-select
        :model-value="field"
        :items="fieldItems"
        :disabled="!collection"
        placeholder="Select field..."
        @update:model-value="$emit('update:field', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useStores } from '@directus/extensions-sdk';

const props = defineProps<{
  collection: string | null;
  item: string | null;
  field: string | null;
}>();

defineEmits<{
  'update:collection': [value: string | null];
  'update:item': [value: string | null];
  'update:field': [value: string | null];
}>();

const { useCollectionsStore, useFieldsStore } = useStores();
const collectionsStore = useCollectionsStore();
const fieldsStore = useFieldsStore();

const collectionItems = computed(() => {
  return collectionsStore.collections
    .filter((c: { collection: string; meta?: { hidden?: boolean } }) => !c.collection.startsWith('directus_') && !c.meta?.hidden)
    .map((c: { collection: string; name?: string }) => ({
      text: c.name || c.collection,
      value: c.collection,
    }));
});

const fieldItems = computed(() => {
  if (!props.collection) return [];

  return fieldsStore.getFieldsForCollection(props.collection)
    .filter((f: { meta?: { hidden?: boolean } }) => !f.meta?.hidden)
    .map((f: { field: string; name?: string }) => ({
      text: f.name || f.field,
      value: f.field,
    }));
});

// TODO: Fetch items for selected collection
const itemOptions = computed(() => []);
</script>

<style scoped>
.preview-controls {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: var(--theme--background-subdued);
  border: var(--theme--border-width) solid var(--theme--border-color);
  border-radius: var(--theme--border-radius);
}

.control-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.control-group label {
  font-size: 12px;
  font-weight: 600;
  color: var(--theme--foreground-subdued);
}
</style>
```

**Step 2: Build and verify**

Run: `cd extensions/ai-extension-builder && pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add extensions/ai-extension-builder/src/module/components/PreviewControls.vue
git commit -m "feat: add PreviewControls component"
```

---

## Task 7: Create SFC Compiler Composable

**Files:**
- Create: `extensions/ai-extension-builder/src/module/composables/use-sfc-compiler.ts`

**Step 1: Create use-sfc-compiler.ts**

```typescript
import { shallowRef, ref } from 'vue';
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
```

**Step 2: Build and verify**

Run: `cd extensions/ai-extension-builder && pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add extensions/ai-extension-builder/src/module/composables/use-sfc-compiler.ts
git commit -m "feat: add SFC compiler composable"
```

---

## Task 8: Create Extension Injector Composable

**Files:**
- Create: `extensions/ai-extension-builder/src/module/composables/use-extension-injector.ts`
- Create: `extensions/ai-extension-builder/src/module/utils/get-directus-app.ts`

**Step 1: Create get-directus-app.ts**

```typescript
import type { App } from 'vue';

interface VueAppElement extends Element {
  __vue_app__?: App;
}

export function getDirectusApp(): App | null {
  const appElement = document.querySelector('#app') as VueAppElement | null;
  return appElement?.__vue_app__ ?? null;
}
```

**Step 2: Create use-extension-injector.ts**

```typescript
import { ref } from 'vue';
import { getDirectusApp } from '../utils/get-directus-app';
import { useSfcCompiler } from './use-sfc-compiler';

interface AiExtension {
  id: string;
  slug: string;
  name: string;
  icon: string;
  description: string;
  files: Record<string, string>;
  entry: string;
  extension_config: {
    types: string[];
    group: string;
    options: unknown[];
  };
  status: 'draft' | 'published';
}

interface InterfaceConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  component: object;
  types: string[];
  group: string;
  options: unknown[];
}

// Access extensions store via Vue app's provide/inject context
function getExtensionsStore(app: App): { interfaces: { value: InterfaceConfig[] } } | null {
  // The extensions store is provided at app level
  // Access via _context.provides which contains all provided values
  const provides = (app as unknown as { _context: { provides: Record<symbol | string, unknown> } })._context.provides;

  // Find the extensions store - it's provided with a symbol key
  // We need to search for the object that has 'interfaces' shallowRef
  for (const value of Object.values(provides)) {
    if (value && typeof value === 'object' && 'interfaces' in value) {
      return value as { interfaces: { value: InterfaceConfig[] } };
    }
  }

  return null;
}

export function useExtensionInjector() {
  const { compile } = useSfcCompiler();
  const injectedExtensions = ref<Set<string>>(new Set());

  async function injectExtension(ext: AiExtension): Promise<boolean> {
    const app = getDirectusApp();
    if (!app) {
      console.error('Directus app not found');
      return false;
    }

    // Compile the extension
    const { component, error } = await compile(ext.files, ext.entry, ext.slug);
    if (error || !component) {
      console.error(`Failed to compile extension ${ext.slug}:`, error);
      return false;
    }

    // Register Vue component globally
    app.component(`interface-${ext.slug}`, component);

    // Update extensions store via app context
    const extensions = getExtensionsStore(app);
    if (!extensions) {
      console.error('Extensions store not found in app context');
      return false;
    }

    const config: InterfaceConfig = {
      id: ext.slug,
      name: ext.name,
      icon: ext.icon,
      description: ext.description,
      component,
      types: ext.extension_config.types,
      group: ext.extension_config.group,
      options: ext.extension_config.options,
    };

    // Must replace .value entirely (shallowRef)
    extensions.interfaces.value = [...extensions.interfaces.value, config];

    injectedExtensions.value.add(ext.slug);
    return true;
  }

  async function removeExtension(slug: string): Promise<boolean> {
    const app = getDirectusApp();
    if (!app) return false;

    const extensions = getExtensionsStore(app);
    if (!extensions) return false;

    extensions.interfaces.value = extensions.interfaces.value.filter(
      (i: { id: string }) => i.id !== slug
    );

    injectedExtensions.value.delete(slug);
    return true;
  }

  return {
    injectExtension,
    removeExtension,
    injectedExtensions,
  };
}
```

**Step 3: Build and verify**

Run: `cd extensions/ai-extension-builder && pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add extensions/ai-extension-builder/src/module/composables/ extensions/ai-extension-builder/src/module/utils/
git commit -m "feat: add extension injector composable"
```

---

## Task 9: Create AI Generation Composable (Stub)

**Files:**
- Create: `extensions/ai-extension-builder/src/module/composables/use-ai-generation.ts`

**Step 1: Create use-ai-generation.ts with stub**

```typescript
import { ref } from 'vue';

interface GenerationResult {
  files: Record<string, string>;
  entry: string;
  config: {
    name: string;
    icon: string;
    description: string;
    types: string[];
    group: string;
    options: unknown[];
  };
}

interface GenerationError {
  message: string;
  code?: string;
}

export function useAiGeneration() {
  const isGenerating = ref(false);
  const lastError = ref<GenerationError | null>(null);

  async function generate(prompt: string): Promise<GenerationResult | null> {
    isGenerating.value = true;
    lastError.value = null;

    try {
      // TODO: Implement actual AI generation
      // For now, return a simple stub component

      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate delay

      const stubComponent = `<template>
  <div class="stub-interface">
    <v-input
      :model-value="value"
      placeholder="AI-generated interface placeholder"
      @update:model-value="emit('input', $event)"
    />
    <p class="description">Prompt: ${prompt}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  value: string | null;
}>();

const emit = defineEmits<{
  input: [value: string];
}>();
</script>

<style scoped>
.stub-interface {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.description {
  font-size: 12px;
  color: var(--theme--foreground-subdued);
}
</style>`;

      return {
        files: {
          'index.vue': stubComponent,
        },
        entry: 'index.vue',
        config: {
          name: 'AI Generated Interface',
          icon: 'auto_fix_high',
          description: `Generated from: ${prompt.slice(0, 50)}...`,
          types: ['string'],
          group: 'standard',
          options: [],
        },
      };
    } catch (err) {
      lastError.value = {
        message: err instanceof Error ? err.message : String(err),
      };
      return null;
    } finally {
      isGenerating.value = false;
    }
  }

  async function refine(
    prompt: string,
    currentFiles: Record<string, string>,
    feedback: string
  ): Promise<GenerationResult | null> {
    // TODO: Implement refinement with context
    return generate(`${prompt}\n\nRefinement: ${feedback}`);
  }

  return {
    generate,
    refine,
    isGenerating,
    lastError,
  };
}
```

**Step 2: Build and verify**

Run: `cd extensions/ai-extension-builder && pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add extensions/ai-extension-builder/src/module/composables/use-ai-generation.ts
git commit -m "feat: add AI generation composable (stub)"
```

---

## Task 10: Wire Up BuilderView with Composables

**Files:**
- Modify: `extensions/ai-extension-builder/src/module/views/BuilderView.vue`

**Step 1: Update BuilderView to use composables**

```vue
<template>
  <private-view title="AI Extension Builder">
    <template #title-outer:prepend>
      <v-button class="header-icon" rounded disabled icon secondary>
        <v-icon name="auto_fix_high" />
      </v-button>
    </template>

    <template #actions>
      <v-button
        v-tooltip.bottom="'Save Draft'"
        rounded
        icon
        :disabled="!canSave"
        secondary
        @click="onSaveDraft"
      >
        <v-icon name="save" />
      </v-button>
      <v-button
        v-tooltip.bottom="'Publish Extension'"
        rounded
        icon
        :disabled="!canPublish"
        @click="onPublish"
      >
        <v-icon name="publish" />
      </v-button>
    </template>

    <div class="builder-container">
      <div class="chat-section">
        <ChatPanel
          :messages="messages"
          :loading="isGenerating"
          @send="onSendMessage"
        />
      </div>

      <div class="preview-section">
        <PreviewControls
          v-model:collection="selectedCollection"
          v-model:item="selectedItem"
          v-model:field="selectedField"
        />
        <PreviewPanel
          :component="compiledComponent"
          :props="previewProps"
          :error="compileError"
        />
      </div>
    </div>
  </private-view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useApi } from '@directus/extensions-sdk';
import ChatPanel from '../components/ChatPanel.vue';
import PreviewPanel from '../components/PreviewPanel.vue';
import PreviewControls from '../components/PreviewControls.vue';
import { useSfcCompiler } from '../composables/use-sfc-compiler';
import { useAiGeneration } from '../composables/use-ai-generation';
import { useExtensionInjector } from '../composables/use-extension-injector';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const api = useApi();
const { compile, compiledComponent, lastError: compileError, isCompiling } = useSfcCompiler();
const { generate, isGenerating } = useAiGeneration();
const { injectExtension } = useExtensionInjector();

const messages = ref<ChatMessage[]>([]);
const currentExtension = ref<{
  files: Record<string, string>;
  entry: string;
  config: {
    name: string;
    icon: string;
    description: string;
    types: string[];
    group: string;
    options: unknown[];
  };
} | null>(null);

const selectedCollection = ref<string | null>(null);
const selectedItem = ref<string | null>(null);
const selectedField = ref<string | null>(null);

const previewProps = computed(() => ({
  value: null, // TODO: fetch actual field value
  collection: selectedCollection.value,
  field: selectedField.value,
  primaryKey: selectedItem.value,
}));

const canSave = computed(() => currentExtension.value !== null);
const canPublish = computed(() => currentExtension.value !== null && !compileError.value);

async function onSendMessage(content: string) {
  messages.value.push({ role: 'user', content });

  const result = await generate(content);

  if (result) {
    currentExtension.value = result;

    // Compile for preview
    const slug = `preview-${Date.now()}`;
    await compile(result.files, result.entry, slug);

    messages.value.push({
      role: 'assistant',
      content: `Generated interface "${result.config.name}". Check the preview on the right.`,
    });
  } else {
    messages.value.push({
      role: 'assistant',
      content: 'Sorry, I encountered an error generating the interface. Please try again.',
    });
  }
}

async function onSaveDraft() {
  if (!currentExtension.value) return;

  const slug = `ai-${Date.now()}`;

  try {
    await api.post('/items/ai_extensions', {
      slug,
      name: currentExtension.value.config.name,
      type: 'interface',
      icon: currentExtension.value.config.icon,
      description: currentExtension.value.config.description,
      files: currentExtension.value.files,
      entry: currentExtension.value.entry,
      extension_config: {
        types: currentExtension.value.config.types,
        group: currentExtension.value.config.group,
        options: currentExtension.value.config.options,
      },
      status: 'draft',
      ai_prompt: messages.value.find((m) => m.role === 'user')?.content || '',
    });

    messages.value.push({
      role: 'assistant',
      content: `Draft saved as "${currentExtension.value.config.name}" (${slug}).`,
    });
  } catch (err) {
    console.error('Failed to save draft:', err);
    messages.value.push({
      role: 'assistant',
      content: 'Failed to save draft. Please try again.',
    });
  }
}

async function onPublish() {
  if (!currentExtension.value) return;

  const slug = `ai-${Date.now()}`;

  try {
    const response = await api.post('/items/ai_extensions', {
      slug,
      name: currentExtension.value.config.name,
      type: 'interface',
      icon: currentExtension.value.config.icon,
      description: currentExtension.value.config.description,
      files: currentExtension.value.files,
      entry: currentExtension.value.entry,
      extension_config: {
        types: currentExtension.value.config.types,
        group: currentExtension.value.config.group,
        options: currentExtension.value.config.options,
      },
      status: 'published',
      ai_prompt: messages.value.find((m) => m.role === 'user')?.content || '',
    });

    // Inject into running app
    await injectExtension({
      id: response.data.id,
      slug,
      name: currentExtension.value.config.name,
      icon: currentExtension.value.config.icon,
      description: currentExtension.value.config.description,
      files: currentExtension.value.files,
      entry: currentExtension.value.entry,
      extension_config: {
        types: currentExtension.value.config.types,
        group: currentExtension.value.config.group,
        options: currentExtension.value.config.options,
      },
      status: 'published',
    });

    messages.value.push({
      role: 'assistant',
      content: `Published! Interface "${currentExtension.value.config.name}" is now available in field configuration.`,
    });
  } catch (err) {
    console.error('Failed to publish:', err);
    messages.value.push({
      role: 'assistant',
      content: 'Failed to publish extension. Please try again.',
    });
  }
}
</script>

<style scoped>
.builder-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--content-padding);
  height: calc(100vh - var(--header-bar-height) - 2 * var(--content-padding));
  padding: var(--content-padding);
}

.chat-section,
.preview-section {
  display: flex;
  flex-direction: column;
  gap: var(--content-padding);
  overflow: hidden;
}

.header-icon {
  --v-button-background-color: var(--theme--primary-background);
  --v-button-color: var(--theme--primary);
}
</style>
```

**Step 2: Build and verify**

Run: `cd extensions/ai-extension-builder && pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add extensions/ai-extension-builder/src/module/views/BuilderView.vue
git commit -m "feat: wire up BuilderView with composables"
```

---

## Task 11: Add CSP Configuration to Docker Compose

**Files:**
- Modify: `docker-compose.yml`

**Step 1: Add CSP environment variables**

Add these lines under the `directus` service `environment` section:

```yaml
      # CSP for AI Extension Builder (unsafe-eval required for SFC compilation)
      CONTENT_SECURITY_POLICY_DIRECTIVES__SCRIPT_SRC: "'self' 'unsafe-eval'"
      CONTENT_SECURITY_POLICY_DIRECTIVES__STYLE_SRC: "'self' 'unsafe-inline'"
      CONTENT_SECURITY_POLICY_DIRECTIVES__IMG_SRC: "'self' data:"
      CONTENT_SECURITY_POLICY_DIRECTIVES__CONNECT_SRC: "'self'"
      CONTENT_SECURITY_POLICY_DIRECTIVES__FRAME_SRC: "'none'"
      CONTENT_SECURITY_POLICY_DIRECTIVES__OBJECT_SRC: "'none'"
```

**Step 2: Restart Directus**

Run: `docker compose down && docker compose up -d`
Expected: Directus starts with new CSP config

**Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add CSP config for SFC compilation"
```

---

## Task 12: Create ai_extensions Collection Schema

**Files:**
- Create: `extensions/ai-extension-builder/schema/ai_extensions.yaml`

**Step 1: Create schema file for reference**

```yaml
# ai_extensions collection schema
# Apply via Directus Admin UI or API

collection: ai_extensions
meta:
  icon: auto_fix_high
  note: AI-generated extensions stored in database
  hidden: false
  singleton: false

fields:
  - field: id
    type: uuid
    meta:
      interface: input
      readonly: true
      hidden: true
    schema:
      is_primary_key: true
      has_auto_increment: false

  - field: slug
    type: string
    meta:
      interface: input
      required: true
      note: Unique identifier used as extension id
    schema:
      is_unique: true
      is_nullable: false

  - field: name
    type: string
    meta:
      interface: input
      required: true

  - field: type
    type: string
    meta:
      interface: select-dropdown
      options:
        choices:
          - text: Interface
            value: interface
          - text: Panel
            value: panel
          - text: Module
            value: module
    schema:
      default_value: interface

  - field: icon
    type: string
    meta:
      interface: input
    schema:
      default_value: extension

  - field: description
    type: text
    meta:
      interface: input-multiline

  - field: files
    type: json
    meta:
      interface: input-code
      options:
        language: json
      note: "Virtual file system: { 'index.vue': '...', 'components/Button.vue': '...' }"

  - field: entry
    type: string
    meta:
      interface: input
    schema:
      default_value: index.vue

  - field: extension_config
    type: json
    meta:
      interface: input-code
      options:
        language: json
      note: InterfaceConfig without component

  - field: status
    type: string
    meta:
      interface: select-dropdown
      options:
        choices:
          - text: Draft
            value: draft
          - text: Published
            value: published
    schema:
      default_value: draft

  - field: version
    type: integer
    meta:
      interface: input
    schema:
      default_value: 1

  - field: ai_prompt
    type: text
    meta:
      interface: input-multiline
      note: Original generation prompt

  - field: ai_model
    type: string
    meta:
      interface: input
```

**Step 2: Document manual creation steps**

The collection needs to be created manually in Directus Admin UI:
1. Go to Settings > Data Model
2. Create collection `ai_extensions`
3. Add fields as specified in schema

**Step 3: Commit**

```bash
git add extensions/ai-extension-builder/schema/
git commit -m "docs: add ai_extensions collection schema reference"
```

---

## Task 13: Add Auto-Load Published Extensions on App Init

**Files:**
- Modify: `extensions/ai-extension-builder/src/module/index.ts`
- Create: `extensions/ai-extension-builder/src/module/utils/load-published-extensions.ts`

Uses `preRegisterCheck` lifecycle hook to load extensions on app initialization, before module is visited. See [command-palette-module](https://github.com/directus-labs/extensions/blob/main/packages/command-palette-module/src/index.ts) for pattern reference.

**Step 1: Create load-published-extensions.ts**

```typescript
import * as Vue from 'vue';
import type { App } from 'vue';

interface AiExtension {
  id: string;
  slug: string;
  name: string;
  icon: string;
  description: string;
  files: Record<string, string>;
  entry: string;
  extension_config: {
    types: string[];
    group: string;
    options: unknown[];
  };
  status: 'draft' | 'published';
}

interface InterfaceConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  component: object;
  types: string[];
  group: string;
  options: unknown[];
}

interface VueAppElement extends Element {
  __vue_app__?: App;
}

interface SfcLoaderOptions {
  moduleCache: Record<string, unknown>;
  getFile: (url: string) => string | Promise<string>;
  addStyle: (css: string) => void;
}

const styleRegistry = new Map<string, HTMLStyleElement>();

function injectStyle(css: string, extSlug: string): void {
  styleRegistry.get(extSlug)?.remove();
  const style = document.createElement('style');
  style.textContent = css;
  style.dataset.aiExtension = extSlug;
  document.head.appendChild(style);
  styleRegistry.set(extSlug, style);
}

function getDirectusApp(): App | null {
  const appElement = document.querySelector('#app') as VueAppElement | null;
  return appElement?.__vue_app__ ?? null;
}

function getExtensionsStore(app: App): { interfaces: { value: InterfaceConfig[] } } | null {
  const provides = (app as unknown as { _context: { provides: Record<symbol | string, unknown> } })._context.provides;
  for (const value of Object.values(provides)) {
    if (value && typeof value === 'object' && 'interfaces' in value) {
      return value as { interfaces: { value: InterfaceConfig[] } };
    }
  }
  return null;
}

async function compileAndInject(ext: AiExtension, app: App): Promise<boolean> {
  try {
    const { loadModule } = await import('vue3-sfc-loader');

    const component = await loadModule(`/${ext.entry}`, {
      moduleCache: { vue: Vue },
      getFile(url: string) {
        const path = url.replace(/^\//, '');
        const content = ext.files[path];
        if (!content) throw new Error(`File not found: ${path}`);
        return content;
      },
      addStyle(css: string) {
        injectStyle(css, ext.slug);
      },
    } as SfcLoaderOptions);

    app.component(`interface-${ext.slug}`, component);

    const extensions = getExtensionsStore(app);
    if (!extensions) {
      console.error('Extensions store not found');
      return false;
    }

    const config: InterfaceConfig = {
      id: ext.slug,
      name: ext.name,
      icon: ext.icon,
      description: ext.description,
      component,
      types: ext.extension_config.types,
      group: ext.extension_config.group,
      options: ext.extension_config.options,
    };

    extensions.interfaces.value = [...extensions.interfaces.value, config];
    return true;
  } catch (err) {
    console.error(`Failed to compile extension ${ext.slug}:`, err);
    return false;
  }
}

export async function loadPublishedExtensions(): Promise<void> {
  const app = getDirectusApp();
  if (!app) {
    console.error('Directus app not found');
    return;
  }

  try {
    // Access the api from the app's provides
    const provides = (app as unknown as { _context: { provides: Record<string, unknown> } })._context.provides;
    const api = provides.api as { get: (url: string, options?: unknown) => Promise<{ data: AiExtension[] }> };

    if (!api) {
      console.error('API not found in app context');
      return;
    }

    const { data: published } = await api.get('/items/ai_extensions', {
      params: { filter: { status: { _eq: 'published' } } },
    });

    let loaded = 0;
    for (const ext of published) {
      if (await compileAndInject(ext, app)) {
        loaded++;
      }
    }

    if (loaded > 0) {
      console.log(`[AI Extension Builder] Loaded ${loaded} published extension(s)`);
    }
  } catch (err) {
    // Collection might not exist yet - that's ok
    console.debug('[AI Extension Builder] Could not load extensions:', err);
  }
}
```

**Step 2: Update module index.ts to use preRegisterCheck**

```typescript
import { defineModule } from '@directus/extensions-sdk';
import ModuleComponent from './routes';
import { loadPublishedExtensions } from './utils/load-published-extensions';

export default defineModule({
  id: 'ai-extension-builder',
  name: 'AI Extension Builder',
  icon: 'auto_fix_high',
  routes: [
    {
      path: '',
      component: ModuleComponent,
    },
  ],
  preRegisterCheck() {
    // Load published AI extensions on app initialization
    loadPublishedExtensions();
    return true;
  },
});
```

**Step 3: Build and verify**

Run: `cd extensions/ai-extension-builder && pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add extensions/ai-extension-builder/src/module/
git commit -m "feat: auto-load extensions on app init via preRegisterCheck"
```

---

## Task 14: End-to-End Test

**Step 1: Start development environment**

Run: `docker compose up -d && cd extensions/ai-extension-builder && pnpm dev`
Expected: Directus running, extension in watch mode

**Step 2: Create ai_extensions collection**

1. Open http://localhost:8055
2. Login with admin@example.com / d1r3ctu5
3. Go to Settings > Data Model
4. Create collection `ai_extensions` with fields from schema

**Step 3: Test the module**

1. Navigate to AI Extension Builder module in sidebar
2. Type "Create a simple color picker interface"
3. Verify preview shows stub component
4. Click Publish
5. Go to Settings > Data Model > any collection > add field
6. Verify AI-generated interface appears in interface dropdown

**Step 4: Commit final state**

```bash
git add -A
git commit -m "feat: complete AI Extension Builder MVP"
```

---

## Summary

| Task | Description | Estimated Complexity |
|------|-------------|---------------------|
| 1 | Create extension bundle structure | Simple |
| 2 | Create module entry point | Simple |
| 3 | Create BuilderView layout | Medium |
| 4 | Create ChatPanel component | Medium |
| 5 | Create PreviewPanel component | Medium |
| 6 | Create PreviewControls component | Medium |
| 7 | Create SFC compiler composable | Complex |
| 8 | Create extension injector composable | Complex |
| 9 | Create AI generation composable (stub) | Simple |
| 10 | Wire up BuilderView with composables | Medium |
| 11 | Add CSP configuration | Simple |
| 12 | Create collection schema | Simple |
| 13 | Add auto-load on init | Simple |
| 14 | End-to-end test | Manual |

**Total: 14 tasks**

---

## Post-MVP Tasks (Not in this plan)

1. Implement actual AI generation with Claude API
2. Add system prompt with Directus component docs
3. Implement AutoFix loop for compile errors
4. Add version history
5. Add export/import functionality
6. Implement boot-time extension loading
