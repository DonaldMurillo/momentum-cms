// Better Auth integration
export * from './lib/auth';
export * from './lib/email';
export * from './lib/email-templates';

// Auth plugin factory
export { momentumAuth } from './lib/auth-plugin';
export type {
	MomentumAuthPluginConfig,
	MomentumAuthPlugin,
	MomentumAuthPluginRuntimeConfig,
} from './lib/auth-plugin';

// Auth collections (for reference / testing — normally injected by the plugin)
export {
	AuthUserCollection,
	AuthSessionCollection,
	AuthAccountCollection,
	AuthVerificationCollection,
	AuthApiKeysCollection,
	BASE_AUTH_COLLECTIONS,
} from './lib/auth-collections';

// Sub-plugins
export { authTwoFactor } from './lib/plugins/two-factor';
export { authAdmin } from './lib/plugins/admin';
export { authOrganization } from './lib/plugins/organization';
export type { MomentumAuthSubPlugin } from './lib/plugins/sub-plugin.types';
