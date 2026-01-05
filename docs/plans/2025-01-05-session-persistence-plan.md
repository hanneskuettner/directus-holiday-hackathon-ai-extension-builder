# Session Persistence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist AI chat sessions so users can restore and iterate on extensions.

**Architecture:** Add `initialize()` and `prepareMessagesForStorage()` to `useAiGeneration`, create `useAutoSave` composable for debounced persistence, update routes and `BuilderView` to handle new/existing sessions.

**Tech Stack:** Vue 3, AI SDK (`UIMessage`), Directus API, vue-router

---

### Task 1: Add Continuation Prompt Constant

**Files:**
- Create: `extensions/ai-extension-builder/src/module/constants/continuation-prompt.ts`

**Step 1: Create the continuation prompt file**

```ts
// constants/continuation-prompt.ts
export const CONTINUATION_PROMPT = `You are continuing work on a Directus interface extension.

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

**Step 2: Commit**

```bash
git add extensions/ai-extension-builder/src/module/constants/continuation-prompt.ts
git commit -m "feat(ai-builder): add continuation prompt constant"
```

---

### Task 2: Update Types

**Files:**
- Modify: `extensions/ai-extension-builder/src/module/types.ts`

**Step 1: Add methods to UseAiGenerationReturn interface**

Inside `UseAiGenerationReturn` interface, add after `skipQuestion`:

```ts
	initialize: (data: InitializeData) => void;
	prepareMessagesForStorage: () => UIMessage[];
```

**Step 2: Add new type definitions at end of file**

```ts
/**
 * Data to initialize a restored session
 */
export interface InitializeData {
	files: Record<string, string>;
	config: ExtensionConfig | null;
	messages: UIMessage[];
}

/**
 * Stored extension data from API
 */
export interface StoredExtension {
	id: string;
	slug: string;
	name: string;
	type: string;
	icon: string;
	description: string;
	files: Record<string, string>;
	entry: string;
	extension_config: {
		types: string[];
		group: string;
		options: unknown[];
	};
	messages: UIMessage[];
	status: 'draft' | 'published';
}
```

**Step 3: Commit**

```bash
git add extensions/ai-extension-builder/src/module/types.ts
git commit -m "feat(ai-builder): add session persistence types"
```

---

### Task 3: Update useAiGeneration Composable

**Files:**
- Modify: `extensions/ai-extension-builder/src/module/composables/use-ai-generation.ts`

**Step 1: Add import for continuation prompt**

After the `SYSTEM_PROMPT` import:

```ts
import { CONTINUATION_PROMPT } from '../constants/continuation-prompt';
```

**Step 2: Add helper functions after `toApiTool` function**

```ts
// Extract user content from message that may contain system prompt
function extractUserContent(text: string): string {
	const userRequestMarker = '[User Request]\n';
	const idx = text.indexOf(userRequestMarker);
	if (idx !== -1) {
		return text.slice(idx + userRequestMarker.length);
	}
	return text;
}

// Prepare messages for storage (deep clone + strip system prompt from first message)
function prepareMessagesForStorageInternal(messages: UIMessage[]): UIMessage[] {
	return messages.map((msg, idx) => {
		const cloned = structuredClone(msg);
		if (idx === 0 && cloned.role === 'user') {
			cloned.parts = (cloned.parts ?? []).map(part =>
				part.type === 'text'
					? { ...part, text: extractUserContent(part.text) }
					: part
			);
		}
		return cloned;
	});
}
```

**Step 3: Add isRestoredSession flag**

After `statusMessage` ref declaration:

```ts
	let isRestoredSession = false;
```

**Step 4: Update send() function**

Replace the `send` function body:

```ts
	function send(text: string) {
		let messageText = text;

		if (isFirstMessage) {
			if (isRestoredSession) {
				// Restored session: use condensed continuation prompt
				messageText = `[System Context]\n${CONTINUATION_PROMPT}\n\n[User Request]\n${text}`;
			} else {
				// New session: use full system prompt
				messageText = `[System Context]\n${SYSTEM_PROMPT}\n\n[User Request]\n${text}`;
			}
			isFirstMessage = false;
		}

		chat.sendMessage({ text: messageText });
	}
```

