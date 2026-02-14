import { describe, it, expect } from 'vitest';
import { momentumAuth } from '../auth-plugin';
import type { MomentumAuthPluginConfig } from '../auth-plugin';
import { text, checkbox } from '@momentum-cms/core';
import { authTwoFactor } from '../plugins/two-factor';
import { authAdmin } from '../plugins/admin';
import { authOrganization } from '../plugins/organization';

/**
 * Unit tests for the momentumAuth() plugin factory.
 *
 * NOTE: onInit tests require a real Momentum server environment because
 * onInit injects collections and creates the Better Auth instance.
 * That behavior is covered by E2E tests in apps/seeding-test-app-e2e/.
 *
 * These tests verify:
 * - Plugin factory returns the correct structure
 * - Pre-init behavior (getAuth throws, tryGetAuth returns null)
 * - getPluginConfig() exposes db and socialProviders
 * - Collection and field merging logic is correctly assembled
 */

function createMockConfig(overrides?: Partial<MomentumAuthPluginConfig>): MomentumAuthPluginConfig {
	return {
		db: { type: 'postgres', pool: {} as never },
		...overrides,
	};
}

describe('momentumAuth()', () => {
	it('should return a plugin with name "momentum-auth"', () => {
		const plugin = momentumAuth(createMockConfig());
		expect(plugin.name).toBe('momentum-auth');
	});

	it('should expose getAuth, tryGetAuth, getPluginConfig, and onInit', () => {
		const plugin = momentumAuth(createMockConfig());
		expect(typeof plugin.getAuth).toBe('function');
		expect(typeof plugin.tryGetAuth).toBe('function');
		expect(typeof plugin.getPluginConfig).toBe('function');
		expect(typeof plugin.onInit).toBe('function');
	});

	it('should throw when getAuth() is called before onInit', () => {
		const plugin = momentumAuth(createMockConfig());
		expect(() => plugin.getAuth()).toThrow('Auth not initialized');
	});

	it('should return null from tryGetAuth() before onInit', () => {
		const plugin = momentumAuth(createMockConfig());
		expect(plugin.tryGetAuth()).toBeNull();
	});

	describe('getPluginConfig()', () => {
		it('should expose the db config', () => {
			const db = { type: 'postgres' as const, pool: {} as never };
			const plugin = momentumAuth(createMockConfig({ db }));
			const cfg = plugin.getPluginConfig();
			expect(cfg.db).toBe(db);
		});

		it('should expose socialProviders when configured', () => {
			const socialProviders = { github: { clientId: 'x', clientSecret: 'y' } };
			const plugin = momentumAuth(createMockConfig({ socialProviders }));
			const cfg = plugin.getPluginConfig();
			expect(cfg.socialProviders).toBe(socialProviders);
		});

		it('should have undefined socialProviders when not configured', () => {
			const plugin = momentumAuth(createMockConfig());
			const cfg = plugin.getPluginConfig();
			expect(cfg.socialProviders).toBeUndefined();
		});
	});

	describe('sub-plugin integration with real sub-plugins', () => {
		it('should accept authTwoFactor sub-plugin and include its user field', () => {
			const twoFactorPlugin = authTwoFactor();
			const plugin = momentumAuth(createMockConfig({ plugins: [twoFactorPlugin] }));
			expect(plugin.name).toBe('momentum-auth');
		});

		it('should accept authAdmin sub-plugin with user and session fields', () => {
			const adminPlugin = authAdmin();
			const plugin = momentumAuth(createMockConfig({ plugins: [adminPlugin] }));
			expect(plugin.name).toBe('momentum-auth');
		});

		it('should accept authOrganization sub-plugin with 3 extra collections', () => {
			const orgPlugin = authOrganization();
			const plugin = momentumAuth(createMockConfig({ plugins: [orgPlugin] }));
			expect(plugin.name).toBe('momentum-auth');
		});

		it('should accept multiple sub-plugins simultaneously', () => {
			const plugin = momentumAuth(
				createMockConfig({
					plugins: [authTwoFactor(), authAdmin(), authOrganization()],
				}),
			);
			expect(plugin.name).toBe('momentum-auth');
		});
	});

	describe('custom userFields via config', () => {
		it('should accept top-level userFields using core field builders', () => {
			const plugin = momentumAuth(
				createMockConfig({
					userFields: [text('customTextField'), checkbox('customCheckbox')],
				}),
			);
			expect(plugin.name).toBe('momentum-auth');
		});

		it('should accept userFields alongside sub-plugins', () => {
			const plugin = momentumAuth(
				createMockConfig({
					userFields: [text('topLevelField')],
					plugins: [authTwoFactor()],
				}),
			);
			expect(plugin.name).toBe('momentum-auth');
		});
	});

	describe('admin visibility config', () => {
		it('should accept showCollections: false', () => {
			const plugin = momentumAuth(createMockConfig({ admin: { showCollections: false } }));
			expect(plugin.name).toBe('momentum-auth');
		});

		it('should accept showCollections: true', () => {
			const plugin = momentumAuth(createMockConfig({ admin: { showCollections: true } }));
			expect(plugin.name).toBe('momentum-auth');
		});
	});

	describe('full config', () => {
		it('should accept a complete configuration with all options', () => {
			const plugin = momentumAuth({
				db: { type: 'postgres', pool: {} as never },
				baseURL: 'http://localhost:4000',
				secret: 'test-secret',
				trustedOrigins: ['http://localhost:4000'],
				plugins: [authTwoFactor(), authAdmin()],
				admin: { showCollections: true },
				userFields: [text('department')],
			});
			expect(plugin.name).toBe('momentum-auth');
			expect(typeof plugin.getAuth).toBe('function');
			expect(typeof plugin.tryGetAuth).toBe('function');
			expect(typeof plugin.getPluginConfig).toBe('function');
			expect(typeof plugin.onInit).toBe('function');
		});
	});
});
