# AI Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace stub AI generation with real AI-powered interface generation using Directus `/ai/chat` endpoint and custom tools.

**Architecture:** Chat-based composable uses `@ai-sdk/vue` Chat class with local tool definitions. Tools manipulate virtual filesystem, ask discovery questions, and trigger preview compilation. BuilderView coordinates state between ChatPanel, PreviewPanel, and the composable.

**Tech Stack:** Vue 3, TypeScript, Zod, @ai-sdk/vue (Chat, DefaultChatTransport), vue3-sfc-loader

---

## Task 1: Create Schemas File

**Files:**
- Create: `extensions/ai-extension-builder/src/module/schemas.ts`

**Step 1: Create Zod schemas for tools and config**

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

**Step 2: Verify file compiles**

Run: `pnpm build`
Expected: Build succeeds with no TypeScript errors

**Step 3: Commit**

```bash
git add extensions/ai-extension-builder/src/module/schemas.ts
git commit -m "feat(ai-builder): add Zod schemas for tools"
```

---

## Task 2: Create Types File

**Files:**
- Create: `extensions/ai-extension-builder/src/module/types.ts`

**Step 1: Create shared type definitions**

```ts
// types.ts
import type { ComputedRef, Ref } from 'vue';
import type { UIMessage } from 'ai';
import type { ExtensionConfig, RequestPreviewOutput } from './schemas';

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
  files: Ref<Record<string, string>>;
  config: Ref<ExtensionConfig | null>;
  pendingQuestion: Ref<Question | null>;
  statusMessage: Ref<{ message: string; type: 'info' | 'success' | 'warning' } | null>;
}

/**
 * Callbacks passed to useAiGeneration
 */
export interface AiGenerationCallbacks {
  onPreview: () => Promise<RequestPreviewOutput>;
}

/**
 * Tool definition for local tools
 */
export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: import('zod').ZodType<TInput>;
  execute: (input: TInput) => Promise<TOutput>;
}
```

