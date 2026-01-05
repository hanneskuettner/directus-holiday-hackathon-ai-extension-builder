<script setup lang="ts">
import type { StoredExtension } from '../types';
import { useApi } from '@directus/extensions-sdk';
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import ChatPanel from '../components/ChatPanel.vue';
import ExtensionSidebar from '../components/ExtensionSidebar.vue';
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

// Sidebar refresh trigger
const sidebarRefreshKey = ref(0);

// AI generation composable
const {
	messages,
	displayMessages,
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

// Load extension by ID
async function loadExtension(id: string) {
	isLoading.value = true;
	loadError.value = null;

	try {
		const response = await api.get<{ data: StoredExtension }>(`/items/ai_extensions/${id}`);
		const data = response.data.data;

		// Update extension ID and slug
		extensionId.value = id;
		extensionSlug.value = data.slug;

		// Convert stored config to ExtensionConfig format via Zod
		const restoredConfig = data.extension_config
			? ExtensionConfigSchema.parse({
					name: data.name,
					icon: data.icon,
					description: data.description,
					types: data.extension_config.types ?? [],
					group: data.extension_config.group ?? 'standard',
					options: data.extension_config.options ?? [],
				})
			: null;

		initialize({
			files: data.files ?? {},
			config: restoredConfig,
			messages: data.messages ?? [],
		});

		// Note: No need to compile here - the files watcher handles it
	}
	catch (error) {
		console.error('Failed to load extension:', error);
		loadError.value = 'Failed to load extension';
	}
	finally {
		isLoading.value = false;
	}
}

// Load on mount if ID provided
onMounted(() => {
	if (props.id) {
		loadExtension(props.id);
	}
});

// Reload when ID changes (navigating between extensions)
watch(
	() => props.id,
	(newId, oldId) => {
		if (newId && newId !== oldId) {
			// Skip reload if we just created this record (extensionId already set)
			if (extensionId.value === newId) return;

			cleanup(PREVIEW_SLUG);
			loadExtension(newId);
		} else if (!newId && oldId) {
			// Navigated to new session
			reset();
			cleanup(PREVIEW_SLUG);
			extensionId.value = null;
			extensionSlug.value = null;
		}
	}
);

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

			// Refresh sidebar to show new extension
			sidebarRefreshKey.value++;

			// Navigate to edit route
			router.replace(`/ai-extension-builder/${extensionId.value}`);
		}
		catch (error) {
			console.error('Failed to create extension:', error);
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
	{ deep: true, immediate: true },
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
	}
	catch (error) {
		console.error('Failed to publish:', error);
		loadError.value = 'Failed to publish extension';
	}
}
</script>

<template>
	<private-view title="AI Extension Builder">
		<template #title-outer:prepend>
			<v-button class="header-icon" rounded disabled icon secondary>
				<v-icon name="auto_fix_high" />
			</v-button>
		</template>

		<template #navigation>
			<ExtensionSidebar :key="sidebarRefreshKey" />
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
					:messages="displayMessages"
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