**Step 5: Add initialize() and prepareMessagesForStorage() after reset()**

```ts
	function initialize(data: { files: Record<string, string>; config: ExtensionConfig | null; messages: UIMessage[] }) {
		// Restore state
		files.value = data.files;
		config.value = data.config;

		// Restore messages to chat
		// Note: Chat class exposes messages as mutable shallowRef array
		chat.messages.splice(0, chat.messages.length, ...data.messages);

		// Mark as restored session (use continuation prompt on next send)
		isRestoredSession = true;
		isFirstMessage = true; // Will inject continuation prompt on first new message
	}

	function prepareMessagesForStorage(): UIMessage[] {
		return prepareMessagesForStorageInternal([...chat.messages]);
	}
```

**Step 6: Add to return statement**

Add `initialize` and `prepareMessagesForStorage` to the return object.

**Step 7: Commit**

```bash
git add extensions/ai-extension-builder/src/module/composables/use-ai-generation.ts
git commit -m "feat(ai-builder): add initialize/prepareMessagesForStorage to useAiGeneration"
```

---

### Task 4: Create useAutoSave Composable

**Files:**
- Create: `extensions/ai-extension-builder/src/module/composables/use-auto-save.ts`

**Step 1: Create the composable**

```ts
import type { UIMessage } from 'ai';
import type { ComputedRef, Ref } from 'vue';
import type { ExtensionConfig } from '../schemas';
import { useApi } from '@directus/extensions-sdk';
import { onUnmounted, ref, watch } from 'vue';

const AUTO_SAVE_DEBOUNCE_MS = 2000;

interface UseAutoSaveOptions {
	extensionId: Ref<string | null>;
	files: Ref<Record<string, string>>;
	config: Ref<ExtensionConfig | null>;
	messages: ComputedRef<UIMessage[]>;
	prepareMessagesForStorage: () => UIMessage[];
}

export function useAutoSave(options: UseAutoSaveOptions) {
	const { extensionId, files, config, messages, prepareMessagesForStorage } = options;
	const api = useApi();

	const isSaving = ref(false);
	const lastSaved = ref<Date | null>(null);
	const error = ref<Error | null>(null);

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	async function save() {
		if (!extensionId.value) return;

		isSaving.value = true;
		error.value = null;

		try {
			await api.patch(`/items/ai_extensions/${extensionId.value}`, {
				files: files.value,
				extension_config: config.value ? {
					types: config.value.types,
					group: config.value.group,
					options: config.value.options,
				} : null,
				messages: prepareMessagesForStorage(),
			});
			lastSaved.value = new Date();
		} catch (err) {
			error.value = err instanceof Error ? err : new Error(String(err));
			console.error('Auto-save failed:', err);
		} finally {
			isSaving.value = false;
		}
	}

	function debouncedSave() {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		debounceTimer = setTimeout(() => {
			save();
			debounceTimer = null;
		}, AUTO_SAVE_DEBOUNCE_MS);
	}

	// Watch for changes (files, config, or messages)
	watch(
		[files, config, messages],
		() => {
			if (extensionId.value) {
				debouncedSave();
			}
		},
		{ deep: true }
	);

	// Cleanup timer on unmount
	onUnmounted(() => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
	});

	return {
		isSaving,
		lastSaved,
		error,
		saveNow: save,
	};
}
```

**Step 2: Commit**

```bash
git add extensions/ai-extension-builder/src/module/composables/use-auto-save.ts
git commit -m "feat(ai-builder): add useAutoSave composable"
```

---

### Task 5: Update Module Routes

**Files:**
- Modify: `extensions/ai-extension-builder/src/module/routes.ts`
- Modify: `extensions/ai-extension-builder/src/module/index.ts`

**Step 1: Update routes.ts**

Replace entire file:

```ts
import BuilderView from './views/BuilderView.vue';

export const routes = [
	{
		path: '',
		redirect: '+',
	},
	{
		path: '+',
		name: 'ai-extension-builder-new',
		component: BuilderView,
	},
	{
		path: ':id',
		name: 'ai-extension-builder-edit',
		component: BuilderView,
		props: true,
	},
];

export default BuilderView;
```

