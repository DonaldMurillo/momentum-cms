// Collection types
export * from './collection.types';

// Collection builders
export { defineCollection, defineGlobal, getSoftDeleteField } from './define-collection';
export type { InferDocumentType } from './define-collection';

// Built-in collections
export { MediaCollection } from './media.collection';
export type { MediaDocument } from './media.collection';
