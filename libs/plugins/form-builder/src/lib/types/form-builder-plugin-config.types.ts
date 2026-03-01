/**
 * Configuration for the form builder plugin.
 */
export interface FormBuilderPluginConfig {
	/** Enable honeypot anti-spam field (default: true). */
	honeypot?: boolean;
	/** Max form submissions per IP per minute (default: 10). */
	rateLimitPerMinute?: number;
}
