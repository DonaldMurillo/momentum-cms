import { describe, it, expect, beforeEach } from 'vitest';
import { MomentumLogger, type LogEnricher } from '../logger';

describe('MomentumLogger', () => {
	let stdoutOutput: string[];
	let stderrOutput: string[];

	function createTestLogger(
		level: 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent' = 'debug',
		format: 'pretty' | 'json' = 'json',
	): MomentumLogger {
		return new MomentumLogger('Test', {
			level,
			format,
			timestamps: true,
			output: (msg: string) => {
				stdoutOutput.push(msg);
			},
			errorOutput: (msg: string) => {
				stderrOutput.push(msg);
			},
		});
	}

	beforeEach(() => {
		stdoutOutput = [];
		stderrOutput = [];
		MomentumLogger.clearEnrichers();
	});

	describe('log level filtering', () => {
		it('should log messages at or above the configured level', () => {
			const logger = createTestLogger('warn');
			logger.debug('nope');
			logger.info('nope');
			logger.warn('yes');
			logger.error('yes');
			logger.fatal('yes');

			expect(stdoutOutput).toHaveLength(0);
			expect(stderrOutput).toHaveLength(3);
		});

		it('should log all messages when level is debug', () => {
			const logger = createTestLogger('debug');
			logger.debug('d');
			logger.info('i');
			logger.warn('w');
			logger.error('e');
			logger.fatal('f');

			// debug and info go to stdout, warn/error/fatal go to stderr
			expect(stdoutOutput).toHaveLength(2);
			expect(stderrOutput).toHaveLength(3);
		});

		it('should log nothing when level is silent', () => {
			const logger = createTestLogger('silent');
			logger.debug('d');
			logger.info('i');
			logger.warn('w');
			logger.error('e');
			logger.fatal('f');

			expect(stdoutOutput).toHaveLength(0);
			expect(stderrOutput).toHaveLength(0);
		});
	});

	describe('output routing', () => {
		it('should route debug and info to stdout', () => {
			const logger = createTestLogger('debug');
			logger.debug('debug msg');
			logger.info('info msg');

			expect(stdoutOutput).toHaveLength(2);
			expect(stderrOutput).toHaveLength(0);
		});

		it('should route warn, error, and fatal to stderr', () => {
			const logger = createTestLogger('debug');
			logger.warn('warn msg');
			logger.error('error msg');
			logger.fatal('fatal msg');

			expect(stdoutOutput).toHaveLength(0);
			expect(stderrOutput).toHaveLength(3);
		});
	});

	describe('message content', () => {
		it('should include the message in output', () => {
			const logger = createTestLogger('debug', 'json');
			logger.info('Hello world');

			const parsed = JSON.parse(stdoutOutput[0].trim());
			expect(parsed.message).toBe('Hello world');
		});

		it('should include data when provided', () => {
			const logger = createTestLogger('debug', 'json');
			logger.info('test', { userId: '42' });

			const parsed = JSON.parse(stdoutOutput[0].trim());
			expect(parsed.data).toEqual({ userId: '42' });
		});

		it('should include the correct context', () => {
			const logger = createTestLogger('debug', 'json');
			logger.info('test');

			const parsed = JSON.parse(stdoutOutput[0].trim());
			expect(parsed.context).toBe('Test');
		});

		it('should include the correct level', () => {
			const logger = createTestLogger('debug', 'json');
			logger.warn('test');

			const parsed = JSON.parse(stderrOutput[0].trim());
			expect(parsed.level).toBe('warn');
		});
	});

	describe('child loggers', () => {
		it('should create a child with combined context', () => {
			const parent = createTestLogger('debug', 'json');
			const child = parent.child('Sub');
			child.info('from child');

			const parsed = JSON.parse(stdoutOutput[0].trim());
			expect(parsed.context).toBe('Test:Sub');
		});

		it('should support multiple levels of nesting', () => {
			const parent = createTestLogger('debug', 'json');
			const child = parent.child('A').child('B');
			child.info('deep');

			const parsed = JSON.parse(stdoutOutput[0].trim());
			expect(parsed.context).toBe('Test:A:B');
		});

		it('should share the same config as parent', () => {
			const parent = createTestLogger('error', 'json');
			const child = parent.child('Sub');
			child.info('filtered out');
			child.error('passes');

			expect(stdoutOutput).toHaveLength(0);
			expect(stderrOutput).toHaveLength(1);
		});
	});

	describe('enrichers', () => {
		it('should include enricher data in log entries', () => {
			const enricher: LogEnricher = {
				enrich: () => ({ traceId: 'trace-123', spanId: 'span-456' }),
			};
			MomentumLogger.registerEnricher(enricher);

			const logger = createTestLogger('debug', 'json');
			logger.info('test');

			const parsed = JSON.parse(stdoutOutput[0].trim());
			expect(parsed.traceId).toBe('trace-123');
			expect(parsed.spanId).toBe('span-456');
		});

		it('should combine data from multiple enrichers', () => {
			MomentumLogger.registerEnricher({ enrich: () => ({ a: 1 }) });
			MomentumLogger.registerEnricher({ enrich: () => ({ b: 2 }) });

			const logger = createTestLogger('debug', 'json');
			logger.info('test');

			const parsed = JSON.parse(stdoutOutput[0].trim());
			expect(parsed.a).toBe(1);
			expect(parsed.b).toBe(2);
		});

		it('should remove enrichers', () => {
			const enricher: LogEnricher = { enrich: () => ({ gone: true }) };
			MomentumLogger.registerEnricher(enricher);
			MomentumLogger.removeEnricher(enricher);

			const logger = createTestLogger('debug', 'json');
			logger.info('test');

			const parsed = JSON.parse(stdoutOutput[0].trim());
			expect(parsed).not.toHaveProperty('gone');
		});

		it('should clear all enrichers', () => {
			MomentumLogger.registerEnricher({ enrich: () => ({ x: 1 }) });
			MomentumLogger.registerEnricher({ enrich: () => ({ y: 2 }) });
			MomentumLogger.clearEnrichers();

			const logger = createTestLogger('debug', 'json');
			logger.info('test');

			const parsed = JSON.parse(stdoutOutput[0].trim());
			expect(parsed).not.toHaveProperty('x');
			expect(parsed).not.toHaveProperty('y');
		});
	});
});
