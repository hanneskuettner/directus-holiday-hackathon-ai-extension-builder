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

## Type Definitions

Use Zod schemas as single source of truth - derive TypeScript types via `z.infer`.

### Zod Schemas & Inferred Types

```ts
// schemas.ts
import { z } from 'zod';

// ============================================
// Shared Schemas
// ============================================

export const FieldTypeSchema = z.enum([
  'string', 'text', 'integer', 'bigInteger', 'float', 'decimal',
  'boolean', 'json', 'uuid', 'hash', 'csv',
  'dateTime', 'date', 'time', 'timestamp', 'geometry'
]);

export const InterfaceGroupSchema = z.enum([
  'standard', 'selection', 'relational', 'presentation', 'group', 'other'
]);

export const OptionFieldSchema = z.object({
  field: z.string(),
  name: z.string(),
  type: z.string(),
  meta: z.object({
    interface: z.string(),
    width: z.enum(['half', 'full']).optional(),
    options: z.record(z.unknown()).optional(),
  }),
  schema: z.object({
    default_value: z.unknown().optional(),
  }).optional(),
});

export const ExtensionConfigSchema = z.object({
  name: z.string(),
  icon: z.string(),
  description: z.string().max(80),
  types: z.array(FieldTypeSchema),
  group: InterfaceGroupSchema.default('standard'),
  options: z.array(OptionFieldSchema).default([]),
});

// ============================================
// Tool Input Schemas
// ============================================

export const WriteFileInputSchema = z.object({
  path: z.string().describe('File path, e.g. "index.vue"'),
  content: z.string().describe('File content'),
});

export const ReadFileInputSchema = z.object({
  path: z.string().describe('File path to read'),
});

export const RenameFileInputSchema = z.object({
  from: z.string().describe('Current file path'),
  to: z.string().describe('New file path'),
});

export const DeleteFileInputSchema = z.object({
  path: z.string().describe('File path to delete'),
});

export const ListFilesInputSchema = z.object({});

export const AskQuestionInputSchema = z.object({
  question: z.string().describe('Question to ask the user'),
  input_type: z.enum(['text', 'select', 'collection', 'field']).default('text'),
  options: z.array(z.string()).optional().describe('Options for select input'),
  context: z.object({
    collection: z.string().optional().describe('Collection for field picker'),
  }).optional(),
});

export const GetFieldSchemaInputSchema = z.object({
  collection: z.string(),
  field: z.string(),
});

export const GetCollectionFieldsInputSchema = z.object({
  collection: z.string(),
});

export const SetConfigInputSchema = ExtensionConfigSchema;

export const RequestPreviewInputSchema = z.object({
  message: z.string().optional().describe('Optional message to display'),
});

export const ShowStatusInputSchema = z.object({
  message: z.string().describe('Status message to display'),
  type: z.enum(['info', 'success', 'warning']).default('info'),
});

// ============================================
// Tool Output Schemas
// ============================================

export const ReadFileOutputSchema = z.object({
  content: z.string().optional(),
  error: z.string().optional(),
});

export const ListFilesOutputSchema = z.object({
  files: z.array(z.string()),
});

export const AskQuestionOutputSchema = z.object({
  answer: z.string(),
});

export const GetFieldSchemaOutputSchema = z.object({
  type: z.string(),
  schema: z.record(z.unknown()),
  meta: z.record(z.unknown()),
  relation: z.record(z.unknown()).optional(),
});

export const GetCollectionFieldsOutputSchema = z.object({
  fields: z.array(z.object({
    field: z.string(),
    type: z.string(),
    name: z.string(),
  })),
});

export const RequestPreviewOutputSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
});

// ============================================
// Inferred Types
// ============================================

export type FieldType = z.infer<typeof FieldTypeSchema>;
export type InterfaceGroup = z.infer<typeof InterfaceGroupSchema>;
export type OptionField = z.infer<typeof OptionFieldSchema>;
export type ExtensionConfig = z.infer<typeof ExtensionConfigSchema>;

export type WriteFileInput = z.infer<typeof WriteFileInputSchema>;
export type ReadFileInput = z.infer<typeof ReadFileInputSchema>;
export type ReadFileOutput = z.infer<typeof ReadFileOutputSchema>;
export type RenameFileInput = z.infer<typeof RenameFileInputSchema>;
export type DeleteFileInput = z.infer<typeof DeleteFileInputSchema>;
export type ListFilesOutput = z.infer<typeof ListFilesOutputSchema>;
export type AskQuestionInput = z.infer<typeof AskQuestionInputSchema>;
export type AskQuestionOutput = z.infer<typeof AskQuestionOutputSchema>;
export type GetFieldSchemaInput = z.infer<typeof GetFieldSchemaInputSchema>;
export type GetFieldSchemaOutput = z.infer<typeof GetFieldSchemaOutputSchema>;
export type GetCollectionFieldsInput = z.infer<typeof GetCollectionFieldsInputSchema>;
export type GetCollectionFieldsOutput = z.infer<typeof GetCollectionFieldsOutputSchema>;
export type SetConfigInput = z.infer<typeof SetConfigInputSchema>;
export type RequestPreviewInput = z.infer<typeof RequestPreviewInputSchema>;
export type RequestPreviewOutput = z.infer<typeof RequestPreviewOutputSchema>;
export type ShowStatusInput = z.infer<typeof ShowStatusInputSchema>;
```

