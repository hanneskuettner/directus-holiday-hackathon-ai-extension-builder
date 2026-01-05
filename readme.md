# AI Extension Builder for Directus

Build custom Directus interfaces by describing what you want in plain English. No boilerplate, no setup—just describe your interface and watch it appear.

## What is this?

This is a Directus module that lets you create interface extensions through conversation with an AI. Instead of writing Vue components from scratch, you describe what you need:

> "I need a star rating interface, 1-5 stars, with hover preview and the ability to clear by clicking the same star again"

The AI asks clarifying questions, generates the Vue component, and shows you a live preview. When you're happy with it, hit publish—your new interface is immediately available in the field configuration dropdown.

## How it works

1. **You describe** what you want in the chat panel
2. **AI asks questions** to understand your requirements (field type, options, edge cases)
3. **Code is generated** and compiled in real-time using vue3-sfc-loader
4. **Live preview** shows your interface working with real Directus components
5. **Publish** to make it available as a field interface across your project

Sessions are automatically saved, so you can close the browser and come back later to continue iterating.

## Getting started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Node.js 22+](https://nodejs.org/)
- [pnpm](https://pnpm.io/installation)

### Setup

```bash
# Clone and install
git clone <repo-url>
cd directus-ai-extension-builder
pnpm install

# Start Directus
docker compose up -d

# Start extension dev mode
pnpm dev

# Open Directus at http://localhost:8055
# Login: admin@example.com / d1r3ctu5
```

Navigate to the **AI Extension Builder** in the sidebar (look for the sparkle icon).

## Example prompts

Here are some prompts that work well:

### Star Rating
> Create a star rating interface that lets users rate items from 1 to 5 stars. Display 5 clickable star icons, filled for selected and outlined for unselected. Hover should preview the rating. Click the same star again to clear. Store as an integer.

### Color Palette
> Create an interface for building a color palette with multiple colors. Show swatches in a row, click to edit with a color picker, add/remove colors, store as a JSON array of hex strings like ["#FF5500", "#0066FF"].

### Priority Selector
> Create a priority selector with 4 levels: Low, Medium, High, Critical. Display as horizontal segmented buttons with distinct colors (gray, blue, orange, red) and icons. Store as a string.

### Tag Input
> Create a tag input where users can type and press Enter to add tags. Show tags as removable chips. Prevent duplicates. Store as a JSON array of strings.

### Operating Hours
> I need an interface that allows users to configure business operating hours for each day of the week. Include an open/closed toggle per day and support multiple time ranges (for lunch breaks). Store as JSON.

### Coordinates Picker
> Create an interface for entering geographic coordinates. Two inputs for latitude and longitude, validate the ranges (-90 to 90, -180 to 180), and include a button to get current location from the browser.

## Tips for good prompts

- **Specify the data type**: "store as integer", "store as JSON array", "store as string"
- **Describe the interaction**: "click to select", "hover to preview", "drag to reorder"
- **Mention edge cases**: "clear by clicking again", "prevent duplicates", "max 10 items"
- **Reference Directus patterns**: The AI knows about v-input, v-button, v-select, and other Directus components

## Architecture

The extension consists of:

- **Module** (`/ai-extension-builder`) - The main interface with chat panel and preview
- **Endpoint** (`/ai/chat`) - Proxies requests to Claude with tool definitions
- **Hook** - Syncs published extensions to Directus on startup

Key technologies:
- [AI SDK](https://sdk.vercel.ai/) for streaming chat with tool calls
- [vue3-sfc-loader](https://github.com/nicknisi/vue3-sfc-loader) for runtime SFC compilation
- Vue 3 Composition API throughout

## Project structure

```
extensions/
  ai-extension-builder/          # The main extension bundle
    src/
      module/                    # Chat UI, preview panel, session management
      endpoint/                  # AI chat proxy with tool definitions
      hook/                      # Extension sync on startup
docker-compose.yml               # Local Directus + Postgres
docs/
  extensions/                    # Directus extension documentation
  plans/                         # Design documents
```

## Limitations

- Generated interfaces are stored in the database, not as files
- Complex multi-file components aren't supported (single SFC only)
- Some advanced Directus APIs may not be available to generated code
- The AI sometimes needs a few iterations to get things right

## Contributing

This started as a hackathon project. Issues and PRs welcome!

## License

MIT
