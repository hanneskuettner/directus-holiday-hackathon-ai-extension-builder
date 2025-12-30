import type { App, ShallowRef } from 'vue';

export interface ExtensionsRegistry {
  interfaces: ShallowRef<Array<{
    id: string;
    name: string;
    icon: string;
    description: string;
    component: unknown;
    types: string[];
    group: string;
    options: unknown[];
  }>>;
  displays: ShallowRef<unknown[]>;
  layouts: ShallowRef<unknown[]>;
  modules: ShallowRef<unknown[]>;
  panels: ShallowRef<unknown[]>;
  operations: ShallowRef<unknown[]>;
  themes: ShallowRef<unknown[]>;
}

/**
 * Get the Directus Vue app instance from the DOM.
 * Extensions are mounted inside Directus's Vue app, so we can traverse
 * up the component tree to find the root app instance.
 */
export function getDirectusApp(): App | null {
  const appEl = document.getElementById('app');
  if (!appEl) return null;

  // Vue 3 stores the app instance on the element's __vue_app__ property
  return (appEl as unknown as { __vue_app__?: App }).__vue_app__ ?? null;
}

/**
 * Get extensions registry directly from Vue app's component provides.
 * This bypasses useExtensions() which requires Vue composition context.
 */
export function getExtensionsFromApp(): ExtensionsRegistry | null {
  const app = getDirectusApp();
  if (!app) return null;

  // Access via: app._container._vnode.component.provides.extensions
  const container = (app as unknown as { _container?: { _vnode?: { component?: { provides?: { extensions?: ExtensionsRegistry } } } } })._container;
  return container?._vnode?.component?.provides?.extensions ?? null;
}
