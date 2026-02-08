import { describe, it, expect } from 'vitest';
import { shouldLog, LOG_LEVEL_VALUES, type LogLevel } from '../log-level';

describe('log-level', () => {
	describe('LOG_LEVEL_VALUES', () => {
		it('should have correct ordering from debug (lowest) to silent (highest)', () => {
			expect(LOG_LEVEL_VALUES.debug).toBeLessThan(LOG_LEVEL_VALUES.info);
			expect(LOG_LEVEL_VALUES.info).toBeLessThan(LOG_LEVEL_VALUES.warn);
			expect(LOG_LEVEL_VALUES.warn).toBeLessThan(LOG_LEVEL_VALUES.error);
			expect(LOG_LEVEL_VALUES.error).toBeLessThan(LOG_LEVEL_VALUES.fatal);
			expect(LOG_LEVEL_VALUES.fatal).toBeLessThan(LOG_LEVEL_VALUES.silent);
		});
	});

	describe('shouldLog', () => {
		it('should allow messages at or above the configured level', () => {
			expect(shouldLog('info', 'info')).toBe(true);
			expect(shouldLog('warn', 'info')).toBe(true);
			expect(shouldLog('error', 'info')).toBe(true);
			expect(shouldLog('fatal', 'info')).toBe(true);
		});

		it('should block messages below the configured level', () => {
			expect(shouldLog('debug', 'info')).toBe(false);
			expect(shouldLog('info', 'warn')).toBe(false);
			expect(shouldLog('warn', 'error')).toBe(false);
		});

		it('should allow all messages when level is debug', () => {
			const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];
			for (const level of levels) {
				expect(shouldLog(level, 'debug')).toBe(true);
			}
		});

		it('should block all messages when level is silent', () => {
			const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];
			for (const level of levels) {
				expect(shouldLog(level, 'silent')).toBe(false);
			}
		});

		it('should allow same-level messages', () => {
			const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];
			for (const level of levels) {
				expect(shouldLog(level, level)).toBe(true);
			}
		});
	});
});
