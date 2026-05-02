/**
 * MCP Resources — momentum:// URI scheme for collections and globals.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MomentumConfig } from '@momentumcms/core';
import type { MomentumAPI } from '@momentumcms/plugins/core';
import { serializeCollection, getCollectionPluralLabel } from '../schema-serializer';

interface ApiWithGlobals extends MomentumAPI {
	global(slug: string): unknown;
}

interface GlobalOps {
	findOne(): Promise<unknown>;
}

export function registerSchemaResources(
	server: McpServer,
	getConfig: () => MomentumConfig,
	getApi: () => MomentumAPI | null,
	isCollectionAllowed: (slug: string) => boolean,
	isGlobalAllowed: (slug: string) => boolean,
	options: { globalsEnabled: boolean } = { globalsEnabled: true },
): void {
	// Static resource: list all collections
	server.registerResource(
		'collections',
		'momentum://collections',
		{ description: 'List of all CMS collections accessible via MCP' },
		() => {
			const config = getConfig();
			const collections = (config.collections ?? [])
				.filter((c) => isCollectionAllowed(c.slug))
				.map((c) => ({
					slug: c.slug,
					label: getCollectionPluralLabel(c),
				}));
			return {
				contents: [
					{
						uri: 'momentum://collections',
						mimeType: 'application/json',
						text: JSON.stringify(collections, null, 2),
					},
				],
			};
		},
	);

	// Template resource: collection schema
	server.registerResource(
		'collection-schema',
		new ResourceTemplate('momentum://collections/{slug}/schema', { list: undefined }),
		{ description: 'Field schema for a specific CMS collection' },
		(uri, variables) => {
			const slug = String(variables['slug']);
			const config = getConfig();

			if (!isCollectionAllowed(slug)) {
				return {
					contents: [
						{
							uri: uri.href,
							mimeType: 'text/plain',
							text: `Collection "${slug}" is not accessible`,
						},
					],
				};
			}

			const collection = (config.collections ?? []).find((c) => c.slug === slug);
			if (!collection) {
				return {
					contents: [
						{ uri: uri.href, mimeType: 'text/plain', text: `Collection "${slug}" not found` },
					],
				};
			}

			return {
				contents: [
					{
						uri: uri.href,
						mimeType: 'application/json',
						text: JSON.stringify(serializeCollection(collection), null, 2),
					},
				],
			};
		},
	);

	if (!options.globalsEnabled) return;

	// Static resource: list all globals (filtered)
	server.registerResource(
		'globals',
		'momentum://globals',
		{ description: 'List of all CMS globals (singleton documents) accessible via MCP' },
		() => {
			const config = getConfig();
			const globals = (config.globals ?? [])
				.filter((g) => isGlobalAllowed(g.slug))
				.map((g) => ({
					slug: g.slug,
					label: g.label ?? g.slug,
				}));
			return {
				contents: [
					{
						uri: 'momentum://globals',
						mimeType: 'application/json',
						text: JSON.stringify(globals, null, 2),
					},
				],
			};
		},
	);

	// Template resource: global document
	server.registerResource(
		'global-document',
		new ResourceTemplate('momentum://globals/{slug}', { list: undefined }),
		{ description: 'Current data for a specific CMS global document' },
		async (uri, variables) => {
			const slug = String(variables['slug']);

			// Uniform response for unknown or denied — differentiating would let
			// callers enumerate hidden globals by probing slugs.
			if (!isGlobalAllowed(slug)) {
				return {
					contents: [
						{ uri: uri.href, mimeType: 'text/plain', text: `Global "${slug}" is not accessible` },
					],
				};
			}

			const api = getApi();
			if (!api) {
				return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: 'CMS API not ready' }] };
			}

			try {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- MomentumAPI minimal interface lacks global(); full API has it at runtime
				const ops = (api as ApiWithGlobals).global(slug) as GlobalOps;
				const doc = await ops.findOne();
				return {
					contents: [
						{
							uri: uri.href,
							mimeType: 'application/json',
							text: JSON.stringify(doc, null, 2),
						},
					],
				};
			} catch (err) {
				// Surface access/adapter errors as a plain-text resource failure
				// instead of letting them propagate to the MCP SDK as an
				// unhandled rejection. Mirrors handleGetGlobal in tools/global-tools.ts.
				const message = err instanceof Error ? err.message : String(err);
				return {
					contents: [{ uri: uri.href, mimeType: 'text/plain', text: message }],
				};
			}
		},
	);
}
