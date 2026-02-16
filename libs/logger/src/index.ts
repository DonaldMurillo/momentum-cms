/**
 * @momentumcms/logger
 *
 * Colorful, configurable logging engine for Momentum CMS.
 * Built from scratch with ANSI color support, log levels, and child loggers.
 */

// Logger class and enricher interface
export { MomentumLogger, type LogEnricher } from './lib/logger';

// Singleton management
export {
	initializeMomentumLogger,
	getMomentumLogger,
	resetMomentumLogger,
	createLogger,
} from './lib/logger-singleton';

// Log levels
export { type LogLevel, shouldLog, LOG_LEVEL_VALUES } from './lib/log-level';

// Config types
export {
	type LoggingConfig,
	type LogFormat,
	type ResolvedLoggingConfig,
	resolveLoggingConfig,
} from './lib/logger-config.types';

// Formatters
export { type LogEntry, type LogFormatter, prettyFormatter, jsonFormatter } from './lib/formatters';

// ANSI utilities
export { ANSI, colorize, supportsColor } from './lib/ansi-colors';
