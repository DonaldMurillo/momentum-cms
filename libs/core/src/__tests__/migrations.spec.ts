import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	resolveMigrationMode,
	resolveMigrationConfig,
	type MigrationConfig,
} from '../lib/migrations';
import { shouldSyncSchema } from '../lib/config';
import type { MomentumConfig, DatabaseAdapter } from '../lib/config';

describe('migrations types', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	describe('resolveMigrationMode', () => {
		it('should return "push" when mode is "push"', () => {
			expect(resolveMigrationMode('push')).toBe('push');
		});

		it('should return "migrate" when mode is "migrate"', () => {
			expect(resolveMigrationMode('migrate')).toBe('migrate');
		});

		it('should return "migrate" when mode is "auto" and NODE_ENV is production', () => {
			vi.stubEnv('NODE_ENV', 'production');
			expect(resolveMigrationMode('auto')).toBe('migrate');
		});

		it('should return "push" when mode is "auto" and NODE_ENV is development', () => {
			vi.stubEnv('NODE_ENV', 'development');
			expect(resolveMigrationMode('auto')).toBe('push');
		});

		it('should return "push" when mode is "auto" and NODE_ENV is test', () => {
			vi.stubEnv('NODE_ENV', 'test');
			expect(resolveMigrationMode('auto')).toBe('push');
		});

		it('should return "push" when mode is undefined and NODE_ENV is undefined', () => {
			vi.stubEnv('NODE_ENV', '');
			expect(resolveMigrationMode(undefined)).toBe('push');
		});
	});

	describe('resolveMigrationConfig', () => {
		it('should return undefined when config is undefined', () => {
			expect(resolveMigrationConfig(undefined)).toBeUndefined();
		});

		it('should resolve all defaults for empty config', () => {
			vi.stubEnv('NODE_ENV', 'development');
			const result = resolveMigrationConfig({});
			expect(result).toBeDefined();
			expect(result?.directory).toBe('./migrations');
			expect(result?.mode).toBe('push');
			expect(result?.cloneTest).toBe(false); // push mode default
			expect(result?.dangerDetection).toBe(true);
			expect(result?.autoApply).toBe(true); // push mode default
		});

		it('should set cloneTest true in migrate mode by default', () => {
			const config: MigrationConfig = { mode: 'migrate' };
			const result = resolveMigrationConfig(config);
			expect(result?.cloneTest).toBe(true);
			expect(result?.autoApply).toBe(false); // migrate mode = not auto-apply
		});

		it('should respect explicit overrides', () => {
			const config: MigrationConfig = {
				directory: './db/migrations',
				mode: 'push',
				cloneTest: true,
				dangerDetection: false,
				autoApply: false,
			};
			const result = resolveMigrationConfig(config);
			expect(result?.directory).toBe('./db/migrations');
			expect(result?.mode).toBe('push');
			expect(result?.cloneTest).toBe(true);
			expect(result?.dangerDetection).toBe(false);
			expect(result?.autoApply).toBe(false);
		});
	});

	describe('shouldSyncSchema', () => {
		const mockAdapter: DatabaseAdapter = {
			find: vi.fn().mockResolvedValue([]),
			findById: vi.fn().mockResolvedValue(null),
			create: vi.fn().mockResolvedValue({ id: '1' }),
			update: vi.fn().mockResolvedValue({ id: '1' }),
			delete: vi.fn().mockResolvedValue(true),
		};

		function makeConfig(overrides: Partial<MomentumConfig> = {}): MomentumConfig {
			return {
				collections: [],
				db: { adapter: mockAdapter, ...overrides.db },
				...overrides,
			};
		}

		it('should sync when no migration config is present', () => {
			expect(shouldSyncSchema(makeConfig())).toBe(true);
		});

		it('should sync when migrations.mode is "push"', () => {
			expect(shouldSyncSchema(makeConfig({ migrations: { mode: 'push' } }))).toBe(true);
		});

		it('should NOT sync when migrations.mode is "migrate"', () => {
			expect(shouldSyncSchema(makeConfig({ migrations: { mode: 'migrate' } }))).toBe(false);
		});

		it('should sync when db.syncSchema is explicitly true, even in migrate mode', () => {
			const config = makeConfig({
				db: { adapter: mockAdapter, syncSchema: true },
				migrations: { mode: 'migrate' },
			});
			expect(shouldSyncSchema(config)).toBe(true);
		});

		it('should NOT sync when db.syncSchema is explicitly false, even in push mode', () => {
			const config = makeConfig({
				db: { adapter: mockAdapter, syncSchema: false },
				migrations: { mode: 'push' },
			});
			expect(shouldSyncSchema(config)).toBe(false);
		});

		it('should NOT sync when db.syncSchema is explicitly false with no migration config', () => {
			const config = makeConfig({
				db: { adapter: mockAdapter, syncSchema: false },
			});
			expect(shouldSyncSchema(config)).toBe(false);
		});

		it('should treat explicit syncSchema: "auto" the same as omitting it', () => {
			const withAuto = makeConfig({
				db: { adapter: mockAdapter, syncSchema: 'auto' },
				migrations: { mode: 'migrate' },
			});
			const withoutAuto = makeConfig({
				migrations: { mode: 'migrate' },
			});
			expect(shouldSyncSchema(withAuto)).toBe(shouldSyncSchema(withoutAuto));
			expect(shouldSyncSchema(withAuto)).toBe(false);
		});

		it('should resolve "auto" mode based on NODE_ENV in auto migration mode', () => {
			vi.stubEnv('NODE_ENV', 'production');
			const config = makeConfig({ migrations: { mode: 'auto' } });
			expect(shouldSyncSchema(config)).toBe(false); // auto → migrate in prod → no sync
		});

		it('should resolve "auto" mode as sync in development', () => {
			vi.stubEnv('NODE_ENV', 'development');
			const config = makeConfig({ migrations: { mode: 'auto' } });
			expect(shouldSyncSchema(config)).toBe(true); // auto → push in dev → sync
		});
	});
});
