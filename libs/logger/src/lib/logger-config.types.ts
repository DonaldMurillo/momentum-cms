/**
 * Logger configuration types.
 */

import type { LogLevel } from './log-level';

export type LogFormat = 'pretty' | 'json';

export interface LoggingConfig {
	/** Minimum log level. @default 'info' */
	level?: LogLevel;
	/** Output format. @default 'pretty' */
	format?: LogFormat;
	/** Whether to include timestamps. @default true */
	timestamps?: boolean;
	/** Custom output function for debug/info (defaults to process.stdout.write) */
	output?: (message: string) => void;
	/** Custom error output function for warn/error/fatal (defaults to process.stderr.write) */
	errorOutput?: (message: string) => void;
}

export interface ResolvedLoggingConfig {
	level: LogLevel;
	format: LogFormat;
	timestamps: boolean;
	output: (message: string) => void;
	errorOutput: (message: string) => void;
}

/**
 * Resolves logging config with defaults applied.
 */
export function resolveLoggingConfig(config?: LoggingConfig): ResolvedLoggingConfig {
	return {
		level: config?.level ?? 'info',
		format: config?.format ?? 'pretty',
		timestamps: config?.timestamps ?? true,
		output:
			config?.output ??
			((msg: string): void => {
				process.stdout.write(msg);
			}),
		errorOutput:
			config?.errorOutput ??
			((msg: string): void => {
				process.stderr.write(msg);
			}),
	};
}