**Step 2: Verify file compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add extensions/ai-extension-builder/src/module/types.ts
git commit -m "feat(ai-builder): add shared type definitions"
```

---

## Task 3: Create System Prompt Constant

**Files:**
- Create: `extensions/ai-extension-builder/src/module/constants/system-prompt.ts`

**Step 1: Create system prompt file**

```ts
// constants/system-prompt.ts
export const SYSTEM_PROMPT = `You are an AI assistant that generates Directus interface extensions. Users describe what they want, you ask clarifying questions to understand requirements, then generate Vue 3 SFCs that integrate seamlessly with Directus.

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
| primaryKey | string | number | Item's primary key |
| width | 'half' | 'half-right' | 'full' | 'fill' | Layout width |
| type | string | Field type |

Interfaces emit:
- \`@input(newValue)\` - Update the field value
- \`@setFieldValue({ field, value })\` - Set another field's value

\`\`\`vue
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
\`\`\`

## Available Imports

\`\`\`ts
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
\`\`\`

## Component Catalog

### Form Inputs (Core)

**v-input** - Text/number input
\`\`\`vue
<v-input
  :model-value="value"
  @update:model-value="emit('input', $event)"
  type="text"
  placeholder="Enter..."
  :disabled="disabled"
  :nullable="true"
  small
/>
\`\`\`

**v-textarea** - Multi-line text
\`\`\`vue
<v-textarea
  :model-value="value"
  @update:model-value="emit('input', $event)"
  placeholder="Description..."
  :disabled="disabled"
  expand-on-focus
/>
\`\`\`

**v-select** - Dropdown select
\`\`\`vue
<v-select
  :model-value="value"
  @update:model-value="emit('input', $event)"
  :items="[{ text: 'Option 1', value: 'opt1' }]"
  placeholder="Select..."
  :disabled="disabled"
/>
\`\`\`

**v-checkbox** - Boolean toggle
\`\`\`vue
<v-checkbox
  :model-value="value"
  @update:model-value="emit('input', $event)"
  label="Enable feature"
  :disabled="disabled"
/>
\`\`\`

**v-slider** - Range slider
\`\`\`vue
<v-slider
  :model-value="value"
  @update:model-value="emit('input', $event)"
  :min="0" :max="100" :step="5"
  show-thumb-label
/>
\`\`\`

### Display Elements

**v-icon** - Material icons
\`\`\`vue
<v-icon name="check" />
<v-icon name="delete" color="var(--theme--danger)" />
\`\`\`

**v-button** - Action button
\`\`\`vue
<v-button @click="action">Default</v-button>
<v-button kind="danger">Delete</v-button>
<v-button secondary>Secondary</v-button>
\`\`\`

**v-chip** - Compact tag
\`\`\`vue
<v-chip>Tag</v-chip>
<v-chip close @close="remove">Removable</v-chip>
\`\`\`

**v-notice** - Alert message
\`\`\`vue
<v-notice type="warning">Warning message</v-notice>
\`\`\`

## CSS Variables

Always use CSS variables - never hardcode colors:

\`\`\`css
--theme--primary
--theme--foreground
--theme--foreground-subdued
--theme--background
--theme--background-subdued
--theme--danger
--theme--success
--theme--warning
--theme--border-radius
--theme--border-width
--theme--border-color
--content-padding
--fast (125ms)
--medium (200ms)
\`\`\`

## Quality Rules

- Components MUST be <300 lines
- Use \`defineProps<{ ... }>()\` with TypeScript
- Use \`defineEmits<{ event: [arg: type] }>()\`
- NEVER mutate props directly
- ALWAYS use CSS variables for colors
- NEVER hardcode color values
- Use \`scoped\` styles

## Field Types Reference

Valid types for InterfaceConfig.types:
- \`string\`, \`text\`, \`integer\`, \`bigInteger\`, \`float\`, \`decimal\`
- \`boolean\`, \`json\`, \`uuid\`, \`hash\`, \`csv\`
- \`dateTime\`, \`date\`, \`time\`, \`timestamp\`, \`geometry\`
`;
```

**Step 2: Verify file compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add extensions/ai-extension-builder/src/module/constants/system-prompt.ts
git commit -m "feat(ai-builder): add system prompt constant"
```

---

## Task 4: Rewrite use-ai-generation Composable

**Files:**
- Modify: `extensions/ai-extension-builder/src/module/composables/use-ai-generation.ts`

**Step 1: Import dependencies and define tool helpers**

