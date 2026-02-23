// Storage types
export * from './lib/storage.types';

// Storage adapters
export { localStorageAdapter } from './lib/storage-local';
export { s3StorageAdapter } from './lib/storage-s3';

// Utilities
export { getExtensionFromMimeType } from './lib/storage-utils';

// MIME validation
export {
	validateMimeType,
	isMimeTypeAllowed,
	detectMimeType,
	mimeTypeMatches,
} from './lib/mime-validator';
