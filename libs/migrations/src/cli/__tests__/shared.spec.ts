import { describe, it, expect } from 'vitest';
import type { DatabaseAdapter } from '@momentumcms/core';
import {
	resolveDialect,
	buildTrackerFromAdapter,
	buildContextFromAdapter,
	buildPushDbFromAdapter,
	buildCloneDbFromAdapter,
	buildIntrospector,
	parseMigrationArgs,
} from '../shared';

/**
 * Minimal mock adapter for unit tests.
 */
function createMockAdapter(overrides: Partial<DatabaseAdapter> = {}): DatabaseAdapter {
	return {
		dialect: 'postgresql',
		find: async () => [],
		findById: async () => null,
		create: async () => ({}),
		update: async () => ({}),
		delete: async () => true,
		queryRaw: async <T extends Record<string, unknown>>(): Promise<T[]> => [],
		executeRaw: async (): Promise<number> => 0,
		cloneDatabase: async (name: string): Promise<string> => name,
		dropClone: async (): Promise<void> => {
			// noop
		},
		...overrides,
	};
}

describe('resolveDialect', () => {
	it('returns postgresql for PG adapter', () => {
		const adapter = createMockAdapter({ dialect: 'postgresql' });
		expect(resolveDialect(adapter)).toBe('postgresql');
	});

	it('returns sqlite for SQLite adapter', () => {
		const adapter = createMockAdapter({ dialect: 'sqlite' });
		expect(resolveDialect(adapter)).toBe('sqlite');
	});

	it('throws when dialect is not set', () => {
		const adapter = createMockAdapter({ dialect: undefined });
		expect(() => resolveDialect(adapter)).toThrow('dialect is not set');
	});
});

describe('buildTrackerFromAdapter', () => {
	it('bridges queryRaw and executeRaw', async () => {
		const queryResult = [{ id: '1', name: 'test' }];
		const adapter = createMockAdapter({
			queryRaw: async <T extends Record<string, unknown>>(): Promise<T[]> =>
				queryResult as unknown as T[],
			executeRaw: async (): Promise<number> => 42,
		});

		const tracker = buildTrackerFromAdapter(adapter);
		const rows = await tracker.query('SELECT 1');
		expect(rows).toEqual(queryResult);

		const count = await tracker.execute('UPDATE foo SET x = 1');
		expect(count).toBe(42);
	});

	it('throws when queryRaw is missing', () => {
		const adapter = createMockAdapter({ queryRaw: undefined });
		expect(() => buildTrackerFromAdapter(adapter)).toThrow('queryRaw and executeRaw');
	});

	it('throws when executeRaw is missing', () => {
		const adapter = createMockAdapter({ executeRaw: undefined });
		expect(() => buildTrackerFromAdapter(adapter)).toThrow('queryRaw and executeRaw');
	});
});

describe('buildContextFromAdapter', () => {
	it('provides sql, query, data, dialect, and log', () => {
		const adapter = createMockAdapter();
		const ctx = buildContextFromAdapter(adapter, 'postgresql');

		expect(typeof ctx.sql).toBe('function');
		expect(typeof ctx.query).toBe('function');
		expect(ctx.dialect).toBe('postgresql');
		expect(typeof ctx.data.backfill).toBe('function');
		expect(typeof ctx.log.info).toBe('function');
		expect(typeof ctx.log.warn).toBe('function');
	});

	it('throws when adapter lacks raw methods', () => {
		const adapter = createMockAdapter({ queryRaw: undefined, executeRaw: undefined });
		expect(() => buildContextFromAdapter(adapter, 'postgresql')).toThrow('queryRaw and executeRaw');
	});
});

describe('buildPushDbFromAdapter', () => {
	it('bridges executeRaw', async () => {
		const adapter = createMockAdapter({
			executeRaw: async (): Promise<number> => 5,
		});
		const db = buildPushDbFromAdapter(adapter);
		const result = await db.executeRaw('CREATE TABLE t (id TEXT)');
		expect(result).toBe(5);
	});

	it('throws when executeRaw is missing', () => {
		const adapter = createMockAdapter({ executeRaw: undefined });
		expect(() => buildPushDbFromAdapter(adapter)).toThrow('executeRaw');
	});
});

describe('buildCloneDbFromAdapter', () => {
	it('bridges cloneDatabase and dropClone', async () => {
		const adapter = createMockAdapter({
			cloneDatabase: async (name: string): Promise<string> => `clone_${name}`,
			dropClone: async (): Promise<void> => {
				// noop
			},
		});

		const db = buildCloneDbFromAdapter(adapter);
		const result = await db.cloneDatabase('test');
		expect(result).toBe('clone_test');
	});

	it('throws when clone methods are missing', () => {
		const adapter = createMockAdapter({ cloneDatabase: undefined, dropClone: undefined });
		expect(() => buildCloneDbFromAdapter(adapter)).toThrow('cloneDatabase and dropClone');
	});
});

describe('buildIntrospector', () => {
	it('returns a function for postgresql', () => {
		const adapter = createMockAdapter({ dialect: 'postgresql' });
		const introspect = buildIntrospector(adapter, 'postgresql');
		expect(typeof introspect).toBe('function');
	});

	it('returns a function for sqlite', () => {
		const adapter = createMockAdapter({ dialect: 'sqlite' });
		const introspect = buildIntrospector(adapter, 'sqlite');
		expect(typeof introspect).toBe('function');
	});

	it('throws when queryRaw is missing', () => {
		const adapter = createMockAdapter({ queryRaw: undefined });
		expect(() => buildIntrospector(adapter, 'postgresql')).toThrow('queryRaw');
	});
});

describe('parseMigrationArgs', () => {
	it('parses config path', () => {
		const result = parseMigrationArgs(['./momentum.config.ts']);
		expect(result.configPath).toBe('./momentum.config.ts');
		expect(result.name).toBeUndefined();
		expect(result.dryRun).toBe(false);
		expect(result.testOnly).toBe(false);
	});

	it('parses --name flag', () => {
		const result = parseMigrationArgs(['./config.ts', '--name', 'add_users']);
		expect(result.configPath).toBe('./config.ts');
		expect(result.name).toBe('add_users');
	});

	it('parses --dry-run flag', () => {
		const result = parseMigrationArgs(['./config.ts', '--dry-run']);
		expect(result.dryRun).toBe(true);
	});

	it('parses --test-only flag', () => {
		const result = parseMigrationArgs(['./config.ts', '--test-only']);
		expect(result.testOnly).toBe(true);
	});

	it('parses --skip-clone-test flag', () => {
		const result = parseMigrationArgs(['./config.ts', '--skip-clone-test']);
		expect(result.skipCloneTest).toBe(true);
	});

	it('parses multiple flags together', () => {
		const result = parseMigrationArgs([
			'./config.ts',
			'--name',
			'initial',
			'--dry-run',
			'--test-only',
		]);
		expect(result.configPath).toBe('./config.ts');
		expect(result.name).toBe('initial');
		expect(result.dryRun).toBe(true);
		expect(result.testOnly).toBe(true);
	});

	it('throws without config path', () => {
		expect(() => parseMigrationArgs(['--dry-run'])).toThrow('Usage:');
	});
});