**Step 2: Update index.ts**

Replace entire file:

```ts
import { defineModule } from '@directus/extensions-sdk';
import { routes } from './routes';
import { loadPublishedExtensions } from './utils/load-published-extensions';

export default defineModule({
	id: 'ai-extension-builder',
	name: 'AI Extension Builder',
	icon: 'auto_fix_high',
	routes,
	preRegisterCheck() {
		loadPublishedExtensions();
		return true;
	},
});
```

**Step 3: Commit**

```bash
git add extensions/ai-extension-builder/src/module/routes.ts extensions/ai-extension-builder/src/module/index.ts
git commit -m "feat(ai-builder): update routes for new/edit sessions"
```

---

### Task 6: Update BuilderView for Session Persistence

**Files:**
- Modify: `extensions/ai-extension-builder/src/module/views/BuilderView.vue`

**Step 1: Replace script block**

```ts
<script setup lang="ts">
import type { StoredExtension } from '../types';
import { useApi } from '@directus/extensions-sdk';
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import ChatPanel from '../components/ChatPanel.vue';
import PreviewControls from '../components/PreviewControls.vue';
import PreviewPanel from '../components/PreviewPanel.vue';
import { useAiGeneration } from '../composables/use-ai-generation';
import { useAutoSave } from '../composables/use-auto-save';
import { useExtensionInjector } from '../composables/use-extension-injector';
import { useSfcCompiler } from '../composables/use-sfc-compiler';
import { ExtensionConfigSchema } from '../schemas';

const props = defineProps<{
	id?: string;
}>();

const api = useApi();
const router = useRouter();
const { compile, compiledComponent, lastError: compileError, cleanup } = useSfcCompiler();
const { injectExtension } = useExtensionInjector();

// Extension ID and slug (null for new, string for existing)
const extensionId = ref<string | null>(props.id ?? null);
const extensionSlug = ref<string | null>(null);
const isLoading = ref(false);
const loadError = ref<string | null>(null);

// Preview slug
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
	initialize,
	prepareMessagesForStorage,
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

// Auto-save (only active when extensionId exists)
const { isSaving, lastSaved, error: saveError } = useAutoSave({
	extensionId,
	files,
	config,
	messages,
	prepareMessagesForStorage,
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

const isChatLoading = computed(() => status.value === 'streaming' || status.value === 'submitted');
const canPublish = computed(() => config.value !== null && !compileError.value);

// Load existing extension on mount
onMounted(async () => {
	if (props.id) {
		isLoading.value = true;
		loadError.value = null;
		try {
			const response = await api.get<{ data: StoredExtension }>(`/items/ai_extensions/${props.id}`);
			const data = response.data.data;

			// Store slug for later use
			extensionSlug.value = data.slug;

			// Convert stored config to ExtensionConfig format via Zod
			const restoredConfig = data.extension_config
				? ExtensionConfigSchema.parse({
					name: data.name,
					icon: data.icon,
					description: data.description,
					...data.extension_config,
				})
				: null;

			initialize({
				files: data.files ?? {},
				config: restoredConfig,
				messages: data.messages ?? [],
			});

			// Compile if files exist
			if (data.files?.['index.vue']) {
				await compile(data.files, 'index.vue', PREVIEW_SLUG);
			}
		} catch (err) {
			console.error('Failed to load extension:', err);
			loadError.value = 'Failed to load extension';
		} finally {
			isLoading.value = false;
		}
	}
});

// Watch for first set_config to create record and redirect
watch(config, async (newConfig, oldConfig) => {
	if (newConfig && !oldConfig && !extensionId.value) {
		// First time config is set on a new session - create record
		const slug = `ai-${Date.now()}`;

		try {
			const response = await api.post<{ data: { id: string } }>('/items/ai_extensions', {
				slug,
				name: newConfig.name,
				type: 'interface',
				icon: newConfig.icon,
				description: newConfig.description,
				files: files.value,
				entry: 'index.vue',
				extension_config: {
					types: newConfig.types,
					group: newConfig.group,
					options: newConfig.options,
				},
				// Don't save messages here - AI may still be streaming
				// Auto-save will persist messages after debounce
				status: 'draft',
			});

			extensionId.value = response.data.data.id;
			extensionSlug.value = slug;

			// Navigate to edit route
			router.replace(`/ai-extension-builder/${extensionId.value}`);
		} catch (err) {
			console.error('Failed to create extension:', err);
			loadError.value = 'Failed to create extension';
		}
	}
});

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

function onReset() {
	reset();
	cleanup(PREVIEW_SLUG);
	extensionId.value = null;
	extensionSlug.value = null;
	loadError.value = null;
	router.replace('/ai-extension-builder/+');
}

async function onPublish() {
	if (!config.value || !extensionId.value || !extensionSlug.value) return;

	try {
		await api.patch(`/items/ai_extensions/${extensionId.value}`, {
			status: 'published',
		});

		await injectExtension({
			id: extensionId.value,
			slug: extensionSlug.value,
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
	} catch (err) {
		console.error('Failed to publish:', err);
		loadError.value = 'Failed to publish extension';
	}
}
</script>
```

