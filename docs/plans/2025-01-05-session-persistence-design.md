# Session Persistence Design

Persist AI chat sessions to enable restoring and iterating on extensions.

## Data Model

`ai_extensions` collection already has:
- `files` (json) - virtual filesystem
- `extension_config` (json) - types, group, options
- `messages` (json) - **new field, stores UIMessage[]**

## Routes

```ts
export const routes = [
  { path: '', redirect: '+' },
  { path: '+', component: BuilderView },
  { path: ':id', component: BuilderView, props: true },
];
```

## Flow

### New Session (`/ai-extension-builder/+`)

1. User arrives → empty state, no record
2. User sends messages, AI responds
3. AI calls `set_config` → first save:
   - POST `/items/ai_extensions` with files, config, messages
   - Router navigates to `/ai-extension-builder/:id`
4. Subsequent changes → 2s debounced PATCH

### Existing Session (`/ai-extension-builder/:id`)

1. Fetch record (files, config, messages)
2. Populate `useAiGeneration` state via `initialize()`
3. User sees message history
4. First new message gets continuation prompt prepended
5. Changes → 2s debounced auto-save

## Message Serialization

**Saving:** Strip system prompt from first user message before storing.

```ts
function serializeMessages(messages: UIMessage[]): UIMessage[] {
  return messages.map((msg, idx) => {
    if (idx === 0 && msg.role === 'user') {
      return {
        ...msg,
        parts: msg.parts.map(part =>
          part.type === 'text'
            ? { ...part, text: extractUserContent(part.text) }
            : part
        )
      };
    }
    return msg;
  });
}
```

**Restoring:** Load raw messages, inject continuation prompt on first new message.

## Continuation Prompt

Condensed prompt (~50 lines) for restored sessions:

```ts
const CONTINUATION_PROMPT = `You are continuing work on a Directus interface extension.

## Tools
write_file, read_file, rename_file, delete_file, list_files, ask_question,
get_field_schema, get_collection_fields, set_config, request_preview, show_status

## Components
v-input, v-textarea, v-select, v-checkbox, v-button, v-icon, v-slider,
v-date-picker, v-menu, v-dialog, v-card, v-list, v-chip, v-notice,
v-progress-circular, v-skeleton-loader, v-divider

## CSS Variables
--theme--primary, --theme--foreground, --theme--background, --theme--border-radius,
--theme--border-color, --theme--danger, --theme--success, --content-padding,
--fast, --medium, --slow

## Reminders
- Emit 'input' to update field value
- Use CSS variables, never hardcode colors
- Use scoped styles

## Anti-Patterns
- Don't build what Directus provides
- Don't use inline styles with hardcoded colors
- Don't ignore the disabled prop
- Don't forget null handling
- Don't create components >300 lines
`;
```

## Implementation Changes

### `useAiGeneration` composable

New methods:
- `initialize(data: { files, config, messages })` - restore state from API
- `getSerializedMessages()` - get messages without system prompt

New state:
- `isRestoredSession` flag for continuation prompt injection

### New `useAutoSave` composable

```ts
function useAutoSave(options: {
  extensionId: Ref<string | null>;
  files: Ref<Record<string, string>>;
  config: Ref<ExtensionConfig | null>;
  messages: Ref<UIMessage[]>;
}) {
  // Watch all three with 2s debounce
  // On change: PATCH /items/ai_extensions/:id
  // Returns: isSaving, lastSaved, error
}
```

### `BuilderView` changes

- Accept `id` prop (undefined for `/+`)
- On mount: if `id`, fetch and call `initialize()`
- Watch for `set_config` tool call → if no `id`, POST create + redirect
- Wire up `useAutoSave` after record exists

## Unresolved Questions

None.