```ts
// use-ai-generation.ts
import { useStores } from '@directus/extensions-sdk';
import {
  Chat,
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from 'ai';
import { computed, ref, type Ref } from 'vue';
import { z } from 'zod';
import { SYSTEM_PROMPT } from '../constants/system-prompt';
import {
  AskQuestionInputSchema,
  DeleteFileInputSchema,
  ExtensionConfigSchema,
  GetCollectionFieldsInputSchema,
  GetFieldSchemaInputSchema,
  ListFilesInputSchema,
  ReadFileInputSchema,
  RenameFileInputSchema,
  RequestPreviewInputSchema,
  SetConfigInputSchema,
  ShowStatusInputSchema,
  WriteFileInputSchema,
  type ExtensionConfig,
  type RequestPreviewOutput,
} from '../schemas';
import type { Question, ToolDefinition, UseAiGenerationReturn } from '../types';

// Convert Zod schema to JSON Schema for API
function toApiTool(tool: ToolDefinition) {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: z.toJSONSchema(tool.inputSchema, { target: 'draft-7' }),
  };
}

interface UseAiGenerationOptions {
  onPreview: () => Promise<RequestPreviewOutput>;
}

export function useAiGeneration(options: UseAiGenerationOptions): UseAiGenerationReturn {
  const { useFieldsStore, useRelationsStore } = useStores();
  const fieldsStore = useFieldsStore();
  const relationsStore = useRelationsStore();

  // State
  const files = ref<Record<string, string>>({});
  const config = ref<ExtensionConfig | null>(null);
  const pendingQuestion = ref<Question | null>(null);
  const statusMessage = ref<{ message: string; type: 'info' | 'success' | 'warning' } | null>(null);

  // Question resolution
  let resolveQuestion: ((answer: string) => void) | null = null;

  function answerQuestion(answer: string) {
    pendingQuestion.value = null;
    resolveQuestion?.(answer);
    resolveQuestion = null;
  }

  function skipQuestion() {
    answerQuestion('(skipped)');
  }

  // Tool definitions
  const tools: ToolDefinition[] = [
    {
      name: 'write_file',
      description: 'Create or overwrite a file in the virtual filesystem',
      inputSchema: WriteFileInputSchema,
      execute: async (input) => {
        files.value = { ...files.value, [input.path]: input.content };
        return { success: true };
      },
    },
    {
      name: 'read_file',
      description: 'Read a file from the virtual filesystem',
      inputSchema: ReadFileInputSchema,
      execute: async (input) => {
        const content = files.value[input.path];
        if (content === undefined) {
          return { error: 'File not found' };
        }
        return { content };
      },
    },
    {
      name: 'rename_file',
      description: 'Rename or move a file',
      inputSchema: RenameFileInputSchema,
      execute: async (input) => {
        const content = files.value[input.from];
        if (content === undefined) {
          return { error: 'File not found' };
        }
        const newFiles = { ...files.value };
        delete newFiles[input.from];
        newFiles[input.to] = content;
        files.value = newFiles;
        return { success: true };
      },
    },
    {
      name: 'delete_file',
      description: 'Delete a file from the virtual filesystem',
      inputSchema: DeleteFileInputSchema,
      execute: async (input) => {
        if (files.value[input.path] === undefined) {
          return { error: 'File not found' };
        }
        const newFiles = { ...files.value };
        delete newFiles[input.path];
        files.value = newFiles;
        return { success: true };
      },
    },
    {
      name: 'list_files',
      description: 'List all files in the virtual filesystem',
      inputSchema: ListFilesInputSchema,
      execute: async () => {
        return { files: Object.keys(files.value) };
      },
    },
    {
      name: 'ask_question',
      description: 'Ask the user a clarifying question',
      inputSchema: AskQuestionInputSchema,
      execute: async (input) => {
        const question: Question = {
          question: input.question,
          inputType: input.input_type ?? 'text',
          options: input.options,
          context: input.context,
        };
        pendingQuestion.value = question;

        return new Promise<{ answer: string }>((resolve) => {
          resolveQuestion = (answer) => resolve({ answer });
        });
      },
    },
    {
      name: 'get_field_schema',
      description: 'Get field type, constraints, and relations for a field',
      inputSchema: GetFieldSchemaInputSchema,
      execute: async (input) => {
        const field = fieldsStore.getField(input.collection, input.field);
        if (!field) {
          return { error: 'Field not found' };
        }
        const relation = relationsStore.relations.find(
          (r) => r.collection === input.collection && r.field === input.field
        );
        return {
          type: field.type,
          schema: field.schema ?? {},
          meta: field.meta ?? {},
          ...(relation && { relation }),
        };
      },
    },
    {
      name: 'get_collection_fields',
      description: 'List all fields in a collection',
      inputSchema: GetCollectionFieldsInputSchema,
      execute: async (input) => {
        const collectionFields = fieldsStore.getFieldsForCollection(input.collection);
        return {
          fields: collectionFields.map((f) => ({
            field: f.field,
            type: f.type,
            name: f.name || f.field,
          })),
        };
      },
    },
    {
      name: 'set_config',
      description: 'Set the interface configuration (name, icon, types, etc.)',
      inputSchema: SetConfigInputSchema,
      execute: async (input) => {
        const parsed = ExtensionConfigSchema.safeParse(input);
        if (!parsed.success) {
          return { error: parsed.error.message };
        }
        config.value = parsed.data;
        return { success: true };
      },
    },
    {
      name: 'request_preview',
      description: 'Trigger compilation and check for errors',
      inputSchema: RequestPreviewInputSchema,
      execute: async (input) => {
        if (input.message) {
          statusMessage.value = { message: input.message, type: 'info' };
        }
        return options.onPreview();
      },
    },
    {
      name: 'show_status',
      description: 'Display a status message to the user',
      inputSchema: ShowStatusInputSchema,
      execute: async (input) => {
        statusMessage.value = { message: input.message, type: input.type ?? 'info' };
        return { success: true };
      },
    },
  ];

  // Track if first message (for system prompt injection)
  let isFirstMessage = true;

  // Chat instance
  const chat = new Chat<UIMessage>({
    transport: new DefaultChatTransport({
      api: '/ai/chat',
      credentials: 'include',
      body: () => ({
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
        tools: tools.map(toApiTool),
        toolApprovals: Object.fromEntries(tools.map((t) => [t.name, 'always'])),
      }),
    }),
    onToolCall: async ({ toolCall }) => {
      const tool = tools.find((t) => t.name === toolCall.toolName);
      if (!tool) {
        chat.addToolResult({
          tool: toolCall.toolName,
          state: 'output-error',
          errorText: `Unknown tool: ${toolCall.toolName}`,
          toolCallId: toolCall.toolCallId,
        });
        return;
      }

      try {
        const output = await tool.execute(toolCall.input as never);
        chat.addToolResult({
          tool: toolCall.toolName,
          output,
          toolCallId: toolCall.toolCallId,
        });
      } catch (e) {
        chat.addToolResult({
          tool: toolCall.toolName,
          state: 'output-error',
          errorText: e instanceof Error ? e.message : String(e),
          toolCallId: toolCall.toolCallId,
        });
      }
    },
    sendAutomaticallyWhen: ({ messages: msgs }) =>
      lastAssistantMessageIsCompleteWithToolCalls({ messages: msgs }),
  });

  // Public API
  const messages = computed(() =>
    chat.messages.map((msg) => ({
      ...msg,
      parts: [...(msg.parts ?? [])],
    }))
  );

  const status = computed(() => chat.status as 'idle' | 'streaming' | 'submitted' | 'error');
  const error = computed(() => chat.error);

  function send(text: string) {
    let messageText = text;

    // Prepend system prompt to first message
    if (isFirstMessage) {
      messageText = `[System Context]\n${SYSTEM_PROMPT}\n\n[User Request]\n${text}`;
      isFirstMessage = false;
    }

    chat.sendMessage({ text: messageText });
  }

  function stop() {
    chat.stop();
  }

  function retry() {
    chat.clearError();
    chat.regenerate();
  }

  function reset() {
    chat.clearError();
    chat.messages.splice(0, chat.messages.length);
    files.value = {};
    config.value = null;
    pendingQuestion.value = null;
    statusMessage.value = null;
    isFirstMessage = true;
  }

  return {
    messages,
    send,
    status,
    error,
    stop,
    retry,
    reset,
    files,
    config,
    pendingQuestion,
    statusMessage,
    answerQuestion,
    skipQuestion,
  } as UseAiGenerationReturn & { answerQuestion: typeof answerQuestion; skipQuestion: typeof skipQuestion };
}
```

