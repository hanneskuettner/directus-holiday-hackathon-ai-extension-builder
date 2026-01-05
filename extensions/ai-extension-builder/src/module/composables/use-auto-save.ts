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
