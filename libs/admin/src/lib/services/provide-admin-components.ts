import { ENVIRONMENT_INITIALIZER, inject, makeEnvironmentProviders } from '@angular/core';
import type { AdminComponentsConfig, CollectionConfig } from '@momentumcms/core';
import { AdminComponentRegistry } from './admin-component-registry.service';
import { AdminSlotRegistry } from './admin-slot-registry.service';
import type { ComponentLoader } from './admin-component-registry.types';

/**
 * Register a custom admin page component override.
 *
 * ```typescript
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideAdminComponent('dashboard', () =>
 *       import('./custom-dashboard.component').then(m => m.CustomDashboard)
 *     ),
 *   ],
 * };
 * ```
 */
export function provideAdminComponent(
	key: string,
	loader: ComponentLoader,
): ReturnType<typeof makeEnvironmentProviders> {
	return makeEnvironmentProviders([
		{
			provide: ENVIRONMENT_INITIALIZER,
			multi: true,
			useFactory: (): (() => void) => {
				const registry = inject(AdminComponentRegistry);
				return (): void => {
					registry.register(key, loader);
				};
			},
		},
	]);
}

/**
 * Register a component into an admin layout slot.
 *
 * ```typescript
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideAdminSlot('dashboard:before', () =>
 *       import('./welcome-banner.component').then(m => m.WelcomeBanner)
 *     ),
 *   ],
 * };
 * ```
 */
export function provideAdminSlot(
	slot: string,
	loader: ComponentLoader,
): ReturnType<typeof makeEnvironmentProviders> {
	return makeEnvironmentProviders([
		{
			provide: ENVIRONMENT_INITIALIZER,
			multi: true,
			useFactory: (): (() => void) => {
				const registry = inject(AdminSlotRegistry);
				return (): void => {
					registry.register(slot, loader);
				};
			},
		},
	]);
}

/** Mapping from AdminComponentsConfig page keys to registry keys. */
const PAGE_KEY_MAP: Record<string, string> = {
	dashboard: 'dashboard',
	login: 'login',
	media: 'media',
};

/** Mapping from AdminComponentsConfig slot keys to registry slot keys. */
const GLOBAL_SLOT_MAP: Record<string, string> = {
	beforeNavigation: 'shell:nav-start',
	afterNavigation: 'shell:nav-end',
	header: 'shell:header',
	footer: 'shell:footer',
	beforeDashboard: 'dashboard:before',
	afterDashboard: 'dashboard:after',
	beforeLogin: 'login:before',
	afterLogin: 'login:after',
};

/** Mapping from CollectionAdminComponentsConfig page keys to page type suffixes. */
const COLLECTION_PAGE_MAP: Record<string, string> = {
	list: 'list',
	edit: 'edit',
	view: 'view',
};

/** Mapping from CollectionAdminComponentsConfig slot keys to slot key patterns. */
const COLLECTION_SLOT_MAP: Record<string, string> = {
	beforeList: 'collection-list:before',
	afterList: 'collection-list:after',
	beforeEdit: 'collection-edit:before',
	afterEdit: 'collection-edit:after',
	editSidebar: 'collection-edit:sidebar',
	beforeView: 'collection-view:before',
	afterView: 'collection-view:after',
};

/**
 * Read AdminComponentsConfig and CollectionAdminComponentsConfig from config
 * and register them into AdminComponentRegistry and AdminSlotRegistry.
 *
 * Called once in AdminShellComponent.ngOnInit() after route data is available.
 */
export function registerConfigComponents(
	collections: CollectionConfig[],
	adminComponents: AdminComponentsConfig | undefined,
	componentRegistry: AdminComponentRegistry,
	slotRegistry: AdminSlotRegistry,
): void {
	// Register global page overrides and slots from AdminComponentsConfig
	if (adminComponents) {
		for (const [configKey, registryKey] of Object.entries(PAGE_KEY_MAP)) {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Object.entries returns string keys
			const loader = adminComponents[configKey as keyof AdminComponentsConfig];
			if (loader) {
				componentRegistry.register(registryKey, loader);
			}
		}

		for (const [configKey, slotKey] of Object.entries(GLOBAL_SLOT_MAP)) {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Object.entries returns string keys
			const loader = adminComponents[configKey as keyof AdminComponentsConfig];
			if (loader) {
				slotRegistry.register(slotKey, loader);
			}
		}
	}

	// Register per-collection page overrides and slots
	for (const collection of collections) {
		const components = collection.admin?.components;
		if (!components) continue;

		for (const [configKey, typeSuffix] of Object.entries(COLLECTION_PAGE_MAP)) {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Object.entries returns string keys
			const loader = components[configKey as keyof typeof components];
			if (loader) {
				componentRegistry.register(`collections/${collection.slug}/${typeSuffix}`, loader);
			}
		}

		for (const [configKey, baseSlotKey] of Object.entries(COLLECTION_SLOT_MAP)) {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Object.entries returns string keys
			const loader = components[configKey as keyof typeof components];
			if (loader) {
				slotRegistry.register(`${baseSlotKey}:${collection.slug}`, loader);
			}
		}
	}
}
