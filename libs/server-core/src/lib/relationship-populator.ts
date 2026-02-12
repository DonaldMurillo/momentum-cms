/**
 * Relationship Population
 *
 * Populates relationship fields by replacing document IDs with actual
 * related documents, up to a configurable depth level.
 * Respects collection-level and field-level access control.
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed to narrow populated[field.name] from unknown to Record/array */

import type {
	CollectionConfig,
	DatabaseAdapter,
	Field,
	RelationshipField,
	PolymorphicRelationshipValue,
	RequestContext,
} from '@momentum-cms/core';
import { flattenDataFields, getSoftDeleteField } from '@momentum-cms/core';
import { filterReadableFields, hasFieldAccessControl } from './field-access';

export interface PopulateOptions {
	/** Maximum depth of population (0 = no population, 1 = populate immediate, etc.) */
	depth: number;
	/** All collection configs (needed to resolve relationship targets) */
	collections: CollectionConfig[];
	/** Database adapter for fetching related documents */
	adapter: DatabaseAdapter;
	/** Request context for access control checks */
	req?: RequestContext;
}

/**
 * Populate relationship fields in a document up to the specified depth.
 * Returns a new document with relationship IDs replaced by full documents.
 *
 * @param doc The document to populate
 * @param fields The collection's field definitions
 * @param options Population options including depth, collections, and adapter
 */
export async function populateRelationships(
	doc: Record<string, unknown>,
	fields: Field[],
	options: PopulateOptions,
): Promise<Record<string, unknown>> {
	if (options.depth <= 0) {
		return doc;
	}

	const dataFields = flattenDataFields(fields);
	const populated = { ...doc };

	for (const field of dataFields) {
		// Recurse into group fields to find nested relationships
		if (
			field.type === 'group' &&
			populated[field.name] &&
			typeof populated[field.name] === 'object'
		) {
			populated[field.name] = await populateRelationships(
				populated[field.name] as Record<string, unknown>,
				field.fields,
				options,
			);
			continue;
		}

		// Recurse into array fields
		if (field.type === 'array' && Array.isArray(populated[field.name])) {
			const rows = populated[field.name] as Record<string, unknown>[];
			populated[field.name] = await Promise.all(
				rows.map((row) => populateRelationships(row, field.fields, options)),
			);
			continue;
		}

		if (field.type !== 'relationship') continue;

		const relField = field;
		const value = populated[field.name];

		if (value === null || value === undefined) continue;

		const nextDepthOptions: PopulateOptions = {
			...options,
			depth: options.depth - 1,
		};

		if (relField.hasMany && Array.isArray(value)) {
			// Populate array of relationships
			const results = await Promise.all(
				value.map((item) => populateSingleRelationship(item, relField, nextDepthOptions)),
			);
			// Filter out null results (access denied) — keep original ID
			populated[field.name] = results.map((result, i) => result ?? value[i]);
		} else {
			// Populate single relationship
			const result = await populateSingleRelationship(value, relField, nextDepthOptions);
			// If access denied (null), keep original ID
			populated[field.name] = result ?? value;
		}
	}

	return populated;
}

/**
 * Check if the current user has read access to a collection.
 * Returns true if no access function is defined (allow-all default).
 */
async function checkCollectionReadAccess(
	collectionConfig: CollectionConfig,
	req?: RequestContext,
): Promise<boolean> {
	const accessFn = collectionConfig.access?.read;
	if (!accessFn) return true;
	return Promise.resolve(accessFn({ req: req ?? {} }));
}

/**
 * Apply field-level read access filtering if the collection has field access control.
 */
async function applyFieldReadFiltering(
	doc: Record<string, unknown>,
	collectionConfig: CollectionConfig,
	req?: RequestContext,
): Promise<Record<string, unknown>> {
	if (!req || !hasFieldAccessControl(collectionConfig.fields)) {
		return doc;
	}
	return filterReadableFields(collectionConfig.fields, doc, req);
}

async function populateSingleRelationship(
	value: unknown,
	field: RelationshipField,
	options: PopulateOptions,
): Promise<unknown> {
	// Already populated (is an object with id)
	if (typeof value === 'object' && value !== null && 'id' in value) {
		return value;
	}

	// Handle polymorphic relationships
	if (isPolymorphicValue(value)) {
		const collectionConfig = options.collections.find((c) => c.slug === value.relationTo);
		if (!collectionConfig) return value;

		// Check collection-level read access on the target collection
		const hasAccess = await checkCollectionReadAccess(collectionConfig, options.req);
		if (!hasAccess) return null;

		const relatedDoc = await options.adapter.findById(value.relationTo, value.value);
		if (!relatedDoc) return value;

		// Skip soft-deleted related documents
		const softDeleteField = getSoftDeleteField(collectionConfig);
		if (softDeleteField && relatedDoc[softDeleteField]) return value;

		// Apply field-level read filtering
		const filteredDoc = await applyFieldReadFiltering(relatedDoc, collectionConfig, options.req);

		// Recursively populate the related document
		const populatedDoc = await populateRelationships(filteredDoc, collectionConfig.fields, options);

		return {
			relationTo: value.relationTo,
			value: populatedDoc,
		};
	}

	// Simple relationship (string ID)
	if (typeof value === 'string') {
		const slug = resolveCollectionSlug(field);
		if (!slug) return value;

		const collectionConfig = options.collections.find((c) => c.slug === slug);
		if (!collectionConfig) return value;

		// Check collection-level read access on the target collection
		const hasAccess = await checkCollectionReadAccess(collectionConfig, options.req);
		if (!hasAccess) return null;

		const relatedDoc = await options.adapter.findById(slug, value);
		if (!relatedDoc) return value;

		// Skip soft-deleted related documents
		const softDeleteField = getSoftDeleteField(collectionConfig);
		if (softDeleteField && relatedDoc[softDeleteField]) return value;

		// Apply field-level read filtering
		const filteredDoc = await applyFieldReadFiltering(relatedDoc, collectionConfig, options.req);

		// Recursively populate the related document
		return populateRelationships(filteredDoc, collectionConfig.fields, options);
	}

	return value;
}

function resolveCollectionSlug(field: RelationshipField): string | undefined {
	try {
		const config = field.collection();
		if (config && typeof config === 'object' && 'slug' in config) {
			return (config as { slug: string }).slug;
		}
	} catch {
		// Collection reference may not be resolvable in all contexts
	}
	return undefined;
}

function isPolymorphicValue(value: unknown): value is PolymorphicRelationshipValue {
	return (
		typeof value === 'object' &&
		value !== null &&
		'relationTo' in value &&
		'value' in value &&
		typeof (value as PolymorphicRelationshipValue).relationTo === 'string' &&
		typeof (value as PolymorphicRelationshipValue).value === 'string'
	);
}
