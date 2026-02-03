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
} from './lib/momentum-api';
