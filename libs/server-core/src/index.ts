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

// Webhooks
export { registerWebhookHooks } from './lib/webhooks';

// Publish Scheduler
export {
	startPublishScheduler,
	type PublishSchedulerOptions,
	type PublishSchedulerHandle,
} from './lib/publish-scheduler';

// GraphQL
export { buildGraphQLSchema, type GraphQLContext } from './lib/graphql-schema';
export {
	executeGraphQL,
	type GraphQLRequestBody,
	type GraphQLResult,
} from './lib/graphql-handler';
export { GraphQLJSON } from './lib/graphql-scalars';

// API Keys
export {
	generateApiKey,
	hashApiKey,
	getKeyPrefix,
	isValidApiKeyFormat,
	generateApiKeyId,
	createPostgresApiKeyStore,
	API_KEYS_TABLE_SQL_POSTGRES,
	API_KEYS_TABLE_SQL_SQLITE,
	type ApiKeyRecord,
	type CreateApiKeyResult,
	type CreateApiKeyOptions,
	type ApiKeyStore,
} from './lib/api-keys';

// Upload Handler
export {
	handleUpload,
	handleFileDelete,
	handleFileGet,
	getUploadConfig,
	type UploadRequest,
	type UploadResponse,
	type UploadConfig,
} from './lib/upload-handler';

// OpenAPI
export {
	generateOpenAPISpec,
	type OpenAPIDocument,
	type OpenAPIGeneratorOptions,
} from './lib/openapi-generator';

// Preview Renderer
export {
	renderPreviewHTML,
	type PreviewRenderOptions,
} from './lib/preview-renderer';

// Import/Export
export {
	exportToJson,
	exportToCsv,
	parseJsonImport,
	parseCsvImport,
	type ExportFormat,
	type ExportOptions,
	type ExportResult,
	type ImportOptions,
	type ImportResult,
	type ImportError,
} from './lib/import-export';
