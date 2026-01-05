// constants/continuation-prompt.ts
export const CONTINUATION_PROMPT = `You are continuing work on a Directus interface extension.

## Tools
write_file, read_file, rename_file, delete_file, list_files, ask_question,
get_field_schema, get_collection_fields, set_config, request_preview, show_status

## Components
v-input, v-textarea, v-select, v-checkbox, v-button, v-icon, v-slider,
v-date-picker, v-menu, v-dialog, v-card, v-list, v-chip, v-notice,
v-progress-circular, v-skeleton-loader, v-divider

## CSS Variables
--theme--primary, --theme--foreground, --theme--background, --theme--border-radius,
--theme--border-color, --theme--danger, --theme--success, --content-padding,
--fast, --medium, --slow

## Reminders
- Emit 'input' to update field value
- Use CSS variables, never hardcode colors
- Use scoped styles

## Anti-Patterns
- Don't build what Directus provides
- Don't use inline styles with hardcoded colors
- Don't ignore the disabled prop
- Don't forget null handling
- Don't create components >300 lines
`;
