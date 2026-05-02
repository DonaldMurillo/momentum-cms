/**
 * MCP Plugin for Momentum CMS
 *
 * Exposes CMS collections, globals, and schemas to AI tools
 * via the Model Context Protocol (MCP) standard.
 *
 * @example
 * ```typescript
 * import { mcpPlugin } from '@momentumcms/plugins/mcp';
 *
 * export default defineMomentumConfig({
 *   plugins: [
 *     mcpPlugin({
 *       path: '/mcp',
 *       apiKeyRequired: true,
 *       tools: { read: true, write: false },
 *     }),
 *   ],
 * });
 * ```
 */

import type {
	MomentumPlugin,
	PluginContext,
	PluginReadyContext,
	MomentumAPI,
} from '@momentumcms/plugins/core';
import type { McpPluginConfig } from './mcp-plugin.types';
import { createCollectionFilter, createGlobalFilter } from './collection-filter';
import { createMcpRouter } from './mcp-transport';

export function mcpPlugin(config: McpPluginConfig = {}): MomentumPlugin {
	const enabled = config.enabled !== false;
	const path = config.path ?? '/mcp';

	let momentumApi: MomentumAPI | null = null;

	return {
		name: 'mcp',

		async onInit(context: PluginContext) {
			if (!enabled) return;

			const isCollectionAllowed = createCollectionFilter(
				context.collections,
				config.allowedCollections ?? [],
				config.deniedCollections ?? [],
			);

			const isGlobalAllowed = createGlobalFilter(
				context.config.globals ?? [],
				config.allowedGlobals ?? [],
				config.deniedGlobals ?? [],
			);

			const router = createMcpRouter(
				config,
				() => momentumApi,
				isCollectionAllowed,
				isGlobalAllowed,
				context.logger,
			);

			context.registerMiddleware({
				path,
				handler: router,
				position: 'before-api',
			});

			context.logger.info(`MCP server plugin initialized at ${path}`);
		},

		async onReady(context: PluginReadyContext) {
			if (!enabled) return;

			momentumApi = context.api;
			context.logger.info('MCP server ready — accepting connections');
		},

		async onShutdown(context: PluginContext) {
			if (!enabled) return;
			momentumApi = null;
			context.logger.info('MCP server shut down');
		},
	};
}