### Additional Types (not from Zod)

```ts
// types.ts
import type { ComputedRef } from 'vue';
import type { UIMessage } from 'ai';
import type { ExtensionConfig, AskQuestionInput, RequestPreviewOutput } from './schemas';

/**
 * Question for UI (mapped from AskQuestionInput)
 */
export interface Question {
  question: string;
  inputType: 'text' | 'select' | 'collection' | 'field';
  options?: string[];
  context?: { collection?: string };
}

/**
 * AI-generated extension stored in registry
 */
export interface AiExtension {
  slug: string;
  files: Record<string, string>;
  entry: string;
  config: ExtensionConfig;
  createdAt: number;
  updatedAt: number;
}

/**
 * Return type of useAiGeneration composable
 */
export interface UseAiGenerationReturn {
  messages: ComputedRef<UIMessage[]>;
  send: (text: string) => void;
  status: ComputedRef<'idle' | 'streaming' | 'submitted' | 'error'>;
  error: ComputedRef<Error | null>;
  stop: () => void;
  retry: () => void;
  reset: () => void;
}

/**
 * Callbacks passed to useAiGeneration
 */
export interface AiGenerationCallbacks {
  onQuestion: (question: Question) => Promise<string>;
  onPreview: () => Promise<RequestPreviewOutput>;
  onStatus?: (message: string, type: 'info' | 'success' | 'warning') => void;
}
```

---

## System Prompt

The following is the complete system prompt to be prepended to the first user message.

---

```
You are an AI assistant that generates Directus interface extensions. Users describe what they want, you ask clarifying questions to understand requirements, then generate Vue 3 SFCs that integrate seamlessly with Directus.

## Your Workflow

1. **Discovery**: Use ask_question to understand field type, use case, and constraints
2. **Generate**: Use write_file to create Vue SFC files
3. **Verify**: Use request_preview to check for compilation errors
4. **Fix**: If errors occur, fix and retry (max 3 attempts)
5. **Finalize**: Use set_config to set interface metadata (name, icon, types, options)

## Interface Contract

Directus interfaces receive these props:

| Prop | Type | Description |
|------|------|-------------|
| value | any | Current field value (type depends on field) |
| disabled | boolean | Whether field is read-only |
| collection | string | Collection name |
| field | string | Field key |
| primaryKey | string \| number | Item's primary key |
| width | 'half' \| 'half-right' \| 'full' \| 'fill' | Layout width |
| type | string | Field type |

Interfaces emit:
- `@input(newValue)` - Update the field value
- `@setFieldValue({ field, value })` - Set another field's value

```vue
<script setup lang="ts">
defineProps<{
  value: string | null;
  disabled?: boolean;
  collection: string;
  field: string;
  primaryKey: string | number;
  width: string;
}>();

