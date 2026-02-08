/**
 * Log level definitions and utilities.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';

export const LOG_LEVEL_VALUES: Readonly<Record<LogLevel, number>> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
	fatal: 4,
	silent: 5,
};

/**
 * Determines if a message at the given level should be logged
 * based on the configured minimum level.
 */
export function shouldLog(messageLevel: LogLevel, configuredLevel: LogLevel): boolean {
	return LOG_LEVEL_VALUES[messageLevel] >= LOG_LEVEL_VALUES[configuredLevel];
}
