/**
 * MCP Plugin Configuration Types
 */

/**
 * Configuration for the MCP server plugin.
 *
 * @example
 * ```typescript
 * mcpPlugin({
 *   path: '/mcp',
 *   apiKeyRequired: true,
 *   tools: { read: true, write: false, globals: true },
 *   allowedCollections: ['posts', 'products'],
 *   deniedGlobals: ['site-secrets'],
 * })
 * ```
 */
export interface McpPluginConfig {
	/** Enable/disable the plugin. @default true */
	enabled?: boolean;

	/** Mount path under the API root. With default '/mcp', the endpoint is served at `/api/mcp`. @default '/mcp' */
	path?: string;

	/** Require authenticated user (via API key or session) for all MCP requests. @default true */
	apiKeyRequired?: boolean;

	/**
	 * Explicitly allow anonymous (unauthenticated) MCP calls. Only honored
	 * when `apiKeyRequired: false`. Setting `apiKeyRequired: false` alone
	 * still rejects unauthenticated requests with 401 — anonymous access
	 * must be opted into deliberately because exposed write tools and
	 * permissive default access policies make this a security footgun.
	 * @default false
	 */
	allowAnonymous?: boolean;

	/** Whitelist of collection slugs exposed via MCP. Empty array means all non-denied collections. @default [] */
	allowedCollections?: string[];

	/** Blacklist of collection slugs hidden from MCP. @default [] */
	deniedCollections?: string[];

	/** Whitelist of global slugs exposed via MCP. Empty array means all non-denied globals. @default [] */
	allowedGlobals?: string[];

	/** Blacklist of global slugs hidden from MCP. @default [] */
	deniedGlobals?: string[];

	/** Enable/disable tool categories. */
	tools?: McpToolsConfig;

	/** Server name exposed in MCP protocol metadata. @default 'momentum-cms' */
	serverName?: string;

	/** Server version exposed in MCP protocol metadata. */
	serverVersion?: string;

	/**
	 * Enable Host/Origin validation in the underlying StreamableHTTPServerTransport
	 * to defend against DNS-rebinding attacks against locally-bound servers.
	 *
	 * Setting this to `true` without also providing `allowedHosts`/`allowedOrigins`
	 * defers to the SDK's default policy. For production deployments, prefer
	 * passing explicit allow-lists.
	 * @default false
	 */
	enableDnsRebindingProtection?: boolean;

	/**
	 * Allow-list of `Host` header values the MCP transport will accept.
	 * Forwarded to `StreamableHTTPServerTransport` when set.
	 */
	allowedHosts?: string[];

	/**
	 * Allow-list of `Origin` header values the MCP transport will accept.
	 * Forwarded to `StreamableHTTPServerTransport` when set.
	 */
	allowedOrigins?: string[];
}

export interface McpToolsConfig {
	/** Enable read tools (find, get, search, list, count). @default true */
	read?: boolean;

	/** Enable write tools (create, update, delete). @default false — must be explicitly enabled */
	write?: boolean;

	/** Enable global tools (list, get, update). @default true */
	globals?: boolean;
}
