# Extension Sidebar Design

## Overview

Add sidebar listing of saved extensions to the AI Extension Builder module.

## Routes

| Path | Component | Behavior |
|------|-----------|----------|
| `/ai-extension-builder` | - | Redirect to `/ai-extension-builder/+` |
| `/ai-extension-builder/+` | BuilderView | New extension (fresh state) |
| `/ai-extension-builder/:id` | BuilderView | Detail view (loads extension) |

## Sidebar Component

**Component:** `ExtensionSidebar.vue`

**Structure:**
```
┌─────────────────────────┐
│ [+ New Extension]       │  button → /ai-extension-builder/+
├─────────────────────────┤
│ 🎨 Color Picker    🟢   │  icon, name, status badge
│ Pick colors from...     │  truncated description (muted)
├─────────────────────────┤
│ 📊 Stats Panel     🟡   │
│ Dashboard widget...     │
└─────────────────────────┘
```

**Data:**
- Endpoint: `/items/ai_extensions?sort=-date_updated&fields=id,name,icon,description,status`
- All extensions shown (draft + published)
- Flat list, sorted by most recently updated

**Status badges:**
- Draft → warning color (yellow/orange)
- Published → success color (green)

**Integration:** `private-view` `#navigation` slot

## BuilderView Changes

- Add `id` prop for route param
- Loading/hydration logic handled in separate session

## Module Registration

```typescript
routes: [
  { path: '', redirect: '+' },
  { name: 'new', path: '+', component: BuilderView },
  { name: 'detail', path: ':id', component: BuilderView, props: true },
]
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `components/ExtensionSidebar.vue` | Create |
| `views/BuilderView.vue` | Add sidebar slot, `id` prop |
| `index.ts` | Update routes |
