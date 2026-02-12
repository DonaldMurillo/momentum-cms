/**
 * Define Collection Function
 *
 * Creates a collection configuration with proper typing.
 * This is the main entry point for defining collections in Momentum CMS.
 *
 * Example:
 * ```typescript
 * export const Posts = defineCollection({
 *   slug: 'posts',
 *   fields: [
 *     text('title', { required: true }),
 *     richText('content'),
 *   ],
 *   access: {
 *     read: () => true,
 *     create: ({ req }) => !!req.user,
 *   },
 * });
 * ```
 */

import type { CollectionConfig, GlobalConfig, SoftDeleteConfig } from './collection.types';

/**
 * Define a collection configuration
 * @param config Collection configuration object
 * @returns The same configuration with proper typing
 */
export function defineCollection(config: CollectionConfig): CollectionConfig {
	// Set defaults
	const collection: CollectionConfig = {
		timestamps: true, // Enable timestamps by default
		...config,
	};

	// Validate required fields
	if (!collection.slug) {
		throw new Error('Collection must have a slug');
	}

	if (!collection.fields || collection.fields.length === 0) {
		throw new Error(`Collection "${collection.slug}" must have at least one field`);
	}

	// Validate slug format (kebab-case)
	if (!/^[a-z][a-z0-9-]*$/.test(collection.slug)) {
		throw new Error(
			`Collection slug "${collection.slug}" must be kebab-case (lowercase letters, numbers, and hyphens, starting with a letter)`,
		);
	}

	return collection;
}

/**
 * Define a global configuration (single document, like site settings)
 * @param config Global configuration object
 * @returns The same configuration with proper typing
 */
export function defineGlobal(config: GlobalConfig): GlobalConfig {
	// Validate required fields
	if (!config.slug) {
		throw new Error('Global must have a slug');
	}

	if (!config.fields || config.fields.length === 0) {
		throw new Error(`Global "${config.slug}" must have at least one field`);
	}

	// Validate slug format (kebab-case) — same rules as collections
	if (!/^[a-z][a-z0-9-]*$/.test(config.slug)) {
		throw new Error(
			`Global slug "${config.slug}" must be kebab-case (lowercase letters, numbers, and hyphens, starting with a letter)`,
		);
	}

	return config;
}

/**
 * Get the soft delete field name for a collection.
 * Returns the field name (default 'deletedAt') if soft delete is enabled, or null if not.
 *
 * @param config - The collection configuration
 * @returns The deletedAt field name, or null if soft delete is not enabled
 */
export function getSoftDeleteField(config: CollectionConfig): string | null {
	if (!config.softDelete) return null;
	if (config.softDelete === true) return 'deletedAt';
	const sdConfig: SoftDeleteConfig = config.softDelete;
	return sdConfig.field ?? 'deletedAt';
}

/**
 * Helper type to extract the document type from a collection
 * Useful for typing API responses and database queries
 */
export type InferDocumentType<T extends CollectionConfig> = {
	id: string | number;
	createdAt?: Date;
	updatedAt?: Date;
} & {
	[K in T['fields'][number]['name']]?: unknown;
};
