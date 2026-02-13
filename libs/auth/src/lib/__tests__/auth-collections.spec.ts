import { describe, it, expect } from 'vitest';
import {
	AuthUserCollection,
	AuthSessionCollection,
	AuthAccountCollection,
	AuthVerificationCollection,
	AuthApiKeysCollection,
	BASE_AUTH_COLLECTIONS,
} from '../auth-collections';

describe('Auth Collections', () => {
	describe('BASE_AUTH_COLLECTIONS', () => {
		it('should contain exactly 5 base collections', () => {
			expect(BASE_AUTH_COLLECTIONS).toHaveLength(5);
		});

		it('should include all expected slugs', () => {
			const slugs = BASE_AUTH_COLLECTIONS.map((c) => c.slug);
			expect(slugs).toEqual([
				'auth-user',
				'auth-session',
				'auth-account',
				'auth-verification',
				'auth-api-keys',
			]);
		});

		it('should have internal collections marked as managed', () => {
			const managedSlugs = BASE_AUTH_COLLECTIONS.filter((c) => c.managed).map((c) => c.slug);
			expect(managedSlugs).toEqual(['auth-session', 'auth-account', 'auth-verification']);
		});

		it('should NOT have auth-user and auth-api-keys marked as managed', () => {
			expect(AuthUserCollection.managed).toBeUndefined();
			expect(AuthApiKeysCollection.managed).toBeUndefined();
		});
	});

	describe('AuthUserCollection', () => {
		it('should have slug auth-user and dbName user', () => {
			expect(AuthUserCollection.slug).toBe('auth-user');
			expect(AuthUserCollection.dbName).toBe('user');
		});

		it('should have timestamps enabled', () => {
			expect(AuthUserCollection.timestamps).toBe(true);
		});

		it('should have the expected fields', () => {
			const fieldNames = AuthUserCollection.fields.map((f) => f.name);
			expect(fieldNames).toContain('name');
			expect(fieldNames).toContain('email');
			expect(fieldNames).toContain('emailVerified');
			expect(fieldNames).toContain('image');
			expect(fieldNames).toContain('role');
		});

		it('should have name and email as required', () => {
			const nameField = AuthUserCollection.fields.find((f) => f.name === 'name');
			const emailField = AuthUserCollection.fields.find((f) => f.name === 'email');
			expect(nameField?.required).toBe(true);
			expect(emailField?.required).toBe(true);
		});

		it('should have a unique email index', () => {
			expect(AuthUserCollection.indexes).toEqual([{ columns: ['email'], unique: true }]);
		});

		it('should have admin config in Authentication group', () => {
			expect(AuthUserCollection.admin?.group).toBe('Authentication');
			expect(AuthUserCollection.admin?.useAsTitle).toBe('email');
		});

		it('should restrict all CRUD access to admin role', () => {
			const adminReq = { user: { id: '1', role: 'admin' } };
			const userReq = { user: { id: '2', role: 'user' } };

			expect(AuthUserCollection.access?.read?.({ req: adminReq })).toBe(true);
			expect(AuthUserCollection.access?.read?.({ req: userReq })).toBe(false);
			expect(AuthUserCollection.access?.create?.({ req: adminReq })).toBe(true);
			expect(AuthUserCollection.access?.create?.({ req: userReq })).toBe(false);
			expect(AuthUserCollection.access?.update?.({ req: adminReq })).toBe(true);
			expect(AuthUserCollection.access?.update?.({ req: userReq })).toBe(false);
			expect(AuthUserCollection.access?.delete?.({ req: adminReq })).toBe(true);
			expect(AuthUserCollection.access?.delete?.({ req: userReq })).toBe(false);
		});

		it('should deny access for unauthenticated requests', () => {
			const noUserReq = {};
			const undefinedUserReq = { user: undefined };

			// Optional chaining returns undefined for missing user — falsy, denying access
			expect(AuthUserCollection.access?.read?.({ req: noUserReq })).toBeFalsy();
			expect(AuthUserCollection.access?.create?.({ req: noUserReq })).toBeFalsy();
			expect(AuthUserCollection.access?.read?.({ req: undefinedUserReq })).toBeFalsy();
			expect(AuthUserCollection.access?.create?.({ req: undefinedUserReq })).toBeFalsy();
		});
	});

	describe('AuthSessionCollection', () => {
		it('should have slug auth-session and dbName session', () => {
			expect(AuthSessionCollection.slug).toBe('auth-session');
			expect(AuthSessionCollection.dbName).toBe('session');
		});

		it('should be managed and hidden in admin', () => {
			expect(AuthSessionCollection.managed).toBe(true);
			expect(AuthSessionCollection.admin?.hidden).toBe(true);
		});

		it('should have userId, token, expiresAt as required fields', () => {
			const required = AuthSessionCollection.fields.filter((f) => f.required).map((f) => f.name);
			expect(required).toContain('userId');
			expect(required).toContain('token');
			expect(required).toContain('expiresAt');
		});

		it('should have indexes on userId and a unique token index', () => {
			expect(AuthSessionCollection.indexes).toEqual([
				{ columns: ['userId'] },
				{ columns: ['token'], unique: true },
			]);
		});

		it('should deny create and update for everyone', () => {
			const adminReq = { user: { id: '1', role: 'admin' } };
			expect(AuthSessionCollection.access?.create?.({ req: adminReq })).toBe(false);
			expect(AuthSessionCollection.access?.update?.({ req: adminReq })).toBe(false);
		});

		it('should allow admin to read and delete sessions', () => {
			const adminReq = { user: { id: '1', role: 'admin' } };
			expect(AuthSessionCollection.access?.read?.({ req: adminReq })).toBe(true);
			expect(AuthSessionCollection.access?.delete?.({ req: adminReq })).toBe(true);
		});

		it('should deny read and delete for non-admin users', () => {
			const userReq = { user: { id: '2', role: 'user' } };
			expect(AuthSessionCollection.access?.read?.({ req: userReq })).toBe(false);
			expect(AuthSessionCollection.access?.delete?.({ req: userReq })).toBe(false);
		});
	});

	describe('AuthAccountCollection', () => {
		it('should have slug auth-account and dbName account', () => {
			expect(AuthAccountCollection.slug).toBe('auth-account');
			expect(AuthAccountCollection.dbName).toBe('account');
		});

		it('should be managed and hidden in admin', () => {
			expect(AuthAccountCollection.managed).toBe(true);
			expect(AuthAccountCollection.admin?.hidden).toBe(true);
		});

		it('should have userId, accountId, providerId as required', () => {
			const required = AuthAccountCollection.fields.filter((f) => f.required).map((f) => f.name);
			expect(required).toContain('userId');
			expect(required).toContain('accountId');
			expect(required).toContain('providerId');
		});

		it('should deny all API access — OAuth tokens and password hashes must never be exposed', () => {
			const adminReq = { user: { id: '1', role: 'admin' } };
			expect(AuthAccountCollection.access?.read?.({ req: adminReq })).toBe(false);
			expect(AuthAccountCollection.access?.create?.({ req: adminReq })).toBe(false);
			expect(AuthAccountCollection.access?.update?.({ req: adminReq })).toBe(false);
			expect(AuthAccountCollection.access?.delete?.({ req: adminReq })).toBe(false);
		});
	});

	describe('AuthVerificationCollection', () => {
		it('should have slug auth-verification and dbName verification', () => {
			expect(AuthVerificationCollection.slug).toBe('auth-verification');
			expect(AuthVerificationCollection.dbName).toBe('verification');
		});

		it('should deny all access operations even for admin', () => {
			const adminReq = { user: { id: '1', role: 'admin' } };
			expect(AuthVerificationCollection.access?.read?.({ req: adminReq })).toBe(false);
			expect(AuthVerificationCollection.access?.create?.({ req: adminReq })).toBe(false);
			expect(AuthVerificationCollection.access?.update?.({ req: adminReq })).toBe(false);
			expect(AuthVerificationCollection.access?.delete?.({ req: adminReq })).toBe(false);
		});
	});

	describe('AuthApiKeysCollection', () => {
		it('should have slug auth-api-keys and dbName _api_keys', () => {
			expect(AuthApiKeysCollection.slug).toBe('auth-api-keys');
			expect(AuthApiKeysCollection.dbName).toBe('_api_keys');
		});

		it('should have expected fields', () => {
			const fieldNames = AuthApiKeysCollection.fields.map((f) => f.name);
			expect(fieldNames).toContain('name');
			expect(fieldNames).toContain('keyHash');
			expect(fieldNames).toContain('keyPrefix');
			expect(fieldNames).toContain('createdBy');
			expect(fieldNames).toContain('role');
			expect(fieldNames).toContain('expiresAt');
			expect(fieldNames).toContain('lastUsedAt');
		});

		it('should hide keyHash in admin UI', () => {
			const keyHashField = AuthApiKeysCollection.fields.find((f) => f.name === 'keyHash');
			expect(keyHashField?.admin?.hidden).toBe(true);
		});

		it('should deny keyHash read via field-level access', () => {
			const keyHashField = AuthApiKeysCollection.fields.find((f) => f.name === 'keyHash');
			expect(keyHashField?.access?.read).toBeDefined();
			expect(keyHashField?.access?.read?.({ req: { user: { id: '1', role: 'admin' } } })).toBe(
				false,
			);
		});

		it('should have createdBy as a relationship to auth-user', () => {
			const createdByField = AuthApiKeysCollection.fields.find((f) => f.name === 'createdBy');
			expect(createdByField?.type).toBe('relationship');
			expect(createdByField?.required).toBe(true);
		});

		it('should have a unique keyHash index', () => {
			const uniqueIndexes = AuthApiKeysCollection.indexes?.filter((i) => i.unique);
			expect(uniqueIndexes).toEqual([{ columns: ['keyHash'], unique: true }]);
		});

		it('should deny update for everyone', () => {
			const adminReq = { user: { id: '1', role: 'admin' } };
			expect(AuthApiKeysCollection.access?.update?.({ req: adminReq })).toBe(false);
		});

		it('should deny create for everyone (keys must be created via Better Auth)', () => {
			const adminReq = { user: { id: '1', role: 'admin' } };
			const userReq = { user: { id: '2', role: 'user' } };
			expect(AuthApiKeysCollection.access?.create?.({ req: adminReq })).toBe(false);
			expect(AuthApiKeysCollection.access?.create?.({ req: userReq })).toBe(false);
		});

		it('should allow any authenticated user to read', () => {
			const adminReq = { user: { id: '1', role: 'admin' } };
			const userReq = { user: { id: '2', role: 'user' } };
			expect(AuthApiKeysCollection.access?.read?.({ req: adminReq })).toBe(true);
			expect(AuthApiKeysCollection.access?.read?.({ req: userReq })).toBe(true);
		});

		it('should deny delete for everyone (deletion only via dedicated route)', () => {
			const adminReq = { user: { id: '1', role: 'admin' } };
			const userReq = { user: { id: '2', role: 'user' } };
			expect(AuthApiKeysCollection.access?.delete?.({ req: adminReq })).toBe(false);
			expect(AuthApiKeysCollection.access?.delete?.({ req: userReq })).toBe(false);
		});

		it('should deny unauthenticated read', () => {
			const noUserReq = { user: undefined };
			expect(AuthApiKeysCollection.access?.read?.({ req: noUserReq })).toBe(false);
		});

		it('should have defaultWhere that scopes by user', () => {
			const adminReq = { user: { id: '1', role: 'admin' } };
			const userReq = { user: { id: '2', role: 'user' } };
			const noUserReq = {};
			expect(AuthApiKeysCollection.defaultWhere?.(adminReq)).toBeUndefined();
			expect(AuthApiKeysCollection.defaultWhere?.(userReq)).toEqual({ createdBy: '2' });
			expect(AuthApiKeysCollection.defaultWhere?.(noUserReq)).toEqual({ createdBy: '__none__' });
		});

		it('should have a generate-key header action with endpoint', () => {
			const actions = AuthApiKeysCollection.admin?.headerActions;
			expect(actions).toHaveLength(1);
			expect(actions?.[0]).toEqual({
				id: 'generate-key',
				label: 'Generate API Key',
				endpoint: '/api/auth/api-keys',
			});
		});
	});
});