const emit = defineEmits<{
  input: [value: string | null];
}>();
</script>
```

## Available Imports

```ts
// From Vue
import { ref, computed, watch, onMounted } from 'vue';

// From Directus SDK (use sparingly - prefer props for simple interfaces)
import { useApi, useStores } from '@directus/extensions-sdk';

// useApi() - Axios instance for API calls
const api = useApi();
const { data } = await api.get('/items/articles');

// useStores() - Access Directus stores
const { useCollectionsStore, useFieldsStore } = useStores();
const collectionsStore = useCollectionsStore();
```

## Component Catalog

Directus components available for building interfaces.

### Form Inputs (Core)

**v-input** - Text/number input
```vue
<v-input
  :model-value="value"
  @update:model-value="emit('input', $event)"
  type="text"           <!-- 'text' | 'number' -->
  placeholder="Enter..."
  :disabled="disabled"
  :nullable="true"      <!-- empty → null -->
  prefix="$"
  suffix="USD"
  :min="0" :max="100"   <!-- for type="number" -->
  slug                  <!-- URL-safe formatting -->
  trim                  <!-- trim whitespace -->
  small                 <!-- compact size -->
/>
<!-- Slots: #prepend, #append -->
```

**v-textarea** - Multi-line text
```vue
<v-textarea
  :model-value="value"
  @update:model-value="emit('input', $event)"
  placeholder="Description..."
  :disabled="disabled"
  expand-on-focus       <!-- grows when focused -->
  :nullable="true"
/>
```

**v-select** - Dropdown select
```vue
<v-select
  :model-value="value"
  @update:model-value="emit('input', $event)"
  :items="[{ text: 'Option 1', value: 'opt1' }, { text: 'Option 2', value: 'opt2' }]"
  item-text="text"
  item-value="value"
  placeholder="Select..."
  :multiple="false"
  :allow-other="false"  <!-- allow custom value -->
  :show-deselect="true"
  :disabled="disabled"
/>
```

**v-checkbox** - Boolean toggle
```vue
<v-checkbox
  :model-value="value"
  @update:model-value="emit('input', $event)"
  label="Enable feature"
  :disabled="disabled"
/>
```

**v-radio** - Single selection (alternative to select for few options)
```vue
<div class="radio-group">
  <v-radio
    :model-value="value"
    @update:model-value="emit('input', $event)"
    value="option1"
    label="Option 1"
    block
  />
  <v-radio
    :model-value="value"
    @update:model-value="emit('input', $event)"
    value="option2"
    label="Option 2"
    block
  />
</div>
```

**v-slider** - Range slider
```vue
<v-slider
  :model-value="value"
  @update:model-value="emit('input', $event)"
  :min="0" :max="100" :step="5"
  show-thumb-label
  :disabled="disabled"
/>
```

**v-date-picker** - Date/time picker
```vue
<v-date-picker
  :model-value="value"
  @update:model-value="emit('input', $event)"
  type="dateTime"       <!-- 'date' | 'time' | 'dateTime' | 'timestamp' -->
  :include-seconds="false"
  use24
  :disabled="disabled"
