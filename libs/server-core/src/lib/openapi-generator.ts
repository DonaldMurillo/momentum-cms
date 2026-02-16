/**
 * OpenAPI Spec Generator for Momentum CMS
 *
 * Auto-generates an OpenAPI 3.0 specification from collection configs.
 * Covers standard CRUD routes, versioning, batch operations, search,
 * media upload, and GraphQL endpoints.
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed to narrow Field union to specific field types */

import type {
	CollectionConfig,
	Field,
	MomentumConfig,
	SelectField,
	RadioField,
	ArrayField,
	GroupField,
	BlocksField,
} from '@momentumcms/core';
import { flattenDataFields } from '@momentumcms/core';

/** OpenAPI 3.0 document (simplified typing for generation). */
export interface OpenAPIDocument {
	openapi: string;
	info: {
		title: string;
		version: string;
		description?: string;
	};
	servers?: Array<{ url: string; description?: string }>;
	paths: Record<string, Record<string, unknown>>;
	components: {
		schemas: Record<string, unknown>;
		securitySchemes?: Record<string, unknown>;
	};
	security?: Array<Record<string, string[]>>;
}

/** Options for generating the spec. */
export interface OpenAPIGeneratorOptions {
	/** API title (default: 'Momentum CMS API') */
	title?: string;
	/** API version string (default: '1.0.0') */
	version?: string;
	/** Description for the API */
	description?: string;
	/** Server URLs */
	servers?: Array<{ url: string; description?: string }>;
}

/**
 * Generate an OpenAPI 3.0 specification from a MomentumConfig.
 */
export function generateOpenAPISpec(
	config: MomentumConfig,
	options?: OpenAPIGeneratorOptions,
): OpenAPIDocument {
	const title = options?.title ?? 'Momentum CMS API';
	const version = options?.version ?? '1.0.0';

	const doc: OpenAPIDocument = {
		openapi: '3.0.3',
		info: {
			title,
			version,
			description:
				options?.description ?? 'Auto-generated REST API from Momentum CMS collection definitions.',
		},
		servers: options?.servers,
		paths: {},
		components: {
			schemas: {},
			securitySchemes: {
				cookieAuth: {
					type: 'apiKey',
					in: 'cookie',
					name: 'better-auth.session_token',
				},
				apiKeyAuth: {
					type: 'apiKey',
					in: 'header',
					name: 'X-API-Key',
				},
			},
		},
		security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
	};

	// Generate schemas and paths for each collection
	for (const collection of config.collections) {
		const schemaName = pascalCase(collection.slug);

		// Generate JSON Schema for the collection document
		doc.components.schemas[schemaName] = buildCollectionSchema(collection);
		doc.components.schemas[`${schemaName}Input`] = buildCollectionInputSchema(collection);

		// Standard CRUD paths
		addCollectionPaths(doc, collection, schemaName);

		// Search path
		addSearchPath(doc, collection, schemaName);

		// Batch operations path
		addBatchPath(doc, collection, schemaName);

		// Version paths (if versioning enabled)
		if (collection.versions) {
			addVersionPaths(doc, collection, schemaName);
		}

		// Custom endpoint paths
		if (collection.endpoints) {
			addCustomEndpointPaths(doc, collection);
		}
	}

	// Media upload paths (if storage configured)
	if (config.storage) {
		addMediaPaths(doc);
	}

	// GraphQL endpoint
	addGraphQLPath(doc);

	// Access permissions endpoint
	addAccessPath(doc);

	return doc;
}

// ============================================
// Schema Builders
// ============================================

function buildCollectionSchema(collection: CollectionConfig): Record<string, unknown> {
	const dataFields = flattenDataFields(collection.fields);
	const properties: Record<string, unknown> = {
		id: { type: 'string', description: 'Document ID' },
	};
	const requiredFields: string[] = ['id'];

	for (const field of dataFields) {
		properties[field.name] = fieldToJsonSchema(field);
		if (field.required) {
			requiredFields.push(field.name);
		}
	}

	// Add timestamp fields
	properties['createdAt'] = { type: 'string', format: 'date-time' };
	properties['updatedAt'] = { type: 'string', format: 'date-time' };

	// Add version status if versioning is enabled
	if (collection.versions) {
		properties['_status'] = {
			type: 'string',
			enum: ['draft', 'published'],
		};
	}

	return {
		type: 'object',
		properties,
		required: requiredFields,
	};
}

