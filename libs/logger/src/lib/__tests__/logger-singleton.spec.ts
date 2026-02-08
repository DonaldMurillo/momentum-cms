import { describe, it, expect, beforeEach } from 'vitest';
import {
	initializeMomentumLogger,
	getMomentumLogger,
	resetMomentumLogger,
	createLogger,
} from '../logger-singleton';

describe('logger-singleton', () => {
	beforeEach(() => {
		resetMomentumLogger();
	});

	describe('initializeMomentumLogger', () => {
		it('should create a root logger with the given config', () => {
			const output: string[] = [];
			const logger = initializeMomentumLogger({
				level: 'debug',
				format: 'json',
				output: (msg) => output.push(msg),
				errorOutput: (msg) => output.push(msg),
			});

			logger.info('hello');
			const parsed = JSON.parse(output[0].trim());
			expect(parsed.context).toBe('Momentum');
			expect(parsed.message).toBe('hello');
		});
	});

	describe('getMomentumLogger', () => {
		it('should return the initialized logger', () => {
			const logger = initializeMomentumLogger({ level: 'info', format: 'json' });
			expect(getMomentumLogger()).toBe(logger);
		});

		it('should create a default logger when not initialized', () => {
			const logger = getMomentumLogger();
			expect(logger).toBeDefined();
		});
	});

	describe('createLogger', () => {
		it('should create a child logger with Momentum prefix', () => {
			const output: string[] = [];
			initializeMomentumLogger({
				level: 'debug',
				format: 'json',
				output: (msg) => output.push(msg),
				errorOutput: (msg) => output.push(msg),
			});

			const dbLogger = createLogger('DB');
			dbLogger.info('connected');

			const parsed = JSON.parse(output[0].trim());
			expect(parsed.context).toBe('Momentum:DB');
		});

		it('should work before explicit initialization', () => {
			const logger = createLogger('Early');
			// Should not throw
			expect(logger).toBeDefined();
		});
	});

	describe('resetMomentumLogger', () => {
		it('should clear the singleton', () => {
			const logger1 = initializeMomentumLogger({ level: 'info', format: 'json' });
			resetMomentumLogger();
			const logger2 = getMomentumLogger();
			// After reset, getMomentumLogger creates a new default instance
			expect(logger2).not.toBe(logger1);
		});
	});
});
