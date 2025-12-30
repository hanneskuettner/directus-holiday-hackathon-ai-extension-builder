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
