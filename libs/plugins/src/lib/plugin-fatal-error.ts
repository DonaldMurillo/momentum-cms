/**
 * Plugin Fatal Error
 *
 * Thrown by plugins that must halt server startup.
 * Regular plugin errors are logged and skipped (fail-open),
 * but PluginFatalError causes the entire init to fail.
 */

export class PluginFatalError extends Error {
	readonly pluginName: string;

	constructor(pluginName: string, message: string) {
		super(`[Plugin:${pluginName}] Fatal: ${message}`);
		this.name = 'PluginFatalError';
		this.pluginName = pluginName;
	}
}
