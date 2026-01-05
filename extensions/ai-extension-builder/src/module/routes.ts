import BuilderView from './views/BuilderView.vue';

export const routes = [
	{
		path: '',
		redirect: {
			name: 'ai-extension-builder-new',
		},
	},
	{
		path: '+',
		name: 'ai-extension-builder-new',
		component: BuilderView,
	},
	{
		path: ':id',
		name: 'ai-extension-builder-edit',
		component: BuilderView,
		props: true,
	},
];

export { default } from './views/BuilderView.vue';