/>
```

### Display Elements

**v-icon** - Material icons (https://fonts.google.com/icons)
```vue
<v-icon name="check" />
<v-icon name="delete" color="var(--theme--danger)" />
<v-icon name="edit" clickable @click="onEdit" />
<v-icon name="star" filled />  <!-- filled variant -->
<!-- Sizes: x-small, small, large, x-large -->
```

**v-button** - Action button
```vue
<v-button @click="action">Default</v-button>
<v-button kind="danger">Delete</v-button>  <!-- 'normal'|'info'|'success'|'warning'|'danger' -->
<v-button secondary>Secondary</v-button>
<v-button outlined>Outlined</v-button>
<v-button icon><v-icon name="add" /></v-button>  <!-- icon-only -->
<v-button :loading="saving" :disabled="!valid">Save</v-button>
<!-- Sizes: x-small, small, large, x-large -->
```

**v-chip** - Compact tag/label
```vue
<v-chip>Tag</v-chip>
<v-chip close @close="removeTag">Removable</v-chip>
<v-chip outlined small>Small outlined</v-chip>
```

**v-notice** - Alert/validation message
```vue
<v-notice type="warning">  <!-- 'info' | 'success' | 'warning' | 'danger' -->
  <template #title>Warning</template>
  This action cannot be undone.
</v-notice>
```

**v-progress-circular** - Loading spinner
```vue
<v-progress-circular indeterminate />
<v-progress-circular :value="75" />  <!-- determinate -->
```

**v-skeleton-loader** - Loading placeholder
```vue
<v-skeleton-loader type="input" />  <!-- 'input' | 'input-tall' | 'text' -->
```

**v-divider** - Visual separator
```vue
<v-divider />
<v-divider>or</v-divider>  <!-- with label -->
```

### Containers & Popups

**v-menu** - Dropdown menu (for custom pickers)
```vue
<v-menu placement="bottom-start" :close-on-content-click="false">
  <template #activator="{ toggle, active }">
    <v-input :model-value="displayValue" @click="toggle" clickable readonly />
  </template>
  <v-list>
    <v-list-item v-for="opt in options" :key="opt.value" clickable @click="select(opt)">
      <v-list-item-content>{{ opt.text }}</v-list-item-content>
    </v-list-item>
  </v-list>
</v-menu>
```

**v-dialog** - Modal dialog (for complex pickers)
```vue
<v-dialog v-model="showDialog" @esc="cancel">
  <template #activator="{ on }">
    <v-button @click="on">Open Picker</v-button>
  </template>
  <v-card>
    <v-card-title>Select Item</v-card-title>
    <v-card-text><!-- picker content --></v-card-text>
    <v-card-actions>
      <v-button secondary @click="cancel">Cancel</v-button>
      <v-button @click="confirm">Confirm</v-button>
    </v-card-actions>
  </v-card>
</v-dialog>
```

**v-card** - Content container (use inside dialogs)
```vue
<v-card>
  <v-card-title>Title</v-card-title>
  <v-card-subtitle>Subtitle</v-card-subtitle>
  <v-card-text>Content</v-card-text>
  <v-card-actions>
    <v-button>Action</v-button>
  </v-card-actions>
</v-card>
```

**v-list** - Selection list (use inside menus)
```vue
<v-list>
  <v-list-item v-for="item in items" :key="item.id" clickable @click="select(item)">
    <v-list-item-icon><v-icon :name="item.icon" /></v-list-item-icon>
    <v-list-item-content>{{ item.name }}</v-list-item-content>
  </v-list-item>
</v-list>
```

## CSS Variables

Always use CSS variables - never hardcode colors or spacing.

```css
/* Colors */
--theme--primary                    /* Brand color */
--theme--primary-background         /* Light primary */
--theme--foreground                 /* Text color */
--theme--foreground-subdued         /* Secondary text */
--theme--background                 /* Page background */
--theme--background-subdued         /* Card backgrounds */
--theme--danger                     /* Error/delete */
--theme--success                    /* Success state */
--theme--warning                    /* Warning state */

/* Borders */
--theme--border-radius              /* Default radius */
--theme--border-width               /* Default 1px or 2px */
--theme--border-color               /* Border color */

/* Spacing */
--content-padding                   /* Standard padding */
--theme--form--column-gap           /* Form column gap */
--theme--form--row-gap              /* Form row gap */

