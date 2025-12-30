import * as Vue from 'vue';
import { loadModule } from 'vue3-sfc-loader';
import { getDirectusApp, getExtensionsFromApp } from './get-directus-app';

interface AiExtension {
	id: string;
	slug: string;
	name: string;
	icon: string;
	description: string;
	files: Record<string, string>;
	entry: string;
	extension_config: {
		types: string[];
		group: string;
		options: unknown[];
	};
	status: 'draft' | 'published';
}

const styleRegistry = new Map<string, HTMLStyleElement>();

function injectStyle(css: string, extSlug: string): void {
	styleRegistry.get(extSlug)?.remove();
	const style = document.createElement('style');
	style.textContent = css;
	style.dataset.aiExtension = extSlug;
	document.head.append(style);
	styleRegistry.set(extSlug, style);
}

export async function loadPublishedExtensions(): Promise<void> {
	const app = getDirectusApp();

	if (!app) {
		console.warn('[AI Extension Builder] App not ready, skipping auto-load');
		return;
	}

	const extensions = getExtensionsFromApp();

	if (!extensions) {
		console.warn('[AI Extension Builder] Extensions registry not ready, skipping auto-load');
		return;
	}

	// Use fetch directly since we may not have access to api instance yet
	try {
		const response = await fetch('/items/ai_extensions?filter[status][_eq]=published');

		if (!response.ok) {
			if (response.status === 403 || response.status === 401) {
				console.debug('[AI Extension Builder] Not authenticated yet, will load later');
				return;
			}

			throw new Error(`HTTP ${response.status}`);
		}

		const { data: published } = await response.json() as { data: AiExtension[] };
		if (!published?.length) return;

		let loaded = 0;

		for (const ext of published) {
			try {
				// Parse JSON string fields from database
				const files = typeof ext.files === 'string' ? JSON.parse(ext.files) : ext.files;
				const extConfig = typeof ext.extension_config === 'string'
					? JSON.parse(ext.extension_config)
					: ext.extension_config;

				const component = await loadModule(`/${ext.entry}`, {
					moduleCache: { vue: Vue },
					getFile(url: string) {
						const path = url.replace(/^\//, '');
						const content = files[path];
						if (!content) throw new Error(`File not found: ${path}`);
						return content;
					},
					addStyle(css: string) {
						injectStyle(css, ext.slug);
					},
				});

				// Register Vue component
				app.component(`interface-${ext.slug}`, component);

				// Add to extensions registry (assign new array to trigger shallowRef reactivity)
				extensions.interfaces.value = [
					...extensions.interfaces.value,
					{
						id: ext.slug,
						name: ext.name,
						icon: ext.icon,
						description: ext.description,
						component,
						types: extConfig.types,
						group: extConfig.group,
						options: extConfig.options,
					},
				];

				console.log(`[AI Extension Builder] Loaded: ${ext.slug}`);
				loaded++;
			}
			catch (error) {
				console.error(`[AI Extension Builder] Failed to compile ${ext.slug}:`, error);
			}
		}

		if (loaded > 0) {
			console.log(`[AI Extension Builder] Auto-loaded ${loaded} extension(s)`);
		}
	}
	catch (error) {
		// Collection might not exist or user not authenticated - that's ok
		console.debug('[AI Extension Builder] Could not auto-load:', error);
	}
}
