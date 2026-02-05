// Server Core
export {
	createMomentumHandlers,
	createInMemoryAdapter,
	type DatabaseAdapter,
	type MomentumConfig,
	type ResolvedMomentumConfig,
	type QueryOptions,
	type MomentumRequest,
	type MomentumResponse,
	type MomentumHandlers,
	type ValidationError,
} from './lib/server-core';

// Momentum API
export {
	initializeMomentumAPI,
	getMomentumAPI,
	isMomentumAPIInitialized,
	resetMomentumAPI,
	CollectionNotFoundError,
	DocumentNotFoundError,
	AccessDeniedError,
	ValidationError as MomentumValidationError,
	type MomentumAPI,
	type MomentumAPIContext,
	type CollectionOperations,
	type FindOptions,
	type FindResult,
	type DeleteResult,
	type WhereClause,
	type FieldValidationError,
	type VersionOperations,
	type VersionFindOptions,
} from './lib/momentum-api';

// Version Operations
export { VersionOperationsImpl } from './lib/version-operations';

// Collection Access
export {
	checkCollectionAdminAccess,
	checkSingleCollectionAdminAccess,
	getCollectionPermissions,
	type CollectionAccess,
	type CollectionPermissions,
	type AccessResponse,
} from './lib/collection-access';

// User Sync Hooks
export {
	createUserSyncHook,
	createUserDeleteSyncHook,
	type UserSyncConfig,
} from './lib/user-sync-hooks';

// Seeding
export {
	runSeeding,
	shouldRunSeeding,
	calculateChecksum,
	createSeedTracker,
	type SeedingResult,
	type SeedTracker,
	type CreateSeedTrackingData,
} from './lib/seeding';
