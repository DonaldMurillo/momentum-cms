import { describe, it, expect } from 'vitest';
import { ANSI, colorize, supportsColor } from '../ansi-colors';

describe('ansi-colors', () => {
	describe('ANSI constants', () => {
		it('should have a reset code', () => {
			expect(ANSI.reset).toBe('\x1b[0m');
		});

		it('should have foreground color codes', () => {
			expect(ANSI.red).toBe('\x1b[31m');
			expect(ANSI.green).toBe('\x1b[32m');
			expect(ANSI.cyan).toBe('\x1b[36m');
			expect(ANSI.gray).toBe('\x1b[90m');
		});

		it('should have background color codes', () => {
			expect(ANSI.bgRed).toBe('\x1b[41m');
		});

		it('should have style codes', () => {
			expect(ANSI.bold).toBe('\x1b[1m');
			expect(ANSI.dim).toBe('\x1b[2m');
		});
	});

	describe('colorize', () => {
		it('should wrap text with a single ANSI code and reset', () => {
			const result = colorize('hello', ANSI.red);
			expect(result).toBe('\x1b[31mhello\x1b[0m');
		});

		it('should combine multiple ANSI codes', () => {
			const result = colorize('hello', ANSI.bold, ANSI.white, ANSI.bgRed);
			expect(result).toBe('\x1b[1m\x1b[37m\x1b[41mhello\x1b[0m');
		});

		it('should return plain text when no codes are provided', () => {
			const result = colorize('hello');
			expect(result).toBe('hello');
		});

		it('should handle empty string', () => {
			const result = colorize('', ANSI.cyan);
			expect(result).toBe('\x1b[36m\x1b[0m');
		});
	});

	describe('supportsColor', () => {
		const originalEnv = process.env;

		afterEach(() => {
			process.env = { ...originalEnv };
		});

		it('should return true when FORCE_COLOR=1', () => {
			process.env['FORCE_COLOR'] = '1';
			expect(supportsColor()).toBe(true);
		});

		it('should return false when NO_COLOR is set', () => {
			process.env['NO_COLOR'] = '';
			delete process.env['FORCE_COLOR'];
			expect(supportsColor()).toBe(false);
		});

		it('should return false when TERM=dumb', () => {
			delete process.env['NO_COLOR'];
			delete process.env['FORCE_COLOR'];
			process.env['TERM'] = 'dumb';
			// Also need to ensure isTTY is not true
			const original = process.stdout.isTTY;
			Object.defineProperty(process.stdout, 'isTTY', { value: undefined, configurable: true });
			expect(supportsColor()).toBe(false);
			Object.defineProperty(process.stdout, 'isTTY', { value: original, configurable: true });
		});
	});
});
