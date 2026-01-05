# Extension Sidebar Design

## Overview

Add sidebar listing of saved extensions to the AI Extension Builder module.

## Routes (handled in separate session)

| Path | Behavior |
|------|----------|
| `/ai-extension-builder` | Redirect to `+` |
| `/ai-extension-builder/+` | New extension |
| `/ai-extension-builder/:id` | Detail view |

## Sidebar Component

**Component:** `ExtensionSidebar.vue`

**Structure:**
```
┌─────────────────────────┐
│ [+ New Extension]       │  button → /ai-extension-builder/+
├─────────────────────────┤
│ 🎨 Color Picker    🟢   │  icon, name, status badge (active state)
│ Pick colors from...     │  truncated description (muted)
├─────────────────────────┤
│ 📊 Stats Panel     🟡   │
│ Dashboard widget...     │
└─────────────────────────┘
```

**Data:**
- Endpoint: `/items/ai_extensions?sort=-date_updated&fields=id,name,icon,description,status`
- All extensions (draft + published), sorted by most recently updated

**Status badges:**
- Draft → warning color
- Published → success color

**Active state:**
- Use `useRoute().params.id` to determine current extension
- Apply `--theme--primary-background` to active item

**Empty state:**
- Show muted text: "No extensions yet"

**Refresh strategy:**
- Refetch on route change via `watch(() => route.params.id, refetch)`
- Covers: navigation between extensions, save/publish (redirects to detail route)

**Integration:** `private-view` `#navigation` slot

## BuilderView Changes

- Add `#navigation` slot with `<ExtensionSidebar />`
- Route setup and `id` prop handled in separate session

## Files to Create/Modify

| File | Action |
|------|--------|
| `components/ExtensionSidebar.vue` | Create |
| `views/BuilderView.vue` | Add `#navigation` slot |
