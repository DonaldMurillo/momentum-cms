// Collections
export { collections } from './collections';
export {
	Categories,
	Articles,
	Products,
	Pages,
	Settings,
	Events,
	MediaCollection,
	HookTestItems,
	FieldTestItems,
	Tags,
	UserNotes,
} from './collections';

// Globals
export { globals } from './globals';
export { SiteSettings } from './globals';

// Seeding data
export { exampleSeedingConfig } from './config/seeding-data';

// Test infrastructure (Express)
export { mountTestEndpoints, type TestEndpointsOptions } from './test-infra/express-endpoints';

// Hook test utilities (for h3/framework-agnostic test endpoints)
export {
	getHookLog,
	clearHookLog,
	getHookBehavior,
	setHookBehavior,
	type HookBehaviorConfig,
} from './collections/hook-test-items.collection';
export { getFieldHookLog, clearFieldHookLog } from './collections/field-test-items.collection';

// Test users
export {
	TEST_ADMIN,
	TEST_EDITOR,
	TEST_VIEWER,
	TEST_AUTHOR_1,
	TEST_AUTHOR_2,
	TEST_AUTHOR_3,
	ADDITIONAL_TEST_USERS,
	AUTHOR_USERS,
} from './test-users';
