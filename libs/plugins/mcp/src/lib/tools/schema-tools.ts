/**
 * Schema introspection tools for MCP.
 *
 * list_collections — List available collections with metadata.
 * get_collection_schema — Detailed field schema for a collection.
 */

import type { MomentumConfig } from '@momentumcms/core';
import { serializeCollection, getCollectionPluralLabel } from '../schema-serializer';

interface ToolResult {
	[key: string]: unknown;
	content: Array<{ type: 'text'; text: string }>;
	isError?: true;
}

export function handleListCollections(
	config: MomentumConfig,
	isCollectionAllowed: (slug: string) => boolean,
): ToolResult {
	const collections = (config.collections ?? [])
		.filter((c) => isCollectionAllowed(c.slug))
		.map((c) => ({
			slug: c.slug,
			label: getCollectionPluralLabel(c),
			fieldCount: c.fields.length,
		}));

	return { content: [{ type: 'text', text: JSON.stringify(collections, null, 2) }] };
}

export function handleGetCollectionSchema(
	slug: string,
	config: MomentumConfig,
	isCollectionAllowed: (slug: string) => boolean,
): ToolResult {
	if (!isCollectionAllowed(slug)) {
		return {
			isError: true,
			content: [{ type: 'text', text: `Collection "${slug}" is not accessible via MCP` }],
		};
	}

	const collection = (config.collections ?? []).find((c) => c.slug === slug);
	if (!collection) {
		return {
			isError: true,
			content: [{ type: 'text', text: `Collection "${slug}" not found` }],
		};
	}

	const serialized = serializeCollection(collection);
	return { content: [{ type: 'text', text: JSON.stringify(serialized, null, 2) }] };
}
