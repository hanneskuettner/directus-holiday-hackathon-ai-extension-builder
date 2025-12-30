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

function onReset() {
  reset();
  cleanup(PREVIEW_SLUG);
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
  <private-view title="AI Extension Builder">
    <template #title-outer:prepend>
      <v-button class="header-icon" rounded disabled icon secondary>
        <v-icon name="auto_fix_high" />
      </v-button>
    </template>

    <template #actions>
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

.header-icon {
  --v-button-background-color: var(--theme--primary-background);
  --v-button-color: var(--theme--primary);
}
</style>
