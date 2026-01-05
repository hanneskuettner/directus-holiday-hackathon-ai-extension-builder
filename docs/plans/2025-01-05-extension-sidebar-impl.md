# Extension Sidebar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add sidebar listing of saved AI extensions to the builder module.

**Architecture:** Create `ExtensionSidebar.vue` component that fetches from `ai_extensions` collection, displays list with status badges, and integrates via `private-view`'s `#navigation` slot.

**Tech Stack:** Vue 3, Directus SDK (`useApi`), Vue Router (`useRoute`)

**Prerequisites:** Routes `/ai-extension-builder/+` and `/ai-extension-builder/:id` configured (separate session).

---

## Task 1: Create ExtensionSidebar Component

**Files:**
- Create: `extensions/ai-extension-builder/src/module/components/ExtensionSidebar.vue`

**Step 1: Create component with data fetching**

```vue
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
```

**Step 2: Verify file created**

Run: `ls extensions/ai-extension-builder/src/module/components/ExtensionSidebar.vue`
Expected: File exists

**Step 3: Commit**

```bash
git add extensions/ai-extension-builder/src/module/components/ExtensionSidebar.vue
git commit -m "feat(ai-builder): add ExtensionSidebar component"
```

---

## Task 2: Integrate Sidebar into BuilderView

**Files:**
- Modify: `extensions/ai-extension-builder/src/module/views/BuilderView.vue`

**Step 1: Import and add navigation slot**

Add import at top of script:
```typescript
import ExtensionSidebar from '../components/ExtensionSidebar.vue';
```

Add navigation slot inside `<private-view>` template (after `#actions` slot):
```vue
<template #navigation>
  <ExtensionSidebar />
</template>
```

**Step 2: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add extensions/ai-extension-builder/src/module/views/BuilderView.vue
git commit -m "feat(ai-builder): integrate sidebar into BuilderView"
```

---

## Task 3: Manual Testing

**Step 1: Start dev server**

Run: `pnpm dev`

**Step 2: Test in browser**

1. Navigate to http://localhost:8055/admin/ai-extension-builder/+
2. Verify sidebar appears on left
3. Verify "New Extension" button visible
4. Verify empty state shows "No extensions yet" (if no extensions)

**Step 3: Test with data**

1. Create an extension via the builder (or insert test data)
2. Verify extension appears in sidebar
3. Verify status badge shows correctly (draft=yellow, published=green)
4. Verify clicking extension navigates to `/ai-extension-builder/:id`
5. Verify active state highlights current extension

**Step 4: Test refresh behavior**

1. Save a draft
2. Verify sidebar list updates after redirect
3. Publish an extension
4. Verify status badge updates
