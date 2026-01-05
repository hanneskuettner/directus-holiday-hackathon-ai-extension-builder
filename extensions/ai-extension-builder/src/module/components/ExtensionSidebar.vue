<script setup lang="ts">
import { useApi } from '@directus/extensions-sdk';
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

interface AiExtensionItem {
  id: string;
  name: string;
  icon: string;
  description: string | null;
  status: 'draft' | 'published';
}

const api = useApi();
const route = useRoute();

const extensions = ref<AiExtensionItem[]>([]);
const loading = ref(true);

const currentId = computed(() => String(route.params.id ?? ''));

async function fetchExtensions() {
  loading.value = true;
  try {
    const response = await api.get('/items/ai_extensions', {
      params: {
        sort: '-date_updated',
        fields: ['id', 'name', 'icon', 'description', 'status'],
      },
    });
    extensions.value = response.data.data;
  } catch (error) {
    console.error('Failed to fetch extensions:', error);
  } finally {
    loading.value = false;
  }
}

// Refetch on route change (covers save/publish redirect scenarios)
watch(() => route.params.id, fetchExtensions, { immediate: true });
</script>

<template>
  <div class="extension-sidebar">
    <v-button class="new-button" full-width to="/ai-extension-builder/+">
      <v-icon name="add" />
      New Extension
    </v-button>

    <v-divider />

    <div v-if="loading" class="loading">
      <v-skeleton-loader v-for="n in 3" :key="n" type="list-item-icon" />
    </div>

    <v-list v-else-if="extensions.length > 0" nav>
      <v-list-item
        v-for="ext in extensions"
        :key="ext.id"
        :to="`/ai-extension-builder/${ext.id}`"
        :active="currentId === ext.id"
      >
        <v-list-item-icon>
          <v-icon :name="ext.icon || 'extension'" />
        </v-list-item-icon>
        <v-list-item-content>
          <div class="item-header">
            <v-text-overflow class="name" :text="ext.name" />
            <v-chip
              :class="['status-badge', ext.status]"
              x-small
            >
              {{ ext.status }}
            </v-chip>
          </div>
          <div v-if="ext.description" class="description">
            {{ ext.description }}
          </div>
        </v-list-item-content>
      </v-list-item>
    </v-list>

    <div v-else class="empty-state">
      No extensions yet
    </div>
  </div>
</template>

<style scoped>
.extension-sidebar {
  padding: var(--content-padding);
}

.new-button {
  margin-bottom: var(--content-padding);
}

.loading {
  display: flex;
  flex-direction: column;
  gap: var(--theme--form--row-gap);
}

.item-header {
  display: flex;
  align-items: center;
  gap: var(--theme--form--column-gap);
}

.name {
  flex: 1;
  min-width: 0;
}

.status-badge {
  flex-shrink: 0;
}

.status-badge.draft {
  --v-chip-color: var(--theme--warning);
  --v-chip-background-color: var(--theme--warning-background);
}

.status-badge.published {
  --v-chip-color: var(--theme--success);
  --v-chip-background-color: var(--theme--success-background);
}

.description {
  color: var(--theme--foreground-subdued);
  font-size: 14px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.empty-state {
  color: var(--theme--foreground-subdued);
  text-align: center;
  padding: var(--content-padding);
}
</style>
