# AI Generation - Design Document

## Overview

Implement actual AI-powered interface generation for the AI Extension Builder. Uses Directus's `/ai/chat` endpoint with custom tools for file manipulation, discovery questions, and preview compilation.

**Key decisions:**
- Use `/ai/chat` endpoint (not build new AI integration)
- Define local tools via Zod schemas (same pattern as `useAiStore`)
- AutoFix loop runs client-side (feed compile errors back to AI)
- AI asks discovery questions via `ask_question` tool

---

## Tool Definitions

### File Operations

**`write_file`** - Create/overwrite file in virtual FS
```ts
z.object({
  path: z.string().describe('File path, e.g. "index.vue" or "components/Button.vue"'),
  content: z.string().describe('File content')
})
```

**`read_file`** - Read file content
```ts
z.object({
  path: z.string().describe('File path to read')
})
// Returns: { content: string } or { error: "File not found" }
```

**`rename_file`** - Rename/move file
```ts
z.object({
  from: z.string().describe('Current file path'),
  to: z.string().describe('New file path')
})
```

**`delete_file`** - Remove file
```ts
z.object({
  path: z.string().describe('File path to delete')
})
```

**`list_files`** - List all files in virtual FS
```ts
z.object({})
// Returns: { files: string[] }
```

### Discovery & Context

**`ask_question`** - Ask user clarifying questions
```ts
z.object({
  question: z.string().describe('Question to ask the user'),
  input_type: z.enum(['text', 'select', 'collection', 'field']).default('text'),
  options: z.array(z.string()).optional().describe('Options for select input type'),
  context: z.object({
    collection: z.string().optional().describe('Collection for field picker context')
  }).optional()
})
// Returns: { answer: string }
```

Input types:
- `text` - Free text input
- `select` - Multiple choice from `options`
- `collection` - Directus collection picker
- `field` - Directus field picker (requires `context.collection`)

**`get_field_schema`** - Get field type, constraints, relations
```ts
z.object({
  collection: z.string(),
  field: z.string()
})
// Returns: { type, schema, meta, relation? }
```

**`get_collection_fields`** - List fields in a collection
```ts
z.object({
  collection: z.string()
})
// Returns: { fields: Array<{ field, type, name }> }
```

### Configuration & Preview

**`set_config`** - Set InterfaceConfig metadata
```ts
z.object({
  name: z.string().describe('Display name for the interface'),
  icon: z.string().describe('Material icon name'),
  description: z.string().describe('Short description'),
  types: z.array(z.string()).describe('Supported field types: string, text, integer, float, boolean, json, uuid, etc.'),
  group: z.enum(['standard', 'selection', 'relational', 'presentation', 'group', 'other']).default('standard'),
  options: z.array(z.object({
    field: z.string(),
    name: z.string(),
    type: z.string(),
    meta: z.object({
      interface: z.string(),
      width: z.enum(['half', 'full']).optional(),
      options: z.record(z.unknown()).optional()
    }),
    schema: z.object({
      default_value: z.unknown().optional()
    }).optional()
  })).default([]).describe('Configurable options for the interface')
})
```

**`request_preview`** - Trigger compilation, return errors
```ts
z.object({
  message: z.string().optional().describe('Optional message to display')
})
// Returns: { success: true } or { success: false, error: string }
```

### Communication

**`show_status`** - Display progress message to user
```ts
z.object({
  message: z.string().describe('Status message to display'),
  type: z.enum(['info', 'success', 'warning']).default('info')
})
```

---

## System Prompt Structure

> **TODO:** Expand with rich component examples before implementation.

### 1. Role & Context

```
You are an AI assistant that generates Directus interface extensions. Users describe what they want, you ask clarifying questions to understand requirements, then generate Vue 3 SFCs that integrate seamlessly with Directus.

Your workflow:
1. Ask discovery questions to understand field type, use case, constraints
2. Generate code via write_file tool
3. Call request_preview to check for compilation errors
4. If errors, fix and retry (max 3 attempts)
5. Call set_config to finalize the interface metadata
```

### 2. Interface Contract

```
Directus interfaces receive these props:
- value: The field's current value (type depends on field)
- disabled: boolean - Whether the field is read-only
- collection: string - The collection name
- field: string - The field key
- primaryKey: string | number - The item's primary key
- width: 'half' | 'full' - Layout width

Interfaces emit:
- @input(newValue) - Call this to update the field value

Available imports from '@directus/extensions-sdk':
- useApi() - Axios instance for API calls
- useStores() - Access to Directus stores (collections, fields, relations, etc.)
```

### 3. Component Catalog (condensed)