**Step 2: Verify file compiles**

Run: `pnpm build`
Expected: Build succeeds (may have warnings about unused types, that's ok)

**Step 3: Commit**

```bash
git add extensions/ai-extension-builder/src/module/composables/use-ai-generation.ts
git commit -m "feat(ai-builder): rewrite composable with Chat + tools"
```

---

## Task 5: Create QuestionInput Component

**Files:**
- Create: `extensions/ai-extension-builder/src/module/components/QuestionInput.vue`

**Step 1: Create QuestionInput component**

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

<script setup lang="ts">
import { useStores } from '@directus/extensions-sdk';
import { computed, ref } from 'vue';
import type { Question } from '../types';

defineProps<{
  question: Question;
}>();

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
  props.question.options?.map((opt) => ({ text: opt, value: opt })) ?? []
);

// Get all user collections (exclude system)
const collectionItems = computed(() =>
  collectionsStore.collections
    .filter((c: { collection: string }) => !c.collection.startsWith('directus_'))
    .map((c: { collection: string; name?: string }) => ({
      collection: c.collection,
      name: c.name || c.collection,
    }))
);

// Get fields for selected collection
const fieldItems = computed(() => {
  const collection = props.question.context?.collection;
  if (!collection) return [];

  return fieldsStore.fields
    .filter((f: { collection: string; meta?: { hidden?: boolean } }) =>
      f.collection === collection && !f.meta?.hidden
    )
    .map((f: { field: string; name?: string; type: string }) => ({
      field: f.field,
      name: f.name || f.field,
      type: f.type,
    }));
});

