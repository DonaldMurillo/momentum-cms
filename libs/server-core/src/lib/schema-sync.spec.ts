import { describe, it, expect, vi, afterEach } from 'vitest';
import { syncDatabaseSchema } from './schema-sync';
import type { MomentumConfig, DatabaseAdapter } from '@momentumcms/core';

function createMockAdapter(withInit = true): DatabaseAdapter {
	return {
		find: vi.fn().mockResolvedValue([]),
		findById: vi.fn().mockResolvedValue(null),
		create: vi.fn().mockResolvedValue({ id: '1' }),
		update: vi.fn().mockResolvedValue({ id: '1' }),
		delete: vi.fn().mockResolvedValue(true),
		...(withInit && {
			initialize: vi.fn().mockResolvedValue(undefined),
			initializeGlobals: vi.fn().mockResolvedValue(undefined),
		}),
	};
}

const mockLog = { info: vi.fn() };

function makeConfig(overrides: Partial<MomentumConfig> = {}): MomentumConfig {
	const adapter = createMockAdapter();
	return {
		collections: [{ slug: 'posts', labels: { singular: 'Post', plural: 'Posts' }, fields: [] }],
		db: { adapter, ...overrides.db },
		globals: overrides.globals,
		migrations: overrides.migrations,
	};
}

describe('syncDatabaseSchema', () => {
	afterEach(() => {
		vi.clearAllMocks();
		vi.unstubAllEnvs();
	});

	it('should call adapter.initialize and initializeGlobals when sync is allowed', async () => {
		const config = makeConfig({
			globals: [{ slug: 'settings', label: 'Settings', fields: [] }],
		});

		await syncDatabaseSchema(config, mockLog);

		expect(config.db.adapter.initialize).toHaveBeenCalledWith(config.collections);
		expect(config.db.adapter.initializeGlobals).toHaveBeenCalledWith(config.globals);
		expect(mockLog.info).toHaveBeenCalledWith('Initializing database schema...');
	});

	it('should skip when migrations.mode is "migrate"', async () => {
		const config = makeConfig({ migrations: { mode: 'migrate' } });

		await syncDatabaseSchema(config, mockLog);

		expect(config.db.adapter.initialize).not.toHaveBeenCalled();
		expect(mockLog.info).toHaveBeenCalledWith(
			expect.stringContaining('Skipping automatic schema sync'),
		);
	});

	it('should sync when db.syncSchema is true even in migrate mode', async () => {
		const adapter = createMockAdapter();
		const config: MomentumConfig = {
			collections: [],
			db: { adapter, syncSchema: true },
			migrations: { mode: 'migrate' },
		};

		await syncDatabaseSchema(config, mockLog);

		expect(adapter.initialize).toHaveBeenCalled();
	});

	it('should skip when db.syncSchema is false', async () => {
		const adapter = createMockAdapter();
		const config: MomentumConfig = {
			collections: [],
			db: { adapter, syncSchema: false },
		};

		await syncDatabaseSchema(config, mockLog);

		expect(adapter.initialize).not.toHaveBeenCalled();
	});

	it('should not call initializeGlobals when no globals are configured', async () => {
		const config = makeConfig();

		await syncDatabaseSchema(config, mockLog);

		expect(config.db.adapter.initialize).toHaveBeenCalled();
		expect(config.db.adapter.initializeGlobals).not.toHaveBeenCalled();
	});

	it('should handle adapter without initialize method gracefully', async () => {
		const adapter = createMockAdapter(false);
		const config: MomentumConfig = {
			collections: [],
			db: { adapter },
		};

		await expect(syncDatabaseSchema(config, mockLog)).resolves.toBeUndefined();
		// Sync is allowed (no migrate mode) but adapter has no initialize — no crash, no skip log
		expect(mockLog.info).not.toHaveBeenCalledWith(expect.stringContaining('Skipping'));
	});

	it('should not call initializeGlobals when globals is an empty array', async () => {
		const config = makeConfig({ globals: [] });

		await syncDatabaseSchema(config, mockLog);

		expect(config.db.adapter.initialize).toHaveBeenCalled();
		expect(config.db.adapter.initializeGlobals).not.toHaveBeenCalled();
	});

	it('should skip initializeGlobals when adapter lacks the method but globals are configured', async () => {
		const adapter = createMockAdapter(false);
		const config: MomentumConfig = {
			collections: [],
			db: { adapter },
			globals: [{ slug: 'settings', label: 'Settings', fields: [] }],
		};

		await expect(syncDatabaseSchema(config, mockLog)).resolves.toBeUndefined();
	});

	it('should propagate errors from adapter.initialize()', async () => {
		const adapter = createMockAdapter();
		const initFn = adapter.initialize;
		if (!initFn) throw new Error('Test setup: adapter.initialize should exist');
		vi.mocked(initFn).mockRejectedValueOnce(new Error('Connection refused'));
		const config: MomentumConfig = {
			collections: [],
			db: { adapter },
		};

		await expect(syncDatabaseSchema(config, mockLog)).rejects.toThrow('Connection refused');
	});

	it('should propagate errors from adapter.initializeGlobals()', async () => {
		const adapter = createMockAdapter();
		const globalsFn = adapter.initializeGlobals;
		if (!globalsFn) throw new Error('Test setup: adapter.initializeGlobals should exist');
		vi.mocked(globalsFn).mockRejectedValueOnce(new Error('Globals table error'));
		const config: MomentumConfig = {
			collections: [],
			db: { adapter },
			globals: [{ slug: 'settings', label: 'Settings', fields: [] }],
		};

		await expect(syncDatabaseSchema(config, mockLog)).rejects.toThrow('Globals table error');
	});
});