```
Form inputs:
- <v-input> - Text input with optional prefix/suffix slots
- <v-textarea> - Multiline text
- <v-select> - Dropdown select
- <v-checkbox> - Boolean checkbox
- <v-button> - Action button

Layout:
- <v-card> - Card container with title/subtitle props
- <v-notice type="info|warning|danger"> - Alert/notice box
- <v-menu> - Dropdown menu
- <v-dialog> - Modal dialog
- <v-icon name="icon_name"> - Material icon

Full reference: https://components.directus.io
```

### 4. CSS Variables

```
Colors:
--theme--primary, --theme--primary-background
--theme--foreground, --theme--foreground-subdued
--theme--background, --theme--background-subdued
--theme--danger, --theme--success, --theme--warning

Spacing:
--content-padding
--theme--form--column-gap, --theme--form--row-gap

Typography:
--theme--fonts--sans--font-family
--theme--fonts--monospace--font-family

Borders:
--theme--border-radius, --theme--border-width, --theme--border-color

Transitions:
--fast (125ms), --medium (200ms), --slow (300ms)
```

### 5. Quality Rules

```
Code structure:
- Components must be <300 lines (split into sub-components if larger)
- Use defineProps<{ ... }>() with TypeScript types
- Use defineEmits<{ event: [arg: type] }>() for type-safe events
- Never mutate props directly
- Use computed() over watchers where possible

Styling:
- Always use CSS variables for colors, spacing, borders
- Never hardcode color values
- Use scoped styles

Naming:
- All names must be self-documenting (Five-Second Rule)
- Good: validateColorValue, onColorSelect, emitColorChange
- Bad: handle, process, doStuff, data
```

### 6. Example Generation Flow

```
User: "Create an interface for picking brand colors"

AI uses ask_question:
- "Which collection and field will this be used for?" (field picker)
- Gets field schema via get_field_schema

AI uses write_file to create index.vue:
<template>
  <div class="brand-color-picker">
    <button
      v-for="color in presets"
      :key="color"
      :class="{ selected: color === value }"
      :style="{ background: color }"
      @click="emit('input', color)"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{ value: string | null }>();
const emit = defineEmits<{ input: [value: string] }>();
const presets = ['#ff5500', '#0066ff', '#00cc88'];
</script>

<style scoped>
.brand-color-picker { display: flex; gap: 8px; }
.brand-color-picker button {
  width: 32px; height: 32px;
  border-radius: var(--theme--border-radius);
  border: var(--theme--border-width) solid var(--theme--border-color);
}
.brand-color-picker button.selected {
  border-color: var(--theme--primary);
  box-shadow: 0 0 0 2px var(--theme--primary-background);
}
</style>

AI uses request_preview to check compilation
AI uses set_config:
- name: "Brand Color Picker"
- icon: "palette"
- types: ["string"]
- group: "selection"
```

---

## Composable Architecture

### Option A: Extend `use-ai-generation.ts` (Simpler)

Keep virtual FS and config as refs passed from BuilderView. The composable handles chat + tool execution.

```ts
// use-ai-generation.ts
export function useAiGeneration(
  files: Ref<Record<string, string>>,
  config: Ref<ExtensionConfig | null>,
  onQuestion: (q: Question) => Promise<string>,
  onPreview: () => Promise<{ success: boolean; error?: string }>
) {
  // Chat instance
  // Tool definitions that mutate files/config
  // Returns: messages, send, status, error
}
```

### Option B: Dedicated `use-extension-chat.ts` (More Encapsulated)

Self-contained composable that owns all state.

```ts
// use-extension-chat.ts
export function useExtensionChat() {
  const files = ref<Record<string, string>>({});
  const config = ref<ExtensionConfig | null>(null);
  const pendingQuestion = ref<Question | null>(null);
  // ...

  return { files, config, messages, send, status, pendingQuestion, ... };
}
```

**Recommendation:** Start with Option A (simpler), refactor to Option B if complexity grows.

---

## Integration Points

### BuilderView.vue Changes

```vue
<script setup>
// Existing
const { compile, compiledComponent, cleanup } = useSfcCompiler();

// New
const files = ref<Record<string, string>>({});
const config = ref<ExtensionConfig | null>(null);
const pendingQuestion = ref<Question | null>(null);

// Question resolution mechanism
let resolveQuestion: ((answer: string) => void) | null = null;

const { messages, send, status, error } = useAiGeneration(
  files,
  config,
  handleQuestion,
  handlePreview
);

async function handleQuestion(q: Question): Promise<string> {
  pendingQuestion.value = q;
  return new Promise((resolve) => {
    resolveQuestion = resolve;
  });
}

function onQuestionAnswer(answer: string) {
  pendingQuestion.value = null;
  resolveQuestion?.(answer);
  resolveQuestion = null;
}

async function handlePreview() {
  // Cleanup previous preview styles before recompile
  cleanup('preview');
  const { error } = await compile(files.value, 'index.vue', 'preview');
  return error ? { success: false, error: error.message } : { success: true };
}

// Watch files → recompile preview with stable slug
watch(files, async (newFiles) => {
  if (newFiles['index.vue']) {
    cleanup('preview');
    await compile(newFiles, 'index.vue', 'preview');
  }
}, { deep: true });
</script>
```

