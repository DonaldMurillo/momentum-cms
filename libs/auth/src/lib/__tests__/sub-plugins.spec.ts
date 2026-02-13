import { describe, it, expect } from 'vitest';
import { authTwoFactor } from '../plugins/two-factor';
import { authAdmin } from '../plugins/admin';
import { authOrganization } from '../plugins/organization';

describe('Auth Sub-Plugins', () => {
	describe('authTwoFactor()', () => {
		it('should have name "two-factor"', () => {
			const plugin = authTwoFactor();
			expect(plugin.name).toBe('two-factor');
		});

		it('should provide a Better Auth plugin instance', () => {
			const plugin = authTwoFactor();
			expect(plugin.betterAuthPlugin).toBeDefined();
		});

		it('should contribute one managed collection', () => {
			const plugin = authTwoFactor();
			expect(plugin.collections).toHaveLength(1);

			const col = plugin.collections![0];
			expect(col.slug).toBe('auth-two-factor');
			expect(col.dbName).toBe('twoFactor');
			expect(col.managed).toBe(true);
		});

		it('should contribute twoFactorEnabled user field', () => {
			const plugin = authTwoFactor();
			expect(plugin.userFields).toHaveLength(1);
			expect(plugin.userFields![0].name).toBe('twoFactorEnabled');
			expect(plugin.userFields![0].type).toBe('checkbox');
		});

		it('should have no session fields or admin routes', () => {
			const plugin = authTwoFactor();
			expect(plugin.sessionFields).toBeUndefined();
			expect(plugin.adminRoutes).toBeUndefined();
		});

		it('should have secret, backupCodes, userId fields in its collection', () => {
			const plugin = authTwoFactor();
			const fieldNames = plugin.collections![0].fields.map((f) => f.name);
			expect(fieldNames).toEqual(['secret', 'backupCodes', 'userId']);
		});

		it('should deny all access on the two-factor collection', () => {
			const plugin = authTwoFactor();
			const col = plugin.collections![0];
			const req = { user: { id: '1', role: 'admin' } };
			expect(col.access?.read?.({ req })).toBe(false);
			expect(col.access?.create?.({ req })).toBe(false);
			expect(col.access?.update?.({ req })).toBe(false);
			expect(col.access?.delete?.({ req })).toBe(false);
		});
	});

	describe('authAdmin()', () => {
		it('should have name "admin"', () => {
			const plugin = authAdmin();
			expect(plugin.name).toBe('admin');
		});

		it('should have undefined betterAuthPlugin (stub)', () => {
			const plugin = authAdmin();
			expect(plugin.betterAuthPlugin).toBeUndefined();
		});

		it('should contribute ban-related user fields', () => {
			const plugin = authAdmin();
			const fieldNames = plugin.userFields?.map((f) => f.name) ?? [];
			expect(fieldNames).toContain('banned');
			expect(fieldNames).toContain('banReason');
			expect(fieldNames).toContain('banExpires');
		});

		it('should contribute impersonatedBy session field', () => {
			const plugin = authAdmin();
			expect(plugin.sessionFields).toHaveLength(1);
			expect(plugin.sessionFields![0].name).toBe('impersonatedBy');
		});

		it('should not contribute any collections', () => {
			const plugin = authAdmin();
			expect(plugin.collections).toBeUndefined();
		});
	});

	describe('authOrganization()', () => {
		it('should have name "organization"', () => {
			const plugin = authOrganization();
			expect(plugin.name).toBe('organization');
		});

		it('should have undefined betterAuthPlugin (stub)', () => {
			const plugin = authOrganization();
			expect(plugin.betterAuthPlugin).toBeUndefined();
		});

		it('should contribute 3 managed collections', () => {
			const plugin = authOrganization();
			expect(plugin.collections).toHaveLength(3);

			const slugs = plugin.collections!.map((c) => c.slug);
			expect(slugs).toEqual(['auth-organization', 'auth-member', 'auth-invitation']);
		});

		it('should map collections to correct dbNames', () => {
			const plugin = authOrganization();
			const dbNames = plugin.collections!.map((c) => c.dbName);
			expect(dbNames).toEqual(['organization', 'member', 'invitation']);
		});

		it('should mark all collections as managed', () => {
			const plugin = authOrganization();
			for (const col of plugin.collections!) {
				expect(col.managed).toBe(true);
			}
		});

		it('should have a unique slug index on organization', () => {
			const plugin = authOrganization();
			const orgCol = plugin.collections!.find((c) => c.slug === 'auth-organization');
			expect(orgCol?.indexes).toEqual([{ columns: ['slug'], unique: true }]);
		});

		it('should have a unique compound index on member (userId, organizationId)', () => {
			const plugin = authOrganization();
			const memberCol = plugin.collections!.find((c) => c.slug === 'auth-member');
			const uniqueIndex = memberCol?.indexes?.find((i) => i.unique);
			expect(uniqueIndex?.columns).toEqual(['userId', 'organizationId']);
		});

		it('should not contribute user or session fields', () => {
			const plugin = authOrganization();
			expect(plugin.userFields).toBeUndefined();
			expect(plugin.sessionFields).toBeUndefined();
		});
	});
});