function buildCollectionInputSchema(collection: CollectionConfig): Record<string, unknown> {
	const dataFields = flattenDataFields(collection.fields);
	const properties: Record<string, unknown> = {};
	const requiredFields: string[] = [];

	for (const field of dataFields) {
		// Skip auto-generated fields
		if (field.type === 'password') continue;
		properties[field.name] = fieldToJsonSchema(field);
		if (field.required) {
			requiredFields.push(field.name);
		}
	}

	return {
		type: 'object',
		properties,
		...(requiredFields.length > 0 ? { required: requiredFields } : {}),
	};
}

function fieldToJsonSchema(field: Field): Record<string, unknown> {
	const base: Record<string, unknown> = {};
	if (field.description) base['description'] = field.description;

	switch (field.type) {
		case 'text':
		case 'textarea':
		case 'richText':
		case 'email':
		case 'password':
		case 'slug':
			return { ...base, type: 'string' };

		case 'number':
			return { ...base, type: 'number' };

		case 'date':
			return { ...base, type: 'string', format: 'date-time' };

		case 'checkbox':
			return { ...base, type: 'boolean' };

		case 'select': {
			const sel = field as SelectField;
			const enumVals = sel.options.map((o) => o.value);
			if (sel.hasMany) {
				return {
					...base,
					type: 'array',
					items: { type: typeof enumVals[0] === 'number' ? 'number' : 'string', enum: enumVals },
				};
			}
			return {
				...base,
				type: typeof enumVals[0] === 'number' ? 'number' : 'string',
				enum: enumVals,
			};
		}

		case 'radio': {
			const rad = field as RadioField;
			const radVals = rad.options.map((o) => o.value);
			return { ...base, type: typeof radVals[0] === 'number' ? 'number' : 'string', enum: radVals };
		}

		case 'upload':
		case 'relationship':
			return {
				...base,
				type: 'string',
				description: (base['description'] ?? 'Related document ID') as string,
			};

		case 'array': {
			const arr = field as ArrayField;
			const itemProps: Record<string, unknown> = {};
			for (const f of arr.fields) {
				itemProps[f.name] = fieldToJsonSchema(f);
			}
			return { ...base, type: 'array', items: { type: 'object', properties: itemProps } };
		}

		case 'group': {
			const grp = field as GroupField;
			const grpProps: Record<string, unknown> = {};
			for (const f of grp.fields) {
				grpProps[f.name] = fieldToJsonSchema(f);
			}
			return { ...base, type: 'object', properties: grpProps };
		}

		case 'blocks': {
			const blk = field as BlocksField;
			const oneOf = blk.blocks.map((block) => {
				const blockProps: Record<string, unknown> = {
					blockType: { type: 'string', enum: [block.slug] },
				};
				for (const f of block.fields) {
					blockProps[f.name] = fieldToJsonSchema(f);
				}
				return { type: 'object', properties: blockProps, required: ['blockType'] };
			});
			return { ...base, type: 'array', items: { oneOf } };
		}

		case 'json':
			return { ...base, type: 'object', additionalProperties: true };

		case 'point':
			return {
				...base,
				type: 'object',
				properties: { lat: { type: 'number' }, lng: { type: 'number' } },
			};

		default:
			return { ...base, type: 'string' };
	}
}

// ============================================
// Path Builders
// ============================================

