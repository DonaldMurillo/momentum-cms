/**
 * MCP Server Factory
 *
 * Creates and configures an McpServer with all tools, resources, and prompts
 * registered based on the plugin configuration.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MomentumConfig } from '@momentumcms/core';
import type { MomentumAPI } from '@momentumcms/plugins/core';
import type { McpPluginConfig } from './mcp-plugin.types';
import { version as PLUGIN_VERSION } from '../../package.json';
import {
	handleFindDocuments,
	handleGetDocument,
	handleCreateDocument,
	handleUpdateDocument,
	handleDeleteDocument,
	handleSearchDocuments,
	handleCountDocuments,
} from './tools/collection-tools';
import { handleListCollections, handleGetCollectionSchema } from './tools/schema-tools';
import { handleListGlobals, handleGetGlobal, handleUpdateGlobal } from './tools/global-tools';
import { registerSchemaResources } from './resources/schema-resources';
import { registerContentPrompts } from './prompts/content-prompts';

export function createMcpServerInstance(
	config: McpPluginConfig,
	getApi: () => MomentumAPI | null,
	getConfig: () => MomentumConfig,
	isCollectionAllowed: (slug: string) => boolean,
	isGlobalAllowed: (slug: string) => boolean,
): McpServer {
	const server = new McpServer(
		{
			name: config.serverName ?? 'momentum-cms',
			version: config.serverVersion ?? PLUGIN_VERSION,
		},
		{
			capabilities: {
				tools: {},
				resources: {},
				prompts: {},
			},
		},
	);

	const readEnabled = config.tools?.read !== false;
	const writeEnabled = config.tools?.write === true;
	const globalsEnabled = config.tools?.globals !== false;

	// --- Schema Tools (always enabled) ---

	server.registerTool(
		'list_collections',
		{
			description:
				'List all CMS collections accessible via MCP with their slugs, labels, and field counts',
			annotations: { readOnlyHint: true },
		},
		() => {
			const momentumConfig = getConfig();
			return handleListCollections(momentumConfig, isCollectionAllowed);
		},
	);

	server.registerTool(
		'get_collection_schema',
		{
			description:
				'Get the detailed field schema for a specific CMS collection, showing all field types, constraints, and relationships',
			inputSchema: {
				collection: z.string().describe('Collection slug (e.g. "posts", "products")'),
			},
			annotations: { readOnlyHint: true },
		},
		(args) => {
			const momentumConfig = getConfig();
			return handleGetCollectionSchema(args.collection, momentumConfig, isCollectionAllowed);
		},
	);

	// --- Read Tools ---

	if (readEnabled) {
		server.registerTool(
			'find_documents',
			{
				description: 'Query documents in a collection with filtering, sorting, and pagination',
				inputSchema: {
					collection: z.string().describe('Collection slug'),
					where: z
						.string()
						.optional()
						.describe('JSON where clause (e.g. {"status":{"equals":"published"}})'),
					sort: z
						.string()
						.optional()
						.describe('Sort field, prefix with - for descending (e.g. "-createdAt")'),
					limit: z.number().optional().describe('Max documents to return (1-100, default 10)'),
					page: z.number().optional().describe('Page number (1-indexed, default 1)'),
					depth: z.number().optional().describe('Relationship population depth (0-3, default 0)'),
				},
				annotations: { readOnlyHint: true },
			},
			async (args) => {
				const api = getApi();
				if (!api)
					return {
						isError: true as const,
						content: [{ type: 'text' as const, text: 'CMS API not ready' }],
					};
				return handleFindDocuments(api, args, isCollectionAllowed);
			},
		);

		server.registerTool(
			'get_document',
			{
				description: 'Get a single document by its ID from a collection',
				inputSchema: {
					collection: z.string().describe('Collection slug'),
					id: z.string().describe('Document ID'),
					depth: z.number().optional().describe('Relationship population depth (0-3, default 0)'),
				},
				annotations: { readOnlyHint: true },
			},
			async (args) => {
				const api = getApi();
				if (!api)
					return {
						isError: true as const,
						content: [{ type: 'text' as const, text: 'CMS API not ready' }],
					};
				return handleGetDocument(api, args, isCollectionAllowed);
			},
		);

		server.registerTool(
			'search_documents',
			{
				description: 'Full-text search across documents in a collection',
				inputSchema: {
					collection: z.string().describe('Collection slug'),
					query: z.string().describe('Search query text'),
					limit: z.number().optional().describe('Max documents to return (1-100, default 10)'),
					page: z.number().optional().describe('Page number (1-indexed, default 1)'),
				},
				annotations: { readOnlyHint: true },
			},
			async (args) => {
				const api = getApi();
				if (!api)
					return {
						isError: true as const,
						content: [{ type: 'text' as const, text: 'CMS API not ready' }],
					};
				return handleSearchDocuments(api, args, isCollectionAllowed);
			},
		);

		server.registerTool(
			'count_documents',
			{
				description: 'Count documents in a collection, optionally filtered by a where clause',
				inputSchema: {
					collection: z.string().describe('Collection slug'),
					where: z.string().optional().describe('JSON where clause to filter counted documents'),
				},
				annotations: { readOnlyHint: true },
			},
			async (args) => {
				const api = getApi();
				if (!api)
					return {
						isError: true as const,
						content: [{ type: 'text' as const, text: 'CMS API not ready' }],
					};
				return handleCountDocuments(api, args, isCollectionAllowed);
			},
		);
	}

	// --- Write Tools ---

	if (writeEnabled) {
		server.registerTool(
			'create_document',
			{
				description: 'Create a new document in a collection',
				inputSchema: {
					collection: z.string().describe('Collection slug'),
					data: z.string().describe('JSON-encoded document data matching the collection schema'),
				},
				annotations: { destructiveHint: false },
			},
			async (args) => {
				const api = getApi();
				if (!api)
					return {
						isError: true as const,
						content: [{ type: 'text' as const, text: 'CMS API not ready' }],
					};
				return handleCreateDocument(api, args, isCollectionAllowed);
			},
		);

		server.registerTool(
			'update_document',
			{
				description: 'Update an existing document by ID with partial data',
				inputSchema: {
					collection: z.string().describe('Collection slug'),
					id: z.string().describe('Document ID to update'),
					data: z.string().describe('JSON-encoded partial document data'),
				},
				// destructive: overwrites existing fields in place; clients use this hint
				// to gate auto-approval, so it must mirror update_global below.
				annotations: { destructiveHint: true },
			},
			async (args) => {
				const api = getApi();
				if (!api)
					return {
						isError: true as const,
						content: [{ type: 'text' as const, text: 'CMS API not ready' }],
					};
				return handleUpdateDocument(api, args, isCollectionAllowed);
			},
		);

		server.registerTool(
			'delete_document',
			{
				description: 'Delete a document by ID from a collection',
				inputSchema: {
					collection: z.string().describe('Collection slug'),
					id: z.string().describe('Document ID to delete'),
				},
				annotations: { destructiveHint: true },
			},
			async (args) => {
				const api = getApi();
				if (!api)
					return {
						isError: true as const,
						content: [{ type: 'text' as const, text: 'CMS API not ready' }],
					};
				return handleDeleteDocument(api, args, isCollectionAllowed);
			},
		);
	}

	// --- Global Tools ---

	if (globalsEnabled) {
		server.registerTool(
			'list_globals',
			{
				description: 'List all CMS globals (singleton documents) with their slugs and labels',
				annotations: { readOnlyHint: true },
			},
			() => {
				const momentumConfig = getConfig();
				return handleListGlobals(momentumConfig, isGlobalAllowed);
			},
		);

		server.registerTool(
			'get_global',
			{
				description: 'Read a global (singleton) document by its slug',
				inputSchema: {
					slug: z.string().describe('Global slug (e.g. "site-settings", "navigation")'),
					depth: z.number().optional().describe('Relationship population depth (0-3)'),
				},
				annotations: { readOnlyHint: true },
			},
			async (args) => {
				const api = getApi();
				if (!api)
					return {
						isError: true as const,
						content: [{ type: 'text' as const, text: 'CMS API not ready' }],
					};
				return handleGetGlobal(api, args, isGlobalAllowed);
			},
		);

		if (writeEnabled) {
			server.registerTool(
				'update_global',
				{
					description: 'Update a global (singleton) document with partial data',
					inputSchema: {
						slug: z.string().describe('Global slug'),
						data: z.string().describe('JSON-encoded partial global data'),
					},
					// destructive: globals are singletons, so update overwrites in place
					annotations: { destructiveHint: true },
				},
				async (args) => {
					const api = getApi();
					if (!api)
						return {
							isError: true as const,
							content: [{ type: 'text' as const, text: 'CMS API not ready' }],
						};
					return handleUpdateGlobal(api, args, isGlobalAllowed);
				},
			);
		}
	}

	// --- Resources ---
	registerSchemaResources(server, getConfig, getApi, isCollectionAllowed, isGlobalAllowed, {
		globalsEnabled,
	});

	// --- Prompts ---
	registerContentPrompts(server, getConfig, getApi, isCollectionAllowed);

	return server;
}
