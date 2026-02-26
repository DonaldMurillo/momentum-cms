import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	resolveMigrationMode,
	resolveMigrationConfig,
	type MigrationConfig,
} from '../lib/migrations';

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
});
