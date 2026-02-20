import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadMigrationsFromDisk } from '../migration-loader';

describe('migration-loader', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `loader-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	/**
	 * Write a valid migration file to disk.
	 * Uses plain JS that tsx can import (no TS compilation needed).
	 */
	function writeMigrationFile(name: string, tableName = 'test_table'): void {
		const content = `
export const meta = {
	name: '${name}',
	description: 'Test migration for ${tableName}',
};

export async function up(ctx) {
	await ctx.sql('CREATE TABLE IF NOT EXISTS "${tableName}" (id TEXT PRIMARY KEY)');
}

export async function down(ctx) {
	await ctx.sql('DROP TABLE IF EXISTS "${tableName}"');
}
`;
		writeFileSync(join(tempDir, `${name}.ts`), content, 'utf-8');
	}

	it('returns empty array for missing directory', async () => {
		const result = await loadMigrationsFromDisk(join(tempDir, 'nonexistent'));
		expect(result).toEqual([]);
	});

	it('returns empty array for directory with no migration files', async () => {
		writeFileSync(join(tempDir, 'readme.md'), '# Migrations', 'utf-8');
		writeFileSync(join(tempDir, '.snapshot.json'), '{}', 'utf-8');
		const result = await loadMigrationsFromDisk(tempDir);
		expect(result).toEqual([]);
	});

	it('loads valid migration files', async () => {
		writeMigrationFile('20240101120000_initial');
		const result = await loadMigrationsFromDisk(tempDir);

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('20240101120000_initial');
		expect(result[0].file.meta.name).toBe('20240101120000_initial');
		expect(typeof result[0].file.up).toBe('function');
		expect(typeof result[0].file.down).toBe('function');
	});

	it('sorts by timestamp prefix', async () => {
		writeMigrationFile('20240301000000_third');
		writeMigrationFile('20240101000000_first');
		writeMigrationFile('20240201000000_second');

		const result = await loadMigrationsFromDisk(tempDir);
		expect(result).toHaveLength(3);
		expect(result[0].name).toBe('20240101000000_first');
		expect(result[1].name).toBe('20240201000000_second');
		expect(result[2].name).toBe('20240301000000_third');
	});

	it('ignores non-migration files', async () => {
		writeMigrationFile('20240101120000_valid');
		writeFileSync(join(tempDir, '.snapshot.json'), '{}', 'utf-8');
		writeFileSync(join(tempDir, 'helpers.ts'), 'export const x = 1;', 'utf-8');
		writeFileSync(join(tempDir, 'README.md'), '# Migrations', 'utf-8');

		const result = await loadMigrationsFromDisk(tempDir);
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('20240101120000_valid');
	});

	it('rejects files missing meta export', async () => {
		const content = `
export async function up(ctx) { await ctx.sql('SELECT 1'); }
export async function down(ctx) { await ctx.sql('SELECT 1'); }
`;
		writeFileSync(join(tempDir, '20240101120000_bad.ts'), content, 'utf-8');

		await expect(loadMigrationsFromDisk(tempDir)).rejects.toThrow("missing a valid 'meta' export");
	});

	it('rejects files missing up function', async () => {
		const content = `
export const meta = { name: 'bad', description: 'missing up' };
export async function down(ctx) { await ctx.sql('SELECT 1'); }
`;
		writeFileSync(join(tempDir, '20240101120000_bad.ts'), content, 'utf-8');

		await expect(loadMigrationsFromDisk(tempDir)).rejects.toThrow("missing an 'up' function");
	});

	it('rejects files missing down function', async () => {
		const content = `
export const meta = { name: 'bad', description: 'missing down' };
export async function up(ctx) { await ctx.sql('SELECT 1'); }
`;
		writeFileSync(join(tempDir, '20240101120000_bad.ts'), content, 'utf-8');

		await expect(loadMigrationsFromDisk(tempDir)).rejects.toThrow("missing a 'down' function");
	});
});
