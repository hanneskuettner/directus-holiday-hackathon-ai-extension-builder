<script setup lang="ts">
import type { UIMessage } from 'ai';
import type { Question } from '../types';
import { nextTick, ref, watch } from 'vue';
import { md } from '../utils/md';
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
	},
);
</script>

<template>
	<div class="chat-panel">
		<div ref="messagesContainer" class="messages">
			<div
				v-for="message in messages"
				:key="message.id"
				class="message" :class="[message.role]"
			>
				<div class="message-content">
					<template v-for="(part, idx) in message.parts" :key="idx">
						<span v-if="part.type === 'text'" v-html="md(part.text)" />
						<div v-else-if="part.type === 'tool-call'" class="tool-call">
							<v-icon name="build" small />
							<span class="tool-name">{{ part.toolName }}</span>
							<v-chip v-if="part.state === 'result'" small>
								done
							</v-chip>
							<v-progress-circular v-else indeterminate x-small />
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
		<div v-else class="input-wrapper">
			<v-textarea
				v-model="inputText"
				:placeholder="placeholder"
				:disabled="loading"
				@keydown.enter.ctrl="onSend"
			/>
			<v-button
				icon
				rounded
				:disabled="!inputText?.trim() || loading"
				@click="onSend"
			>
				<v-icon name="arrow_upward" />
			</v-button>
		</div>
	</div>
</template>

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
	word-break: break-word;
}

:deep(.message-content code) {
	white-space: pre-wrap;
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

.input-wrapper {
	position: relative;
	margin: 12px;
	background: var(--theme--form--field--input--background);
}

.input-wrapper :deep(.v-textarea) {
	width: 100%;
}

.input-wrapper :deep(.v-textarea .input) {
	border: none;
	background: transparent;
	padding: 0;
	min-height: 60px;
}

.input-wrapper > .v-button {
	position: absolute;
	right: 8px;
	bottom: 8px;
}
</style>
