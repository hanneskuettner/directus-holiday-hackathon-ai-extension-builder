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
│  │  Preview     │◀───postMessage─────────│ Compiled Component│  │
│  │  (iframe)    │                        │                  │  │
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

Handles imports, TypeScript, scoped CSS. No build step.

```ts
const { loadModule } = window['vue3-sfc-loader'];
const Component = await loadModule('/Component.vue', {
  moduleCache: { vue: Vue },
  getFile: (url) => Promise.resolve(sfcSource),
  addStyle: (css) => { /* inject */ }
});
```

**Alternative:** Raw `@vue/compiler-sfc` for more control.

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

### 4. HMR / Live Reload

**Choice:** Browser-based @vue/repl pattern (not Vite HMR)

- iframe with `srcdoc` for preview
- `postMessage` to send compiled code updates (avoids flash)
- Template-only changes preserve state

### 5. External Dependencies

Directus externalizes these (provided at runtime):
```ts
['@directus/extensions-sdk', 'vue', 'vue-router', 'vue-i18n', 'pinia']
```

**MVP constraint:** Generated interfaces use props/emit only, no SDK imports. All data passed via props.

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

source_sfc      text        Vue SFC source code
extension_config json       InterfaceConfig (minus component)
compiled_js     text        cached compiled output (optional)

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
          PreviewPanel.vue    # Live preview iframe
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

2. **Preview iframe security**
   - Same-origin `srcdoc` has security implications
   - Sandboxed iframe breaks some APIs
   - Acceptable for internal tool?

3. **Extension persistence on restart**
   - Need hook/endpoint to load ai_extensions on app boot
   - Inject before hydration or after?

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
4. Build preview iframe with postMessage updates
5. Add collection/item/field selectors
6. Implement runtime injection
7. Create endpoint for ai_extensions CRUD
8. Build AI generation with system prompt
9. Add publish flow

---

## References

- [vue3-sfc-loader](https://github.com/FranckFreiburger/vue3-sfc-loader)
- [@vue/repl](https://github.com/vuejs/repl)
- [get-directus-app.ts](https://github.com/directus-labs/extensions/blob/main/packages/command-palette-module/src/utils/get-directus-app.ts)
- Directus externals: `packages/extensions/src/shared/constants/shared-deps.ts`
- Extension build: `packages/extensions-sdk/src/cli/commands/build.ts`
