// Collection types
export * from './collection.types';

// Collection builders
export {
	defineCollection,
	defineGlobal,
	getSoftDeleteField,
	isUploadCollection,
	getUploadFieldMapping,
} from './define-collection';
export type { InferDocumentType, UploadFieldMapping } from './define-collection';

// Built-in collections
export { MediaCollection } from './media.collection';
export type { MediaDocument } from './media.collection';
