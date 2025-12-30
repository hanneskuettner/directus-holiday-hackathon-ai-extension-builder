import { defineModule } from '@directus/extensions-sdk';
import ModuleComponent from './routes';
import { loadPublishedExtensions } from './utils/load-published-extensions';

export default defineModule({
	id: 'ai-extension-builder',
	name: 'AI Extension Builder',
	icon: 'auto_fix_high',
	routes: [
		{
			name: 'ai-extension-builder-home',
			path: '',
			component: ModuleComponent,
		},
	],
	preRegisterCheck() {
		// Load published AI extensions on app initialization
		loadPublishedExtensions();
		return true;
	},
});
