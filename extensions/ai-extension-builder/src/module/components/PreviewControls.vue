<script setup lang="ts">
import { useStores } from '@directus/extensions-sdk';
import { computed } from 'vue';

const props = defineProps<{
	collection: string | null;
	item: string | null;
	field: string | null;
}>();

defineEmits<{
	'update:collection': [value: string | null];
	'update:item': [value: string | null];
	'update:field': [value: string | null];
}>();

const { useCollectionsStore, useFieldsStore } = useStores();
const collectionsStore = useCollectionsStore();
const fieldsStore = useFieldsStore();

const collectionItems = computed(() => {
	return collectionsStore.collections
		.filter((c: { collection: string; meta?: { hidden?: boolean } }) => !c.collection.startsWith('directus_') && !c.meta?.hidden)
		.map((c: { collection: string; name?: string }) => ({
			text: c.name || c.collection,
			value: c.collection,
		}));
});

const fieldItems = computed(() => {
	if (!props.collection) return [];

	return fieldsStore.getFieldsForCollection(props.collection)
		.filter((f: { meta?: { hidden?: boolean } }) => !f.meta?.hidden)
		.map((f: { field: string; name?: string }) => ({
			text: f.name || f.field,
			value: f.field,
		}));
});
</script>

<template>
	<div class="preview-controls">
		<div class="control-group">
			<label>Collection</label>
			<v-select
				:model-value="collection"
				:items="collectionItems"
				placeholder="Select collection..."
				@update:model-value="$emit('update:collection', $event)"
			/>
		</div>

		<div class="control-group">
			<label>Item</label>
			<interface-collection-item-dropdown
				:value="item"
				:selected-collection="collection"
				:disabled="!collection"
				placeholder="Select item..."
				@input="$emit('update:item', $event)"
			/>
		</div>

		<div class="control-group">
			<label>Field</label>
			<v-select
				:model-value="field"
				:items="fieldItems"
				:disabled="!collection"
				placeholder="Select field..."
				@update:model-value="$emit('update:field', $event)"
			/>
		</div>
	</div>
</template>

<style scoped>
.preview-controls {
	container-type: inline-size;
	display: flex;
	flex-wrap: wrap;
	gap: 12px;
	padding: 12px;
	background: var(--theme--background-subdued);
	border: var(--theme--border-width) solid var(--theme--border-color);
	border-radius: var(--theme--border-radius);
}

.control-group {
	flex: 1 1 150px;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.control-group label {
	font-size: 12px;
	font-weight: 600;
	color: var(--theme--foreground-subdued);
}

@container (max-width: 400px) {
	.control-group {
		flex-basis: 100%;
	}
}
</style>
