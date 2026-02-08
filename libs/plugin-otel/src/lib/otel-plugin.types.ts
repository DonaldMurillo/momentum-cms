/**
 * OTel Plugin Configuration Types
 */

/**
 * Configuration for the OpenTelemetry plugin.
 */
export interface OtelPluginConfig {
	/** Service name for traces. @default 'momentum-cms' */
	serviceName?: string;

	/** Whether to enrich logs with trace/span IDs. @default true */
	enrichLogs?: boolean;

	/** Custom attributes to add to all spans */
	attributes?: Record<string, string>;

	/** Collection operations to trace. @default all */
	operations?: Array<'create' | 'update' | 'delete' | 'find'>;
}
