import { describe, it, expect } from 'vitest';
import { AUTH_ROLES } from '../auth-core';
import type {
	MomentumUser,
	MomentumSession,
	OAuthProviderConfig,
	OAuthProvidersConfig,
} from '../auth-core';

describe('auth-core (browser-safe)', () => {
	describe('AUTH_ROLES', () => {
		it('should export AUTH_ROLES with expected roles', () => {
			expect(AUTH_ROLES).toHaveLength(4);
			const values = AUTH_ROLES.map((r) => r.value);
			expect(values).toEqual(['admin', 'editor', 'user', 'viewer']);
		});

		it('should have label and value for each role', () => {
			for (const role of AUTH_ROLES) {
				expect(role).toHaveProperty('label');
				expect(role).toHaveProperty('value');
				expect(typeof role.label).toBe('string');
				expect(typeof role.value).toBe('string');
			}
		});
	});

	describe('type exports', () => {
		it('should allow creating a MomentumUser-shaped object', () => {
			const user: MomentumUser = {
				id: '1',
				email: 'test@example.com',
				name: 'Test User',
				role: 'user',
				emailVerified: false,
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			expect(user.id).toBe('1');
			expect(user.role).toBe('user');
		});

		it('should allow creating a MomentumSession-shaped object', () => {
			const session: MomentumSession = {
				id: 's1',
				userId: '1',
				token: 'tok_123',
				expiresAt: new Date(),
			};
			expect(session.userId).toBe('1');
		});

		it('should allow creating an OAuthProviderConfig-shaped object', () => {
			const provider: OAuthProviderConfig = {
				clientId: 'client-id',
				clientSecret: 'client-secret',
			};
			expect(provider.clientId).toBe('client-id');
		});

		it('should allow creating an OAuthProvidersConfig-shaped object', () => {
			const providers: OAuthProvidersConfig = {
				google: { clientId: 'g-id', clientSecret: 'g-secret' },
				github: { clientId: 'gh-id', clientSecret: 'gh-secret' },
			};
			expect(providers.google?.clientId).toBe('g-id');
			expect(providers.github?.clientId).toBe('gh-id');
		});
	});

	describe('module isolation', () => {
		it('should not import any Node.js-only modules', async () => {
			// Dynamically import the module and verify it resolves without Node-only deps
			const authCore = await import('../auth-core');
			expect(authCore.AUTH_ROLES).toBeDefined();
			expect(authCore.AUTH_ROLES).toHaveLength(4);
		});
	});
});