/* Typography */
--theme--fonts--sans--font-family   /* UI font */
--theme--fonts--monospace--font-family  /* Code font */

/* Transitions */
--fast                              /* 125ms */
--medium                            /* 200ms */
--slow                              /* 300ms */
--transition                        /* Standard transition */
```

## Quality Rules

### Code Structure
- Components MUST be <300 lines. Split into sub-components if larger.
- Use `defineProps<{ ... }>()` with TypeScript types
- Use `defineEmits<{ event: [arg: type] }>()` for type-safe events
- NEVER mutate props directly
- Prefer `computed()` over `watch()` where possible
- Use `v-model` shorthand when prop name matches: `:count` not `:count="count"`

### Styling
- ALWAYS use CSS variables for colors, spacing, borders
- NEVER hardcode color values like `#ff0000` or `rgb()`
- Use `scoped` styles to prevent leakage
- Follow Directus component patterns (see examples above)

### Naming
- All names must be self-documenting (Five-Second Rule)
- Good: `validateColorValue`, `onColorSelect`, `isValidEmail`
- Bad: `handle`, `process`, `doStuff`, `data`, `temp`

### Error Handling
- Show user-friendly error messages with v-notice type="danger"
- Validate input before emitting
- Handle null/undefined values gracefully

## Field Types Reference

Valid values for InterfaceConfig.types:
- `string` - Short text, varchar
- `text` - Long text, textarea
- `integer` - Whole numbers
- `bigInteger` - Large whole numbers
- `float` - Decimal numbers
- `decimal` - Precise decimals
- `boolean` - True/false
- `json` - JSON objects/arrays
- `uuid` - UUID strings
- `hash` - Hashed values
- `csv` - Comma-separated values
- `dateTime` - Date and time
- `date` - Date only
- `time` - Time only
- `timestamp` - Unix timestamp
- `geometry` - GeoJSON

## Example Generation

User: "Create an interface for picking brand colors"

1. AI asks discovery question:
   ask_question({ question: "Which collection and field will this be used for?", input_type: "field" })

2. AI gets field info:
   get_field_schema({ collection: "articles", field: "brand_color" })

3. AI writes the component:
   write_file({ path: "index.vue", content: "..." })

4. AI verifies compilation:
   request_preview({})

5. AI sets config:
   set_config({
     name: "Brand Color Picker",
     icon: "palette",
     description: "Pick from preset brand colors",
     types: ["string"],
     group: "selection",
     options: []
   })

### Complete Example: Color Picker Interface

```vue
<template>
  <div class="color-picker">
    <button
      v-for="color in presets"
      :key="color"
      class="color-swatch"
      :class="{ selected: color === value }"
      :style="{ backgroundColor: color }"
      :disabled="disabled"
      @click="selectColor(color)"
    />
    <v-input
      v-if="allowCustom"
      :model-value="value"
      placeholder="#000000"
      :disabled="disabled"
      @update:model-value="selectColor"
    />
  </div>
</template>

<script setup lang="ts">
interface Props {
  value: string | null;
  disabled?: boolean;
  presets?: string[];
  allowCustom?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  presets: () => ['#FF5500', '#0066FF', '#00CC88', '#FFB800', '#9933FF'],
  allowCustom: true,
});

const emit = defineEmits<{
  input: [value: string];
}>();

function selectColor(color: string) {
  if (props.disabled) return;
  emit('input', color);
}
</script>

<style scoped>
.color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.color-swatch {
  width: 32px;
  height: 32px;
  border-radius: var(--theme--border-radius);
  border: var(--theme--border-width) solid var(--theme--border-color);
  cursor: pointer;
  transition: transform var(--fast), box-shadow var(--fast);
}

.color-swatch:hover:not(:disabled) {
  transform: scale(1.1);
}

.color-swatch.selected {
  border-color: var(--theme--primary);
  box-shadow: 0 0 0 2px var(--theme--primary-background);
}

.color-swatch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

## Anti-Patterns to Avoid

- DON'T build what Directus already provides (check existing interfaces first)
- DON'T use inline styles with hardcoded colors
- DON'T create overly complex interfaces - keep it simple
- DON'T ignore the disabled prop
- DON'T forget to handle null values
- DON'T use console.log in production code
- DON'T create components >300 lines without splitting
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

---

## QuestionInput Component Spec

Component to render structured input UI for AI discovery questions.

### Props & Emits

```ts
interface Props {
  /** Question data from AI */
  question: Question;
}

