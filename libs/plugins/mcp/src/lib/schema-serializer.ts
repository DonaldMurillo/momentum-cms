/**
 * Schema serializer — converts Field[] to AI-friendly JSON.
 *
 * Strips admin-only config (hooks, access, conditions, validate) and
 * flattens layout fields (tabs, collapsible, row) since they don't store data.
 * Password fields and any field marked `admin: { hidden: true }` are
 * excluded — `hidden` is the author's signal that a field is internal/sensitive
 * and should not appear in the schema or be exposed via MCP tools.
 */

import type { Field, CollectionConfig } from '@momentumcms/core';

export interface SerializedField {
	name: string;
	type: string;
	required?: boolean;
	label?: string;
	description?: string;
	options?: Array<{ label: string; value: string | number }>;
	fields?: SerializedField[];
	relationTo?: string;
	hasMany?: boolean;
	minRows?: number;
	maxRows?: number;
}

export interface SerializedCollection {
	slug: string;
	label: string;
	fields: SerializedField[];
	timestamps: boolean;
	versioning: boolean;
	softDelete: boolean;
}

const LAYOUT_TYPES = new Set(['tabs', 'collapsible', 'row']);

/**
 * Resolve the plural display label for a collection, falling back to the slug
 * when `labels.plural` is missing or not a string.
 */
export function getCollectionPluralLabel(c: { slug: string; labels?: unknown }): string {
	if (c.labels && typeof c.labels === 'object' && 'plural' in c.labels) {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- labels is a dynamic config shape
		const plural = (c.labels as Record<string, unknown>)['plural'];
		if (typeof plural === 'string') return plural;
	}
	return c.slug;
}

function getFieldProp<T>(field: Field, key: string): T | undefined {
	if (key in field) {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- dynamic property access on union field types
		return (field as unknown as Record<string, unknown>)[key] as T;
	}
	return undefined;
}

function resolveRelationTo(field: Field): string | undefined {
	if (field.type === 'relationship') {
		const collectionFn = getFieldProp<() => { slug?: string }>(field, 'collection');
		if (typeof collectionFn === 'function') {
			const resolved = collectionFn();
			return resolved?.slug;
		}
	}
	if (field.type === 'upload') {
		return getFieldProp<string>(field, 'relationTo');
	}
	return undefined;
}

function serializeField(field: Field): SerializedField {
	const serialized: SerializedField = {
		name: field.name,
		type: field.type,
	};

	if (field.required) serialized.required = true;
	if (field.label) serialized.label = field.label;
	if (field.description) serialized.description = field.description;

	// Select/radio options
	if (field.type === 'select' || field.type === 'radio') {
		const options = getFieldProp<Array<{ label: string; value: string | number }>>(
			field,
			'options',
		);
		if (options) serialized.options = options;
	}

	// hasMany
	const hasMany = getFieldProp<boolean>(field, 'hasMany');
	if (hasMany !== undefined) serialized.hasMany = hasMany;

	// relationTo
	const relationTo = resolveRelationTo(field);
	if (relationTo) serialized.relationTo = relationTo;

	// Array min/max
	if (field.type === 'array') {
		const minRows = getFieldProp<number>(field, 'minRows');
		const maxRows = getFieldProp<number>(field, 'maxRows');
		if (minRows !== undefined) serialized.minRows = minRows;
		if (maxRows !== undefined) serialized.maxRows = maxRows;
	}

	// Nested fields (group, array, blocks)
	const subFields = getFieldProp<Field[]>(field, 'fields');
	if (Array.isArray(subFields)) {
		serialized.fields = serializeFields(subFields);
	}

	return serialized;
}

function extractLayoutChildren(field: Field): Field[] {
	if (field.type === 'tabs') {
		const tabs = getFieldProp<Array<{ fields: Field[] }>>(field, 'tabs');
		return tabs ? tabs.flatMap((tab) => tab.fields ?? []) : [];
	}
	if (field.type === 'collapsible' || field.type === 'row') {
		return getFieldProp<Field[]>(field, 'fields') ?? [];
	}
	return [];
}

function isAdminHidden(field: Field): boolean {
	const admin = getFieldProp<{ hidden?: unknown }>(field, 'admin');
	return admin?.hidden === true;
}

export function serializeFields(fields: Field[]): SerializedField[] {
	const result: SerializedField[] = [];

	for (const field of fields) {
		// Exclude password fields for security
		if (field.type === 'password') continue;

		// Exclude fields the author marked hidden — treat as sensitive/internal
		if (isAdminHidden(field)) continue;

		// Flatten layout fields
		if (LAYOUT_TYPES.has(field.type)) {
			const children = extractLayoutChildren(field);
			result.push(...serializeFields(children));
			continue;
		}

		result.push(serializeField(field));
	}

	return result;
}

export function serializeCollection(config: CollectionConfig): SerializedCollection {
	return {
		slug: config.slug,
		label: getCollectionPluralLabel(config),
		fields: serializeFields(config.fields),
		timestamps: Boolean(getCollectionProp(config, 'timestamps')),
		versioning: Boolean(getCollectionProp(config, 'versions')),
		softDelete: Boolean(getCollectionProp(config, 'softDelete')),
	};
}

function getCollectionProp<T>(config: CollectionConfig, key: string): T | undefined {
	if (key in config) {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- dynamic property access on collection config
		return (config as unknown as Record<string, unknown>)[key] as T;
	}
	return undefined;
}
