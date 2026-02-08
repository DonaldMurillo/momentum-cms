/**
 * MomentumLogger — the core logging class.
 *
 * Supports log levels, child loggers, and enrichers.
 * Uses process.stdout/stderr directly (ESLint no-console compliant).
 */

import type { LogLevel } from './log-level';
import { shouldLog } from './log-level';
import type { LogEntry, LogFormatter } from './formatters';
import { prettyFormatter, jsonFormatter } from './formatters';
import type { LoggingConfig, ResolvedLoggingConfig } from './logger-config.types';
import { resolveLoggingConfig } from './logger-config.types';

/**
 * Interface for enriching log entries with additional context.
 * Used by plugins (e.g., OTel) to inject trace IDs into log output.
 */
export interface LogEnricher {
	enrich(): Record<string, unknown>;
}

const ERROR_LEVELS: Set<LogLevel> = new Set(['warn', 'error', 'fatal']);

export class MomentumLogger {
	private static enrichers: LogEnricher[] = [];

	readonly context: string;
	private readonly config: ResolvedLoggingConfig;
	private readonly formatter: LogFormatter;

	constructor(context: string, config?: LoggingConfig | ResolvedLoggingConfig) {
		this.context = context;
		this.config = isResolvedConfig(config) ? config : resolveLoggingConfig(config);
		this.formatter = this.config.format === 'json' ? jsonFormatter : prettyFormatter;
	}

	debug(message: string, data?: Record<string, unknown>): void {
		this.log('debug', message, data);
	}

	info(message: string, data?: Record<string, unknown>): void {
		this.log('info', message, data);
	}

	warn(message: string, data?: Record<string, unknown>): void {
		this.log('warn', message, data);
	}

	error(message: string, data?: Record<string, unknown>): void {
		this.log('error', message, data);
	}

	fatal(message: string, data?: Record<string, unknown>): void {
		this.log('fatal', message, data);
	}

	/**
	 * Creates a child logger with a sub-context.
	 * e.g., `Momentum:DB` → `Momentum:DB:Migrate`
	 */
	child(subContext: string): MomentumLogger {
		return new MomentumLogger(`${this.context}:${subContext}`, this.config);
	}

	/**
	 * Registers a global enricher that adds extra fields to all log entries.
	 */
	static registerEnricher(enricher: LogEnricher): void {
		MomentumLogger.enrichers.push(enricher);
	}

	/**
	 * Removes a previously registered enricher.
	 */
	static removeEnricher(enricher: LogEnricher): void {
		const index = MomentumLogger.enrichers.indexOf(enricher);
		if (index >= 0) {
			MomentumLogger.enrichers.splice(index, 1);
		}
	}

	/**
	 * Clears all registered enrichers. Primarily for testing.
	 */
	static clearEnrichers(): void {
		MomentumLogger.enrichers.length = 0;
	}

	private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
		if (!shouldLog(level, this.config.level)) return;

		const enrichments = this.collectEnrichments();

		const entry: LogEntry = {
			timestamp: new Date(),
			level,
			context: this.context,
			message,
			data,
			enrichments: Object.keys(enrichments).length > 0 ? enrichments : undefined,
		};

		const formatted = this.formatter(entry);

		if (ERROR_LEVELS.has(level)) {
			this.config.errorOutput(formatted);
		} else {
			this.config.output(formatted);
		}
	}

	private collectEnrichments(): Record<string, unknown> {
		const result: Record<string, unknown> = {};
		for (const enricher of MomentumLogger.enrichers) {
			Object.assign(result, enricher.enrich());
		}
		return result;
	}
}

function isResolvedConfig(
	config: LoggingConfig | ResolvedLoggingConfig | undefined,
): config is ResolvedLoggingConfig {
	if (!config) return false;
	return (
		typeof config.level === 'string' &&
		typeof config.format === 'string' &&
		typeof config.timestamps === 'boolean' &&
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- type guard narrows union
		typeof (config as ResolvedLoggingConfig).output === 'function' &&
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- type guard narrows union
		typeof (config as ResolvedLoggingConfig).errorOutput === 'function'
	);
}