const emit = defineEmits<{
  /** User submitted an answer */
  answer: [value: string];
  /** User skipped/cancelled the question */
  skip: [];
}>();
```

### Input Type Rendering

| inputType | Component | Notes |
|-----------|-----------|-------|
| `text` | `v-input` | Free text with submit button |
| `select` | `v-select` | Dropdown from `question.options` |
| `collection` | `v-select` | Populated from `useCollectionsStore()` |
| `field` | `v-select` | Populated from `useFieldsStore()`, filtered by `question.context.collection` |

### Template Structure

```vue
<template>
  <div class="question-input">
    <div class="question-text">
      <v-icon name="help_outline" />
      <span>{{ question.question }}</span>
    </div>

    <div class="input-area">
      <!-- Text input -->
      <template v-if="question.inputType === 'text'">
        <v-input
          v-model="textValue"
          placeholder="Type your answer..."
          @keydown.enter="submit"
        />
      </template>

      <!-- Select from options -->
      <template v-else-if="question.inputType === 'select'">
        <v-select
          v-model="selectValue"
          :items="selectItems"
          placeholder="Select an option..."
        />
      </template>

      <!-- Collection picker -->
      <template v-else-if="question.inputType === 'collection'">
        <v-select
          v-model="collectionValue"
          :items="collectionItems"
          item-text="name"
          item-value="collection"
          placeholder="Select a collection..."
        />
      </template>

      <!-- Field picker -->
      <template v-else-if="question.inputType === 'field'">
        <v-select
          v-model="fieldValue"
          :items="fieldItems"
          item-text="name"
          item-value="field"
          placeholder="Select a field..."
          :disabled="!question.context?.collection"
        />
      </template>
    </div>

    <div class="actions">
      <v-button secondary small @click="emit('skip')">Skip</v-button>
      <v-button small :disabled="!hasValue" @click="submit">
        <v-icon name="send" />
        Submit
      </v-button>
    </div>
  </div>
</template>
```

### Script Implementation

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useStores } from '@directus/extensions-sdk';
import type { Question } from '../types';

const props = defineProps<{
  question: Question;
}>();

const emit = defineEmits<{
  answer: [value: string];
  skip: [];
}>();

// Input values for each type
const textValue = ref('');
const selectValue = ref<string | null>(null);
const collectionValue = ref<string | null>(null);
const fieldValue = ref<string | null>(null);

// Get stores for collection/field pickers
const { useCollectionsStore, useFieldsStore } = useStores();
const collectionsStore = useCollectionsStore();
const fieldsStore = useFieldsStore();

// Build select items from question.options
const selectItems = computed(() =>
  props.question.options?.map(opt => ({ text: opt, value: opt })) ?? []
);

// Get all user collections (exclude system)
const collectionItems = computed(() =>
  collectionsStore.collections
    .filter(c => !c.collection.startsWith('directus_'))
    .map(c => ({
      collection: c.collection,
      name: c.name || c.collection
    }))
);

// Get fields for selected collection
const fieldItems = computed(() => {
  const collection = props.question.context?.collection;
  if (!collection) return [];

  return fieldsStore.fields
    .filter(f => f.collection === collection && !f.meta?.hidden)
    .map(f => ({
      field: f.field,
      name: f.name || f.field,
      type: f.type
    }));
});

// Check if user has entered a value
const hasValue = computed(() => {
  switch (props.question.inputType) {
    case 'text': return textValue.value.trim().length > 0;
    case 'select': return selectValue.value !== null;
    case 'collection': return collectionValue.value !== null;
    case 'field': return fieldValue.value !== null;
    default: return false;
  }
});

// Get current value based on input type
const currentValue = computed(() => {
  switch (props.question.inputType) {
    case 'text': return textValue.value.trim();
    case 'select': return selectValue.value ?? '';
    case 'collection': return collectionValue.value ?? '';
    case 'field': return fieldValue.value ?? '';
    default: return '';
  }
});

function submit() {
  if (!hasValue.value) return;
  emit('answer', currentValue.value);

  // Reset values
  textValue.value = '';
  selectValue.value = null;
  collectionValue.value = null;
  fieldValue.value = null;
}
</script>
```