function addCollectionPaths(
	doc: OpenAPIDocument,
	collection: CollectionConfig,
	schemaName: string,
): void {
	const slug = collection.slug;
	const singular = collection.labels?.singular ?? slug;
	const plural = collection.labels?.plural ?? `${slug}s`;
	const tag = plural;

	// GET /:collection - List
	const listPath = `/${slug}`;
	doc.paths[listPath] = {
		...doc.paths[listPath],
		get: {
			tags: [tag],
			summary: `List ${plural}`,
			operationId: `list${schemaName}`,
			parameters: [
				{
					name: 'limit',
					in: 'query',
					schema: { type: 'integer' },
					description: 'Max results per page',
				},
				{ name: 'page', in: 'query', schema: { type: 'integer' }, description: 'Page number' },
				{
					name: 'sort',
					in: 'query',
					schema: { type: 'string' },
					description: 'Sort field (prefix with - for descending)',
				},
				{ name: 'locale', in: 'query', schema: { type: 'string' }, description: 'Locale code' },
			],
			responses: {
				'200': {
					description: `List of ${plural}`,
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									docs: { type: 'array', items: { $ref: `#/components/schemas/${schemaName}` } },
									totalDocs: { type: 'integer' },
									page: { type: 'integer' },
									totalPages: { type: 'integer' },
									hasNextPage: { type: 'boolean' },
									hasPrevPage: { type: 'boolean' },
								},
							},
						},
					},
				},
			},
		},
		post: {
			tags: [tag],
			summary: `Create ${singular}`,
			operationId: `create${schemaName}`,
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: { $ref: `#/components/schemas/${schemaName}Input` },
					},
				},
			},
			responses: {
				'201': {
					description: `Created ${singular}`,
					content: {
						'application/json': {
							schema: { $ref: `#/components/schemas/${schemaName}` },
						},
					},
				},
				'400': { description: 'Validation error' },
				'403': { description: 'Access denied' },
			},
		},
	};

	// GET/PATCH/PUT/DELETE /:collection/:id
	const itemPath = `/${slug}/{id}`;
	doc.paths[itemPath] = {
		get: {
			tags: [tag],
			summary: `Get ${singular} by ID`,
			operationId: `get${schemaName}ById`,
			parameters: [
				{ name: 'id', in: 'path', required: true, schema: { type: 'string' } },
				{ name: 'locale', in: 'query', schema: { type: 'string' } },
			],
			responses: {
				'200': {
					description: singular,
					content: {
						'application/json': {
							schema: { $ref: `#/components/schemas/${schemaName}` },
						},
					},
				},
				'404': { description: 'Not found' },
			},
		},
		patch: {
			tags: [tag],
			summary: `Update ${singular}`,
			operationId: `update${schemaName}`,
			parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: { $ref: `#/components/schemas/${schemaName}Input` },
					},
				},
			},
			responses: {
				'200': {
					description: `Updated ${singular}`,
					content: {
						'application/json': {
							schema: { $ref: `#/components/schemas/${schemaName}` },
						},
					},
				},
				'404': { description: 'Not found' },
				'403': { description: 'Access denied' },
			},
		},
		delete: {
			tags: [tag],
			summary: `Delete ${singular}`,
			operationId: `delete${schemaName}`,
			parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
			responses: {
				'200': { description: 'Deleted' },
				'404': { description: 'Not found' },
				'403': { description: 'Access denied' },
			},
		},
	};
}

function addSearchPath(
	doc: OpenAPIDocument,
	collection: CollectionConfig,
	schemaName: string,
): void {
	const slug = collection.slug;
	const plural = collection.labels?.plural ?? `${slug}s`;

	doc.paths[`/${slug}/search`] = {
		get: {
			tags: [plural],
			summary: `Search ${plural}`,
			operationId: `search${schemaName}`,
			parameters: [
				{
					name: 'q',
					in: 'query',
					required: true,
					schema: { type: 'string' },
					description: 'Search query',
				},
				{
					name: 'fields',
					in: 'query',
					schema: { type: 'string' },
					description: 'Comma-separated field names to search',
				},
				{ name: 'limit', in: 'query', schema: { type: 'integer' } },
				{ name: 'page', in: 'query', schema: { type: 'integer' } },
			],
			responses: {
				'200': {
					description: 'Search results',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									docs: { type: 'array', items: { $ref: `#/components/schemas/${schemaName}` } },
									totalDocs: { type: 'integer' },
								},
							},
						},
					},
				},
			},
		},
	};
}

function addBatchPath(
	doc: OpenAPIDocument,
	collection: CollectionConfig,
	schemaName: string,
): void {
	const slug = collection.slug;
	const plural = collection.labels?.plural ?? `${slug}s`;

	doc.paths[`/${slug}/batch`] = {
		post: {
			tags: [plural],
			summary: `Batch operations on ${plural}`,
			operationId: `batch${schemaName}`,
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								operation: { type: 'string', enum: ['create', 'update', 'delete'] },
								items: {
									type: 'array',
									items: { $ref: `#/components/schemas/${schemaName}Input` },
									description: 'Items for create/update operations',
								},
								ids: {
									type: 'array',
									items: { type: 'string' },
									description: 'IDs for delete operations',
								},
							},
							required: ['operation'],
						},
					},
				},
			},
			responses: {
				'200': { description: 'Batch result' },
				'201': { description: 'Batch created' },
				'400': { description: 'Invalid operation' },
			},
		},
	};
}