**Step 2: Replace template**

```vue
<template>
  <private-view title="AI Extension Builder">
    <template #title-outer:prepend>
      <v-button class="header-icon" rounded disabled icon secondary>
        <v-icon name="auto_fix_high" />
      </v-button>
    </template>

    <template #actions>
      <span v-if="isSaving" class="save-status">
        <v-progress-circular indeterminate x-small />
        Saving...
      </span>
      <span v-else-if="lastSaved" class="save-status">
        Saved
      </span>
      <v-button
        v-tooltip.bottom="'Reset'"
        rounded
        icon
        secondary
        @click="onReset"
      >
        <v-icon name="refresh" />
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
      <v-notice v-if="loadError || saveError" type="danger" class="error-notice">
        {{ loadError || saveError?.message }}
      </v-notice>

      <div class="chat-section">
        <ChatPanel
          :messages="messages"
          :loading="isChatLoading || isLoading"
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
          :preview-props="previewProps"
          :error="compileError"
        />
      </div>
    </div>
  </private-view>
</template>
```

**Step 3: Replace styles**

```vue
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

.error-notice {
  grid-column: 1 / -1;
}

.header-icon {
  --v-button-background-color: var(--theme--primary-background);
  --v-button-color: var(--theme--primary);
}

.save-status {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--theme--foreground-subdued);
  font-size: 12px;
  margin-right: 8px;
}
</style>
```

**Step 4: Commit**

```bash
git add extensions/ai-extension-builder/src/module/views/BuilderView.vue
git commit -m "feat(ai-builder): integrate session persistence in BuilderView"
```

---

### Task 7: Manual Test

**Step 1: Build**

```bash
pnpm build
```

**Step 2: Test new session flow**

1. Navigate to `/ai-extension-builder`
2. Should redirect to `/ai-extension-builder/+`
3. Send a message, get AI response
4. When AI calls `set_config`, URL should change to `/ai-extension-builder/:id`
5. Make more changes, verify "Saving..." appears after 2s

**Step 3: Test restore flow**

1. Note the ID from URL
2. Refresh the page
3. Messages should reload
4. Send new message - should work with continuation prompt

**Step 4: Test error states**

1. Disconnect network, verify error notice appears on save failure
2. Navigate to invalid ID, verify load error appears

**Step 5: Commit any fixes**

---

## Summary

Tasks:
1. Add continuation prompt constant
2. Update types
3. Update useAiGeneration (initialize, prepareMessagesForStorage)
4. Create useAutoSave composable
5. Update module routes
6. Update BuilderView
7. Manual test

## Review Fixes Applied

- **Watch messages directly** instead of `messages.value.length`
- **Don't save messages on initial create** - let auto-save handle after debounce
- **Use Zod parse** instead of `as never` casts for restored config
- **Store extensionSlug** in ref and reuse in onPublish
- **Add loadError/saveError** state with user-visible v-notice
- **Cleanup debounce timer** on unmount
- **Extract AUTO_SAVE_DEBOUNCE_MS** constant
- **Renamed to prepareMessagesForStorage** + use structuredClone