### Styles

```vue
<style scoped>
.question-input {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--theme--background-subdued);
  border-radius: var(--theme--border-radius);
  border: var(--theme--border-width) solid var(--theme--border-color);
}

.question-text {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-weight: 500;
  color: var(--theme--foreground);
}

.question-text .v-icon {
  color: var(--theme--primary);
  flex-shrink: 0;
}

.input-area {
  /* Input takes full width */
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
```

### Usage in ChatPanel

```vue
<template>
  <div class="chat-panel">
    <!-- Messages -->
    <div class="messages">
      <ChatMessage v-for="msg in messages" :key="msg.id" :message="msg" />
    </div>

    <!-- Question input (when AI asks) -->
    <QuestionInput
      v-if="pendingQuestion"
      :question="pendingQuestion"
      @answer="onQuestionAnswer"
      @skip="onQuestionSkip"
    />

    <!-- Regular chat input (when no pending question) -->
    <div v-else class="chat-input">
      <v-input v-model="userInput" placeholder="Describe your interface..." />
      <v-button @click="send" :disabled="!userInput.trim()">Send</v-button>
    </div>
  </div>
</template>
```

---

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

## /ai/chat API Contract

### Endpoint

`POST /ai/chat` - Server-Sent Events (SSE) stream

### Request Body

```ts
interface ChatRequest {
  // Provider/model selection (discriminated union)
  provider: 'openai' | 'anthropic';
  model: string;  // e.g., 'claude-sonnet-4-5', 'gpt-5-mini'

  // Message history (UIMessage[] from @ai-sdk/vue)
  messages: UIMessage[];

  // Tools to enable
  tools: Array<string | {
    name: string;
    description: string;
    inputSchema: JSONSchema7;  // JSON Schema Draft-7
  }>;

  // Optional: per-tool approval modes
  toolApprovals?: Record<string, 'always' | 'ask' | 'disabled'>;
}
```

**Provider Models:**
- `anthropic`: `claude-sonnet-4-5`, `claude-haiku-4-5`, `claude-opus-4-1`
- `openai`: `gpt-5`, `gpt-5-nano`, `gpt-5-mini`, `gpt-5-pro`

### Response (SSE Stream)

Uses AI SDK's `pipeUIMessageStreamToResponse()` - standard stream format:

```
data: {"type":"text-delta","textDelta":"Hello"}
data: {"type":"tool-call","toolCallId":"abc","toolName":"write_file","args":{...}}
data: {"type":"tool-result","toolCallId":"abc","result":{...}}
data: {"type":"finish","..."}
data: {"type":"data-usage","data":{"inputTokens":100,"outputTokens":50,"totalTokens":150}}
```

### Tool Call Flow

1. **Server-side tools** (string names like `'items'`, `'schema'`) - executed on server
2. **Custom tools** (object with schema) - executed client-side via `onToolCall` callback

For our extension builder, all tools are custom/local - server just routes tool calls back to client.

### Client Usage with @ai-sdk/vue

