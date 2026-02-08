/**
 * Logger singleton management.
 *
 * Mirrors the MomentumAPI singleton pattern from momentum-api.ts.
 */

import type { LoggingConfig } from './logger-config.types';
import { MomentumLogger } from './logger';

let loggerInstance: MomentumLogger | null = null;

const ROOT_CONTEXT = 'Momentum';

/**
 * Initialize the global Momentum logger.
 * Should be called once during server startup.
 *
 * @returns The root logger instance
 */
export function initializeMomentumLogger(config?: LoggingConfig): MomentumLogger {
	loggerInstance = new MomentumLogger(ROOT_CONTEXT, config);
	return loggerInstance;
}

/**
 * Get the initialized root logger.
 * Falls back to a default logger if not initialized (for use before init).
 */
export function getMomentumLogger(): MomentumLogger {
	if (!loggerInstance) {
		// Create a default logger so logging works even before initialization
		loggerInstance = new MomentumLogger(ROOT_CONTEXT);
	}
	return loggerInstance;
}

/**
 * Creates a child logger with a named context.
 * e.g., `createLogger('DB')` → logger with context `Momentum:DB`
 *
 * This is the primary way to get a logger in library code.
 */
export function createLogger(context: string): MomentumLogger {
	return getMomentumLogger().child(context);
}

/**
 * Reset the logger singleton. Primarily for testing.
 */
export function resetMomentumLogger(): void {
	loggerInstance = null;
	MomentumLogger.clearEnrichers();
}
