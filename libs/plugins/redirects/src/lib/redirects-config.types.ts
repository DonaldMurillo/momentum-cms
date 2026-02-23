/**
 * Configuration for the redirects plugin.
 */
export interface RedirectsPluginConfig {
	/** Enable/disable the plugin. Default: true */
	enabled?: boolean;
	/** Cache TTL in milliseconds for redirect lookups. Default: 60000 (1 minute) */
	cacheTtl?: number;
}
