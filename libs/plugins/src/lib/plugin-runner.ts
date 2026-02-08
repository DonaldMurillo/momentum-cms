/**
 * Plugin Runner
 *
 * Orchestrates plugin lifecycle: init → ready → shutdown.
 * Plugins execute in array order; shutdown runs in reverse.
 * Errors are logged and skipped unless PluginFatalError is thrown.
 */

import type { CollectionConfig, MomentumConfig } from '@momentum-cms/core';
import { createLogger, type MomentumLogger } from '@momentum-cms/logger';
import { PluginFatalError } from './plugin-fatal-error';
import type {
	MomentumAPI,
	MomentumPlugin,
	PluginContext,
	PluginReadyContext,
	PluginMiddlewareDescriptor,
	PluginProviderDescriptor,
	PluginAdminRouteDescriptor,
} from './plugin.types';

/**
 * Options for creating a PluginRunner.
 */
export interface PluginRunnerOptions {
	/** The Momentum config */
	config: MomentumConfig;
	/** Mutable collections array */
	collections: CollectionConfig[];
	/** Plugins to run */
	plugins: MomentumPlugin[];
}

/**
 * Manages plugin lifecycle execution.
 */
export class PluginRunner {
	private readonly plugins: MomentumPlugin[];
	private readonly config: MomentumConfig;
	private readonly collections: CollectionConfig[];
	private readonly logger: MomentumLogger;
	private readonly middlewareDescriptors: PluginMiddlewareDescriptor[] = [];
	private readonly providerDescriptors: PluginProviderDescriptor[] = [];
	private readonly adminRouteDescriptors: PluginAdminRouteDescriptor[] = [];
	private initialized = false;
	private ready = false;

	constructor(options: PluginRunnerOptions) {
		this.plugins = options.plugins;
		this.config = options.config;
		this.collections = options.collections;
		this.logger = createLogger('Plugins');
	}

	/**
	 * Create a plugin-scoped context.
	 */
	private createContext(plugin: MomentumPlugin): PluginContext {
		return {
			config: this.config,
			collections: this.collections,
			logger: this.logger.child(plugin.name),
			registerMiddleware: (descriptor: PluginMiddlewareDescriptor) => {
				this.middlewareDescriptors.push(descriptor);
			},
			registerProvider: (descriptor: PluginProviderDescriptor) => {
				this.providerDescriptors.push(descriptor);
			},
			registerAdminRoute: (descriptor: PluginAdminRouteDescriptor) => {
				this.adminRouteDescriptors.push(descriptor);
			},
		};
	}

	/**
	 * Run onInit for all plugins (in order).
	 * Call this before API initialization.
	 */
	async runInit(): Promise<void> {
		if (this.initialized) {
			this.logger.warn('Plugins already initialized');
			return;
		}

		for (const plugin of this.plugins) {
			try {
				if (plugin.onInit) {
					this.logger.debug(`Initializing plugin: ${plugin.name}`);
					await plugin.onInit(this.createContext(plugin));
				}
			} catch (error) {
				if (error instanceof PluginFatalError) {
					throw error;
				}
				const message = error instanceof Error ? error.message : String(error);
				this.logger.error(`Plugin "${plugin.name}" failed during onInit: ${message}`);
			}
		}

		this.initialized = true;
	}

	/**
	 * Run onReady for all plugins (in order).
	 * Call this after API + seeding complete.
	 */
	async runReady(api: MomentumAPI): Promise<void> {
		if (this.ready) {
			this.logger.warn('Plugins already marked ready');
			return;
		}

		for (const plugin of this.plugins) {
			try {
				if (plugin.onReady) {
					this.logger.debug(`Plugin ready: ${plugin.name}`);
					const context: PluginReadyContext = {
						...this.createContext(plugin),
						api,
					};
					await plugin.onReady(context);
				}
			} catch (error) {
				if (error instanceof PluginFatalError) {
					throw error;
				}
				const message = error instanceof Error ? error.message : String(error);
				this.logger.error(`Plugin "${plugin.name}" failed during onReady: ${message}`);
			}
		}

		this.ready = true;
	}

	/**
	 * Run onShutdown for all plugins (in reverse order).
	 * Call this during graceful shutdown.
	 */
	async runShutdown(): Promise<void> {
		const reversed = [...this.plugins].reverse();

		for (const plugin of reversed) {
			try {
				if (plugin.onShutdown) {
					this.logger.debug(`Shutting down plugin: ${plugin.name}`);
					await plugin.onShutdown(this.createContext(plugin));
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				this.logger.error(`Plugin "${plugin.name}" failed during onShutdown: ${message}`);
			}
		}
	}

	/**
	 * Get the list of registered plugin names.
	 */
	getPluginNames(): string[] {
		return this.plugins.map((p) => p.name);
	}

	/**
	 * Get middleware descriptors registered by plugins during onInit.
	 * Returns descriptors in the order they were registered.
	 */
	getMiddleware(): PluginMiddlewareDescriptor[] {
		return [...this.middlewareDescriptors];
	}

	/**
	 * Get provider descriptors registered by plugins during onInit.
	 * Returns descriptors in the order they were registered.
	 */
	getProviders(): PluginProviderDescriptor[] {
		return [...this.providerDescriptors];
	}

	/**
	 * Get admin route descriptors registered by plugins during onInit.
	 * Returns descriptors in the order they were registered.
	 */
	getAdminRoutes(): PluginAdminRouteDescriptor[] {
		return [...this.adminRouteDescriptors];
	}
}
