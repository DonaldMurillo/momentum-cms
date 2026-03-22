import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseArgs } from '../generator';

// ============================================
// parseArgs Tests (--client flag)
// ============================================

describe('parseArgs', () => {
	// parseArgs calls process.exit(1) when configPath is missing, so mock it
	const originalExit = process.exit;
	const originalError = console.error;

	beforeEach(() => {
		process.exit = vi.fn() as never;
		console.error = vi.fn();
	});

	afterEach(() => {
		process.exit = originalExit;
		console.error = originalError;
	});

	it('should parse --client flag', () => {
		const result = parseArgs([
			'momentum.config.ts',
			'--types',
			'out/types.ts',
			'--config',
			'out/config.ts',
			'--client',
			'out/client.ts',
		]);
		expect(result.clientOutputPath).toBe('out/client.ts');
	});

	it('should return undefined clientOutputPath when --client is omitted', () => {
		const result = parseArgs([
			'momentum.config.ts',
			'--types',
			'out/types.ts',
			'--config',
			'out/config.ts',
		]);
		expect(result.clientOutputPath).toBeUndefined();
	});

	it('should parse --client alongside --watch', () => {
		const result = parseArgs(['momentum.config.ts', '--client', 'out/client.ts', '--watch']);
		expect(result.clientOutputPath).toBe('out/client.ts');
		expect(result.watch).toBe(true);
	});

	it('should include --client in usage string when no config provided', () => {
		parseArgs([]);
		expect(console.error).toHaveBeenCalledWith(expect.stringContaining('--client'));
	});
});