function addVersionPaths(
	doc: OpenAPIDocument,
	collection: CollectionConfig,
	schemaName: string,
): void {
	const slug = collection.slug;
	const plural = collection.labels?.plural ?? `${slug}s`;

	// GET /:collection/:id/versions
	doc.paths[`/${slug}/{id}/versions`] = {
		get: {
			tags: [plural],
			summary: 'List document versions',
			operationId: `list${schemaName}Versions`,
			parameters: [
				{ name: 'id', in: 'path', required: true, schema: { type: 'string' } },
				{ name: 'limit', in: 'query', schema: { type: 'integer' } },
				{ name: 'page', in: 'query', schema: { type: 'integer' } },
			],
			responses: {
				'200': { description: 'Version list' },
			},
		},
	};

	// POST /:collection/:id/publish
	doc.paths[`/${slug}/{id}/publish`] = {
		post: {
			tags: [plural],
			summary: 'Publish a document',
			operationId: `publish${schemaName}`,
			parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
			responses: {
				'200': { description: 'Published' },
			},
		},
	};

	// POST /:collection/:id/unpublish
	doc.paths[`/${slug}/{id}/unpublish`] = {
		post: {
			tags: [plural],
			summary: 'Unpublish a document',
			operationId: `unpublish${schemaName}`,
			parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
			responses: {
				'200': { description: 'Unpublished' },
			},
		},
	};

	// POST /:collection/:id/versions/restore
	doc.paths[`/${slug}/{id}/versions/restore`] = {
		post: {
			tags: [plural],
			summary: 'Restore a version',
			operationId: `restore${schemaName}Version`,
			parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								versionId: { type: 'string' },
								publish: { type: 'boolean' },
							},
							required: ['versionId'],
						},
					},
				},
			},
			responses: {
				'200': { description: 'Version restored' },
			},
		},
	};

	// POST /:collection/:id/schedule-publish
	doc.paths[`/${slug}/{id}/schedule-publish`] = {
		post: {
			tags: [plural],
			summary: 'Schedule a document for future publishing',
			operationId: `schedule${schemaName}Publish`,
			parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								publishAt: { type: 'string', format: 'date-time' },
							},
							required: ['publishAt'],
						},
					},
				},
			},
			responses: {
				'200': { description: 'Scheduled' },
			},
		},
	};
}

function addCustomEndpointPaths(doc: OpenAPIDocument, collection: CollectionConfig): void {
	const slug = collection.slug;
	const plural = collection.labels?.plural ?? `${slug}s`;

	for (const endpoint of collection.endpoints ?? []) {
		const path = `/${slug}/${endpoint.path.replace(/^\//, '')}`;
		if (!doc.paths[path]) {
			doc.paths[path] = {};
		}
		(doc.paths[path] as Record<string, unknown>)[endpoint.method] = {
			tags: [plural],
			summary: `Custom: ${endpoint.method.toUpperCase()} ${endpoint.path}`,
			operationId: `custom_${slug}_${endpoint.method}_${endpoint.path.replace(/\W/g, '_')}`,
			responses: {
				'200': { description: 'Success' },
			},
		};
	}
}

function addMediaPaths(doc: OpenAPIDocument): void {
	doc.paths['/media/upload'] = {
		post: {
			tags: ['Media'],
			summary: 'Upload a file',
			operationId: 'uploadMedia',
			requestBody: {
				required: true,
				content: {
					'multipart/form-data': {
						schema: {
							type: 'object',
							properties: {
								file: { type: 'string', format: 'binary' },
								alt: { type: 'string', description: 'Alt text for the file' },
							},
							required: ['file'],
						},
					},
				},
			},
			responses: {
				'201': { description: 'File uploaded' },
				'400': { description: 'Invalid file' },
				'401': { description: 'Authentication required' },
			},
		},
	};

	doc.paths['/media/file/{path}'] = {
		get: {
			tags: ['Media'],
			summary: 'Serve an uploaded file',
			operationId: 'getMediaFile',
			parameters: [
				{
					name: 'path',
					in: 'path',
					required: true,
					schema: { type: 'string' },
					description: 'Storage path',
				},
			],
			responses: {
				'200': {
					description: 'File content',
					content: { '*/*': { schema: { type: 'string', format: 'binary' } } },
				},
				'404': { description: 'File not found' },
			},
		},
	};
}

function addGraphQLPath(doc: OpenAPIDocument): void {
	doc.paths['/graphql'] = {
		post: {
			tags: ['GraphQL'],
			summary: 'Execute a GraphQL query',
			operationId: 'graphql',
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								query: { type: 'string' },
								variables: { type: 'object', additionalProperties: true },
								operationName: { type: 'string' },
							},
							required: ['query'],
						},
					},
				},
			},
			responses: {
				'200': { description: 'GraphQL response' },
			},
		},
	};
}

function addAccessPath(doc: OpenAPIDocument): void {
	doc.paths['/access'] = {
		get: {
			tags: ['Access'],
			summary: 'Get collection permissions for the current user',
			operationId: 'getAccess',
			responses: {
				'200': {
					description: 'Permissions map',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									collections: { type: 'object', additionalProperties: true },
								},
							},
						},
					},
				},
			},
		},
	};
}

// ============================================
// Utilities
// ============================================

function pascalCase(str: string): string {
	return str
		.split(/[-_\s]/)
		.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
		.join('');
}