// Check if user has entered a value
const hasValue = computed(() => {
  switch (props.question.inputType) {
    case 'text':
      return textValue.value.trim().length > 0;
    case 'select':
      return selectValue.value !== null;
    case 'collection':
      return collectionValue.value !== null;
    case 'field':
      return fieldValue.value !== null;
    default:
      return false;
  }
});

// Get current value based on input type
const currentValue = computed(() => {
  switch (props.question.inputType) {
    case 'text':
      return textValue.value.trim();
    case 'select':
      return selectValue.value ?? '';
    case 'collection':
      return collectionValue.value ?? '';
    case 'field':
      return fieldValue.value ?? '';
    default:
      return '';
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

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
```

**Step 2: Verify file compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add extensions/ai-extension-builder/src/module/components/QuestionInput.vue
git commit -m "feat(ai-builder): add QuestionInput component"
```

---

## Task 6: Update ChatPanel for UIMessage + QuestionInput

**Files:**
- Modify: `extensions/ai-extension-builder/src/module/components/ChatPanel.vue`

**Step 1: Update ChatPanel to use UIMessage and QuestionInput**

```vue
<template>
  <div class="chat-panel">
    <div ref="messagesContainer" class="messages">
      <div
        v-for="message in messages"
        :key="message.id"
        :class="['message', message.role]"
      >
        <div class="message-content">
          <template v-for="(part, idx) in message.parts" :key="idx">
            <span v-if="part.type === 'text'">{{ part.text }}</span>
            <div v-else-if="part.type === 'tool-invocation'" class="tool-call">
              <v-icon name="build" small />
              <span class="tool-name">{{ part.toolName }}</span>
              <v-chip v-if="part.state === 'result'" small>done</v-chip>
              <v-progress-circular v-else-if="part.state === 'call'" indeterminate x-small />
            </div>
          </template>
        </div>
      </div>

      <div v-if="loading" class="message assistant">
        <div class="message-content">
          <v-progress-circular indeterminate small />
          Generating...
        </div>
      </div>
    </div>

    <!-- Question input (when AI asks) -->
    <QuestionInput
      v-if="pendingQuestion"
      :question="pendingQuestion"
      @answer="emit('answer', $event)"
      @skip="emit('skip')"
    />

    <!-- Regular chat input -->
    <div v-else class="input-area">
      <v-textarea
        v-model="inputText"
        :placeholder="placeholder"
        :disabled="loading"
        @keydown.enter.ctrl="onSend"
      />
      <v-button :disabled="!inputText.trim() || loading" @click="onSend">
        <v-icon name="send" />
        Send
      </v-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { UIMessage } from 'ai';
import { nextTick, ref, watch } from 'vue';
import type { Question } from '../types';
import QuestionInput from './QuestionInput.vue';

defineProps<{
  messages: UIMessage[];
  loading: boolean;
  pendingQuestion: Question | null;
}>();

const emit = defineEmits<{
  send: [content: string];
  answer: [value: string];
  skip: [];
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

watch(
  () => messagesContainer.value?.scrollHeight,
  () => {
    nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
      }
    });
  }
);
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

.tool-call {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  margin: 2px 0;
  background: var(--theme--background);
  border-radius: var(--theme--border-radius);
  font-size: 12px;
}

.tool-name {
  font-family: var(--theme--fonts--monospace--font-family);
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

**Step 2: Verify file compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add extensions/ai-extension-builder/src/module/components/ChatPanel.vue
git commit -m "feat(ai-builder): update ChatPanel for UIMessage + questions"
```

---

## Task 7: Update use-sfc-compiler for SDK Externalization

**Files:**
- Modify: `extensions/ai-extension-builder/src/module/composables/use-sfc-compiler.ts`

**Step 1: Add @directus/extensions-sdk to moduleCache**

```ts
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
```

**Step 2: Verify file compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add extensions/ai-extension-builder/src/module/composables/use-sfc-compiler.ts
git commit -m "feat(ai-builder): add SDK externalization to compiler"
```

---

## Task 8: Update PreviewPanel to Clear Runtime Errors

**Files:**
- Modify: `extensions/ai-extension-builder/src/module/components/PreviewPanel.vue`

**Step 1: Add watch to clear runtimeError on new component**

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
        <component :is="component" v-bind="props" @input="onInput" />
      </div>
    </div>

    <div v-if="lastInputValue !== undefined" class="preview-footer">
      <span class="label">Last emitted value:</span>
      <code>{{ JSON.stringify(lastInputValue) }}</code>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onErrorCaptured, ref, watch } from 'vue';

const props = defineProps<{
  component: object | null;
  props: Record<string, unknown>;
  error: Error | null;
}>();

const lastInputValue = ref<unknown>(undefined);
const runtimeError = ref<Error | null>(null);

function onInput(value: unknown) {
  lastInputValue.value = value;
}

// Clear runtime error when component changes
watch(
  () => props.component,
  () => {
    runtimeError.value = null;
    lastInputValue.value = undefined;
  }
);

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

**Step 2: Verify file compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add extensions/ai-extension-builder/src/module/components/PreviewPanel.vue
git commit -m "fix(ai-builder): clear runtime error on new component"
```

---

## Task 9: Update BuilderView to Wire Everything Together

**Files:**
- Modify: `extensions/ai-extension-builder/src/module/views/BuilderView.vue`

**Step 1: Rewrite BuilderView with new composable integration**

```vue
<script setup lang="ts">
import { useApi } from '@directus/extensions-sdk';
import { computed, ref, watch } from 'vue';
import ChatPanel from '../components/ChatPanel.vue';
import PreviewControls from '../components/PreviewControls.vue';
import PreviewPanel from '../components/PreviewPanel.vue';
import { useAiGeneration } from '../composables/use-ai-generation';
import { useExtensionInjector } from '../composables/use-extension-injector';
import { useSfcCompiler } from '../composables/use-sfc-compiler';

const api = useApi();
const { compile, compiledComponent, lastError: compileError, cleanup } = useSfcCompiler();
const { injectExtension } = useExtensionInjector();

// Preview slug - stable to avoid style orphaning
const PREVIEW_SLUG = 'preview';

// AI generation composable
const {
  messages,
  send,
  status,
  files,
  config,
  pendingQuestion,
  statusMessage,
  reset,
  answerQuestion,
  skipQuestion,
} = useAiGeneration({
  onPreview: async () => {
    if (!files.value['index.vue']) {
      return { success: false, error: 'No index.vue file found' };
    }
    cleanup(PREVIEW_SLUG);
    const { error } = await compile(files.value, 'index.vue', PREVIEW_SLUG);
    return error ? { success: false, error: error.message } : { success: true };
  },
});

// Preview context
const selectedCollection = ref<string | null>(null);
const selectedItem = ref<string | null>(null);
const selectedField = ref<string | null>(null);

const previewProps = computed(() => ({
  value: null,
  collection: selectedCollection.value,
  field: selectedField.value,
  primaryKey: selectedItem.value,
}));

const isLoading = computed(() => status.value === 'streaming' || status.value === 'submitted');
const canSave = computed(() => config.value !== null);
const canPublish = computed(() => config.value !== null && !compileError.value);

// Auto-compile on file changes
watch(
  files,
  async (newFiles) => {
    if (newFiles['index.vue']) {
      cleanup(PREVIEW_SLUG);
      await compile(newFiles, 'index.vue', PREVIEW_SLUG);
    }
  },
  { deep: true }
);

function onSendMessage(content: string) {
  send(content);
}

function onAnswer(answer: string) {
  answerQuestion(answer);
}

function onSkip() {
  skipQuestion();
}

async function onSaveDraft() {
  if (!config.value) return;

  const slug = `ai-${Date.now()}`;

  try {
    await api.post('/items/ai_extensions', {
      slug,
      name: config.value.name,
      type: 'interface',
      icon: config.value.icon,
      description: config.value.description,
      files: files.value,
      entry: 'index.vue',
      extension_config: {
        types: config.value.types,
        group: config.value.group,
        options: config.value.options,
      },
      status: 'draft',
    });
  } catch (error) {
    console.error('Failed to save draft:', error);
  }
}

async function onPublish() {
  if (!config.value) return;

  const slug = `ai-${Date.now()}`;

  try {
    const response = await api.post('/items/ai_extensions', {
      slug,
      name: config.value.name,
      type: 'interface',
      icon: config.value.icon,
      description: config.value.description,
      files: files.value,
      entry: 'index.vue',
      extension_config: {
        types: config.value.types,
        group: config.value.group,
        options: config.value.options,
      },
      status: 'published',
    });

    await injectExtension({
      id: response.data.data.id,
      slug,
      name: config.value.name,
      icon: config.value.icon,
      description: config.value.description,
      files: files.value,
      entry: 'index.vue',
      extension_config: {
        types: config.value.types,
        group: config.value.group,
        options: config.value.options,
      },
      status: 'published',
    });
  } catch (error) {
    console.error('Failed to publish:', error);
  }
}
</script>

<template>
  <PrivateView title="AI Extension Builder" icon="auto_fix_high">
    <template #actions>
      <v-button
        v-tooltip.bottom="'Reset'"
        rounded
        icon
        secondary
        @click="reset"
      >
        <v-icon name="refresh" />
      </v-button>
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
          :loading="isLoading"
          :pending-question="pendingQuestion"
          @send="onSendMessage"
          @answer="onAnswer"
          @skip="onSkip"
        />
        <v-notice v-if="statusMessage" :type="statusMessage.type" class="status-notice">
          {{ statusMessage.message }}
        </v-notice>
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
  </PrivateView>
</template>

<style scoped>
.builder-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--content-padding);
  height: calc(100% - var(--content-padding) * 2);
  padding: var(--content-padding);
  overflow: hidden;
}

.chat-section,
.preview-section {
  display: flex;
  flex-direction: column;
  gap: var(--content-padding);
  overflow: hidden;
}

.status-notice {
  flex-shrink: 0;
}
</style>
```

**Step 2: Verify file compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add extensions/ai-extension-builder/src/module/views/BuilderView.vue
git commit -m "feat(ai-builder): wire BuilderView to new composable"
```

---

## Task 10: Test End-to-End

**Files:**
- None (manual testing)

**Step 1: Start dev server**

Run: `pnpm dev`
Expected: Builds successfully, watches for changes

**Step 2: Start Directus**

Run: `docker compose up -d`
Expected: Directus starts at http://localhost:8055

**Step 3: Login and test**

1. Navigate to http://localhost:8055
2. Login with admin@example.com / d1r3ctu5
3. Go to AI Extension Builder module
4. Type: "Create a color picker interface with preset brand colors"
5. Verify:
   - AI responds and uses tools (write_file, set_config, request_preview)
   - Preview panel shows compiled component
   - Tool calls appear in chat with status indicators

**Step 4: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix(ai-builder): e2e testing fixes"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Create Zod schemas | `schemas.ts` |
| 2 | Create type definitions | `types.ts` |
| 3 | Create system prompt | `constants/system-prompt.ts` |
| 4 | Rewrite composable | `use-ai-generation.ts` |
| 5 | Create QuestionInput | `QuestionInput.vue` |
| 6 | Update ChatPanel | `ChatPanel.vue` |
| 7 | Update compiler | `use-sfc-compiler.ts` |
| 8 | Update PreviewPanel | `PreviewPanel.vue` |
| 9 | Update BuilderView | `BuilderView.vue` |
| 10 | End-to-end test | Manual |

All tasks follow TDD where applicable with compile verification after each step.