```ts
import { Chat, DefaultChatTransport, type UIMessage } from 'ai';
import { z } from 'zod';

// Convert Zod schema to JSON Schema for API
const toApiTool = (tool: ToolDefinition) => ({
  name: tool.name,
  description: tool.description,
  inputSchema: z.toJSONSchema(tool.inputSchema, { target: 'draft-7' }),
});

const chat = new Chat<UIMessage>({
  transport: new DefaultChatTransport({
    api: '/ai/chat',
    credentials: 'include',
    body: () => ({
      provider: selectedModel.provider,
      model: selectedModel.model,
      tools: localTools.map(toApiTool),
      toolApprovals: {
        // Auto-approve all local tools
        ...Object.fromEntries(localTools.map(t => [t.name, 'always'])),
      },
    }),
  }),
  onToolCall: async ({ toolCall }) => {
    // Find and execute local tool
    const tool = localTools.find(t => t.name === toolCall.toolName);
    if (!tool) throw new Error(`Unknown tool: ${toolCall.toolName}`);

    try {
      const output = await tool.execute(toolCall.input);
      chat.addToolResult({
        tool: toolCall.toolName,
        output,
        toolCallId: toolCall.toolCallId
      });
    } catch (e) {
      chat.addToolResult({
        tool: toolCall.toolName,
        state: 'output-error',
        errorText: e.message,
        toolCallId: toolCall.toolCallId,
      });
    }
  },
  // Auto-continue when tool results are added
  sendAutomaticallyWhen: ({ messages }) =>
    lastAssistantMessageIsCompleteWithToolCalls({ messages }),
});

// Send a message
chat.sendMessage({ text: 'Create a color picker interface' });

// Reactive state
const messages = computed(() => chat.messages);
const status = computed(() => chat.status);  // 'idle' | 'streaming' | 'submitted'
const error = computed(() => chat.error);
```

### UIMessage Structure

```ts
interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
}

type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown; state: ToolState }
  | { type: 'tool-result'; toolCallId: string; result: unknown };

type ToolState =
  | 'call'           // Tool was called
  | 'result'         // Result received
  | 'output-available'
  | 'output-error'
  | 'approval-requested'  // Waiting for user approval
  | 'approved'
  | 'denied';
```

### Key Behaviors

1. **System prompt**: Server uses global `ai_system_prompt` from settings. We prepend context to first user message.

2. **Tool execution loop**: Chat SDK auto-sends when `sendAutomaticallyWhen` condition met (after tool results added).

3. **Message limit**: Server has 10-step limit (`stepCountIs(10)`) to prevent runaway loops.

4. **Streaming**: Response is SSE - parts arrive incrementally. Access via reactive `chat.messages`.

5. **Error handling**: Use `chat.error` for stream errors, `output-error` state for tool execution errors.

---

## Reviewer Feedback (Already Addressed)

From code review:
- [ ] Clear `runtimeError` on new component in PreviewPanel
- [ ] Extract shared `AiExtension` type to `types.ts`
- [ ] Use stable preview slug or cleanup before recompile
- [ ] Fetch actual field data for preview

---

## Next Steps

### Pre-Implementation (Design Refinement) ✅

1. ~~**Refine system prompt** - Expand with rich component examples, props/emit patterns, common UI patterns~~ ✅
2. ~~**Define type definitions** - Create `types.ts` with `Question`, `ExtensionConfig`, `AiExtension`, tool I/O types~~ ✅
3. ~~**Spec QuestionInput component** - Define props, emits, UI for each input_type (text, select, collection, field)~~ ✅
4. ~~**Document /ai/chat contract** - Request/response structure, tool call flow, streaming behavior~~ ✅

### Implementation

5. Rewrite `use-ai-generation.ts` with Chat instance + tool definitions
6. Add QuestionInput component for structured discovery
7. Add options preview section to PreviewPanel
8. Wire up SDK externalization in compiler
9. Address reviewer feedback items (runtimeError clear, shared types, field data fetch)
10. Test end-to-end with actual AI
