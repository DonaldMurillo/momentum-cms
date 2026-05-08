/**
 * MCP Transport — Express router bridging HTTP to StreamableHTTPServerTransport.
 *
 * Creates a stateless MCP endpoint. Each POST request gets a fresh
 * McpServer + StreamableHTTPServerTransport pair as recommended by the
 * MCP SDK for stateless HTTP mode.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import type { Request, Response, NextFunction } from 'express';
import type { PluginLogger, UserContext } from '@momentumcms/core';
import type { MomentumAPI } from '@momentumcms/plugins/core';
import type { McpPluginConfig } from './mcp-plugin.types';
import { extractUserContext } from './auth';

/**
 * Synthetic context for unauthenticated MCP callers when `allowAnonymous: true`.
 * The api MUST always be scoped through `setContext` so collection access
 * control runs — otherwise the unscoped api defaults to a privileged context.
 *
 * The `'public'` role is intentionally NOT one of the project's AUTH_ROLES so
 * that any role-based access policy fails closed for anonymous callers.
 */
const ANONYMOUS_USER: UserContext = {
	id: 'mcp-anonymous',
	role: 'public',
};

/**
 * Cached dynamic imports — avoids per-request import() overhead.
 * The promise is memoized on first call; subsequent requests reuse it.
 */
type StreamableTransportModule = {
	StreamableHTTPServerTransport: typeof import('@modelcontextprotocol/sdk/server/streamableHttp.js').StreamableHTTPServerTransport;
};
type ServerFactoryModule = {
	createMcpServerInstance: typeof import('./mcp-server-factory').createMcpServerInstance;
};

let cachedStreamableTransport: Promise<StreamableTransportModule> | null = null;
let cachedServerFactory: Promise<ServerFactoryModule> | null = null;

export function getStreamableTransport(): Promise<StreamableTransportModule> {
	if (!cachedStreamableTransport) {
		cachedStreamableTransport = import('@modelcontextprotocol/sdk/server/streamableHttp.js').then(
			(mod) => ({ StreamableHTTPServerTransport: mod.StreamableHTTPServerTransport }),
		);
	}
	return cachedStreamableTransport;
}

export function getServerFactory(): Promise<ServerFactoryModule> {
	if (!cachedServerFactory) {
		cachedServerFactory = import('./mcp-server-factory').then((mod) => ({
			createMcpServerInstance: mod.createMcpServerInstance,
		}));
	}
	return cachedServerFactory;
}

/**
 * Creates an Express middleware handler for the MCP endpoint.
 *
 * The handler checks auth and API readiness, then delegates to the
 * MCP SDK's StreamableHTTPServerTransport for actual protocol handling.
 *
 * Auth is required by default. Anonymous access requires the explicit
 * `allowAnonymous: true` opt-in — `apiKeyRequired: false` alone is not
 * enough, because relaxed defaults are easy to enable by accident.
 */
export function createMcpRouter(
	config: McpPluginConfig,
	getApi: () => MomentumAPI | null,
	isCollectionAllowed: (slug: string) => boolean,
	isGlobalAllowed: (slug: string) => boolean,
	logger?: PluginLogger,
): (req: Request, res: Response, _next: NextFunction) => void {
	const apiKeyRequired = config.apiKeyRequired !== false;
	const allowAnonymous = config.allowAnonymous === true;
	// Anonymous is only honored when explicitly opted in AND auth is not required.
	const skipAuth = allowAnonymous && !apiKeyRequired;

	return (req: Request, res: Response, _next: NextFunction): void => {
		if (!skipAuth) {
			const user = extractUserContext(req);
			if (!user) {
				res.status(401).json({ error: 'Authentication required for MCP access' });
				return;
			}
		}

		// API readiness check
		const api = getApi();
		if (!api) {
			res.status(503).json({ error: 'CMS API not ready' });
			return;
		}

		// Only POST is supported in stateless mode
		if (req.method !== 'POST') {
			res.status(405).json({ error: 'Method not allowed in stateless MCP mode. Use POST.' });
			return;
		}

		// Delegate to the actual MCP handler (set up during onInit)
		handleMcpRequest(req, res, api, isCollectionAllowed, isGlobalAllowed, config).catch((err) => {
			logger?.error('MCP request handling failed', err);
			if (!res.headersSent) {
				res.status(500).json({ error: 'Internal MCP error' });
			}
		});
	};
}

async function handleMcpRequest(
	req: Request,
	res: Response,
	api: MomentumAPI,
	isCollectionAllowed: (slug: string) => boolean,
	isGlobalAllowed: (slug: string) => boolean,
	config: McpPluginConfig,
): Promise<void> {
	// Use cached dynamic imports — avoids import() on every request
	const [{ StreamableHTTPServerTransport }, { createMcpServerInstance }] = await Promise.all([
		getStreamableTransport(),
		getServerFactory(),
	]);

	// Always scope the api — fall back to anonymous so access control still runs
	// when `apiKeyRequired: false` and no user is on the request.
	const user = extractUserContext(req) ?? ANONYMOUS_USER;
	const scopedApi = api.setContext({ user });

	const server = createMcpServerInstance(
		config,
		() => scopedApi,
		() => api.getConfig(),
		isCollectionAllowed,
		isGlobalAllowed,
	);

	// Forward DNS-rebinding / Host validation options to the SDK transport.
	// Each option is only included when the caller set it so the SDK's own
	// defaults stand for unconfigured deployments.
	const transportOptions: Record<string, unknown> = {
		sessionIdGenerator: undefined, // stateless
	};
	if (config.enableDnsRebindingProtection !== undefined) {
		transportOptions['enableDnsRebindingProtection'] = config.enableDnsRebindingProtection;
	}
	if (config.allowedHosts !== undefined) {
		transportOptions['allowedHosts'] = config.allowedHosts;
	}
	if (config.allowedOrigins !== undefined) {
		transportOptions['allowedOrigins'] = config.allowedOrigins;
	}
	const transport = new StreamableHTTPServerTransport(
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- SDK option type is internal to the package
		transportOptions as ConstructorParameters<typeof StreamableHTTPServerTransport>[0],
	);

	await server.connect(transport);

	try {
		// Express Request/Response extend IncomingMessage/ServerResponse
		await transport.handleRequest(
			req satisfies Request as unknown as IncomingMessage, // eslint-disable-line @typescript-eslint/consistent-type-assertions -- Express Request extends IncomingMessage
			res satisfies Response as unknown as ServerResponse, // eslint-disable-line @typescript-eslint/consistent-type-assertions -- Express Response extends ServerResponse
			req.body,
		);
	} finally {
		await transport.close();
		await server.close();
	}
}
