import { defineModule } from '@directus/extensions-sdk';
import { routes } from './routes';
import { loadPublishedExtensions } from './utils/load-published-extensions';

export default defineModule({
	id: 'ai-extension-builder',
	name: 'AI Extension Builder',
	icon: 'auto_fix_high',
	routes,
	preRegisterCheck() {
		loadPublishedExtensions();
		return true;
	},
});
