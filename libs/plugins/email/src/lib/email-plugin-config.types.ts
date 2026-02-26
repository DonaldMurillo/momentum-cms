import type { MomentumPlugin, MomentumAPI } from '@momentumcms/core';

/**
 * Configuration options for the email template management plugin.
 */
export interface EmailPluginConfig {
	/** Whether the plugin is enabled. @default true */
	enabled?: boolean;
}

/**
 * Extended plugin instance with email-specific helpers.
 */
export interface EmailPluginInstance extends MomentumPlugin {
	/** Get the Momentum API instance (available after onReady). */
	getApi(): MomentumAPI | null;
}
