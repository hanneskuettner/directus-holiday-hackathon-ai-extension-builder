<script setup lang="ts">
import { onErrorCaptured, ref, toRefs, watch } from 'vue';

const props = defineProps<{
	component: object | null;
	previewProps: Record<string, unknown>;
	error: Error | null;
}>();

const { component } = toRefs(props);

const lastInputValue = ref<unknown>(undefined);
const runtimeError = ref<Error | null>(null);

function onInput(value: unknown) {
	lastInputValue.value = value;
}

// Clear runtime error when component changes
watch(
	component,
	() => {
		runtimeError.value = null;
		lastInputValue.value = undefined;
	},
);

onErrorCaptured((err) => {
	runtimeError.value = err;
	return false; // Prevent propagation
});
</script>

<template>
	<div class="preview-panel">
		<div class="preview-header">
			<span class="preview-title">Preview</span>
			<v-chip v-if="error || runtimeError" small class="error-chip">
				Error
			</v-chip>
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
				<component :is="component" v-bind="previewProps" :value="lastInputValue" @input="onInput" />
			</div>
		</div>

		<div v-if="lastInputValue !== undefined" class="preview-footer">
			<span class="label">Last emitted value:</span>
			<code>{{ JSON.stringify(lastInputValue) }}</code>
		</div>
	</div>
</template>

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