### ChatPanel.vue Changes

Add support for structured question UI when `pendingQuestion` is set:

```vue
<template>
  <!-- Existing message list -->

  <!-- Structured question input -->
  <QuestionInput
    v-if="pendingQuestion"
    :question="pendingQuestion"
    @answer="onAnswer"
  />
</template>
```

### PreviewPanel.vue Changes

Add options preview section:

```vue
<template>
  <div class="preview-panel">
    <!-- Existing preview content -->

    <!-- Options preview toggle -->
    <div v-if="config?.options?.length" class="options-section">
      <v-button @click="showOptions = !showOptions">
        {{ showOptions ? 'Hide' : 'Show' }} Options ({{ config.options.length }})
      </v-button>

      <v-form
        v-if="showOptions"
        :fields="config.options"
        :model-value="optionsPreviewValues"
        @update:model-value="optionsPreviewValues = $event"
      />
    </div>
  </div>
</template>
```

---

## AutoFix Loop

Client-side implementation:

```ts
async function generateWithAutoFix(prompt: string, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // AI generates/modifies files via tool calls
    await sendAndWaitForCompletion(prompt);

    // Compile and check for errors
    const { success, error } = await compile(files.value, 'index.vue', 'preview');

    if (success) {
      return { success: true };
    }

    if (attempt < maxAttempts) {
      // Feed error back to AI
      await sendAndWaitForCompletion(
        `Compilation failed with error:\n\`\`\`\n${error}\n\`\`\`\nPlease fix the issue.`
      );
    }
  }

  return { success: false, error: 'Max attempts reached' };
}
```

---

## SDK Externalization

Generated interfaces CAN use `@directus/extensions-sdk` (useApi, useStores). This supersedes the earlier MVP constraint of "props-only" - we're enabling full SDK access for richer interfaces.

Add to moduleCache:

```ts
// use-sfc-compiler.ts
import * as Vue from 'vue';
import * as extensionsSdk from '@directus/extensions-sdk';

const component = await loadModule(`/${entry}`, {
  moduleCache: {
    vue: Vue,
    '@directus/extensions-sdk': extensionsSdk,
  },
  // ...
});
```

**Note:** The system prompt should guide the AI on when to use SDK vs props:
- Simple value display/edit → props only
- Need to fetch related data → useApi()
- Need collection/field metadata → useStores()

---

## Resolved Questions

1. **Field type validation**: Yes - `set_config` validates types array. Cheap safeguard.

2. **Options schema complexity**: Full flexibility for MVP. Constrain later if issues arise.

3. **Streaming UX**: Batch file writes at end of response. Simpler, avoids partial file display.

4. **Conversation persistence**: No for MVP. Adds complexity.

5. **Error message quality**: Post-process if vue3-sfc-loader errors are too cryptic. Test and see.

---

## Resolved Questions (Continued)

6. **System prompt delivery**: Prepend context to first user message.
   - `/ai/chat` uses global `ai_system_prompt` from Directus settings - can't override per-request
   - Solution: First message includes our system context, e.g. `"[Context: ...]\n\nUser: ..."`
   - Can refine to custom endpoint post-hackathon if needed

7. **Tool approval mode**: Auto-approve all local tools (safe local operations).

8. **System tools inclusion**: Only our local tools - focused experience for extension generation.

9. **Model selection**: Piggyback on `useAiStore.selectedModel`.

---

## Reviewer Feedback (Already Addressed)

From code review:
- [ ] Clear `runtimeError` on new component in PreviewPanel
- [ ] Extract shared `AiExtension` type to `types.ts`
- [ ] Use stable preview slug or cleanup before recompile
- [ ] Fetch actual field data for preview

---

## Next Steps

### Pre-Implementation (Design Refinement)

1. **Refine system prompt** - Expand with rich component examples, props/emit patterns, common UI patterns
2. **Define type definitions** - Create `types.ts` with `Question`, `ExtensionConfig`, `AiExtension`, tool I/O types
3. **Spec QuestionInput component** - Define props, emits, UI for each input_type (text, select, collection, field)
4. **Document /ai/chat contract** - Request/response structure, tool call flow, streaming behavior

### Implementation

5. Rewrite `use-ai-generation.ts` with Chat instance + tool definitions
6. Add QuestionInput component for structured discovery
7. Add options preview section to PreviewPanel
8. Wire up SDK externalization in compiler
9. Address reviewer feedback items (runtimeError clear, shared types, field data fetch)
10. Test end-to-end with actual AI
