// Plugin system types
export type {
	MomentumPlugin,
	PluginContext,
	PluginReadyContext,
	MomentumAPI,
	CollectionEvent,
	CollectionEventType,
	PluginMiddlewareDescriptor,
	PluginProviderDescriptor,
	PluginAdminRouteDescriptor,
} from './lib/plugin.types';

// Plugin runner
export { PluginRunner, type PluginRunnerOptions } from './lib/plugin-runner';

// Plugin fatal error
export { PluginFatalError } from './lib/plugin-fatal-error';

// Hook injector
export { injectCollectionEventHooks, type CollectionEventListener } from './lib/hook-injector';

// Event bus
export { MomentumEventBus, type EventHandler, type EventPattern } from './lib/event-bus/event-bus';

// Event bus plugin
export { eventBusPlugin, type EventBusPlugin } from './lib/event-bus/event-bus-plugin';
