import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	initializeMomentumAPI,
	getMomentumAPI,
	resetMomentumAPI,
	GlobalNotFoundError,
	AccessDeniedError,
} from './momentum-api';
import type { GlobalConfig, MomentumConfig, DatabaseAdapter } from '@momentumcms/core';

const mockSiteSettings: GlobalConfig = {
	slug: 'site-settings',
	label: 'Site Settings',
	fields: [
		{ name: 'site-name', type: 'text', required: true, label: 'Site Name' },
		{ name: 'description', type: 'textarea', label: 'Description' },
	],
	access: {
		read: () => true,
		update: ({ req }) => req.user?.role === 'admin',
	},
};

const mockRestrictedGlobal: GlobalConfig = {
	slug: 'restricted-settings',
	label: 'Restricted Settings',
	fields: [{ name: 'secret', type: 'text', label: 'Secret' }],
	access: {
		read: ({ req }) => req.user?.role === 'admin',
		update: ({ req }) => req.user?.role === 'admin',
	},
};

const mockGlobalWithHooks: GlobalConfig = {
	slug: 'hooked-settings',
	label: 'Hooked Settings',
	fields: [{ name: 'value', type: 'text', label: 'Value' }],
	hooks: {
		beforeChange: [({ data }) => ({ ...data, modified: true })],
		afterChange: [vi.fn()],
		afterRead: [({ doc }) => ({ ...doc, readProcessed: true })],
	},
};

describe('GlobalOperations', () => {
	let mockAdapter: DatabaseAdapter;
	let config: MomentumConfig;

	beforeEach(() => {
		resetMomentumAPI();

		mockAdapter = {
			find: vi.fn(),
			findById: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
			findGlobal: vi.fn(),
			updateGlobal: vi.fn(),
			initializeGlobals: vi.fn(),
		};

		config = {
			collections: [],
			globals: [mockSiteSettings, mockRestrictedGlobal, mockGlobalWithHooks],
			db: { adapter: mockAdapter },
			server: { port: 4000 },
		};

		initializeMomentumAPI(config);
	});

	afterEach(() => {
		resetMomentumAPI();
	});

	describe('global() accessor', () => {
		it('should return GlobalOperations for a valid slug', () => {
			const api = getMomentumAPI();
			const ops = api.global('site-settings');
			expect(ops).toBeDefined();
			expect(ops.findOne).toBeDefined();
			expect(ops.update).toBeDefined();
		});

		it('should throw GlobalNotFoundError for unknown slug', () => {
			const api = getMomentumAPI();
			expect(() => api.global('nonexistent')).toThrow(GlobalNotFoundError);
		});
	});

	describe('findOne()', () => {
		it('should return existing global data', async () => {
			const mockData = {
				slug: 'site-settings',
				data: { 'site-name': 'My Site', description: 'A test site' },
				'site-name': 'My Site',
				description: 'A test site',
				createdAt: '2024-01-01',
				updatedAt: '2024-01-01',
			};
			vi.mocked(mockAdapter.findGlobal).mockResolvedValue(mockData);

			const api = getMomentumAPI();
			const result = await api.global<Record<string, unknown>>('site-settings').findOne();
			expect(result).toBeDefined();
			expect(result['site-name']).toBe('My Site');
			expect(result.description).toBe('A test site');
			expect(mockAdapter.findGlobal).toHaveBeenCalledWith('site-settings');
		});

		it('should auto-create global when not found', async () => {
			vi.mocked(mockAdapter.findGlobal).mockResolvedValue(null);
			vi.mocked(mockAdapter.updateGlobal).mockResolvedValue({
				slug: 'site-settings',
				data: {},
				createdAt: '2024-01-01',
				updatedAt: '2024-01-01',
			});

			const api = getMomentumAPI();
			const result = await api.global<Record<string, unknown>>('site-settings').findOne();
			expect(result).toBeDefined();
			expect(result.slug).toBe('site-settings');
			expect(mockAdapter.updateGlobal).toHaveBeenCalledWith('site-settings', {});
		});

		it('should deny read access when access check fails', async () => {
			const api = getMomentumAPI().setContext({ user: { role: 'viewer' } });

			await expect(api.global('restricted-settings').findOne()).rejects.toThrow(AccessDeniedError);
		});

		it('should allow read access when access check passes', async () => {
			vi.mocked(mockAdapter.findGlobal).mockResolvedValue({
				slug: 'site-settings',
				'site-name': 'Test',
			});

			const api = getMomentumAPI();
			// site-settings has read: () => true (public)
			const result = await api.global<Record<string, unknown>>('site-settings').findOne();
			expect(result['site-name']).toBe('Test');
		});
	});

	describe('update()', () => {
		it('should update global data when authorized', async () => {
			const existingData = {
				slug: 'site-settings',
				'site-name': 'Old Name',
				description: 'Old desc',
			};
			vi.mocked(mockAdapter.findGlobal).mockResolvedValue(existingData);
			vi.mocked(mockAdapter.updateGlobal).mockResolvedValue({
				slug: 'site-settings',
				'site-name': 'New Name',
				description: 'Old desc',
			});

			const api = getMomentumAPI().setContext({ user: { role: 'admin' } });

			const result = await api
				.global<Record<string, unknown>>('site-settings')
				.update({ 'site-name': 'New Name' });
			expect(result['site-name']).toBe('New Name');
			expect(mockAdapter.updateGlobal).toHaveBeenCalled();
		});

		it('should deny update when not authorized', async () => {
			const api = getMomentumAPI().setContext({ user: { role: 'viewer' } });

			await expect(api.global('site-settings').update({ 'site-name': 'Hacked' })).rejects.toThrow(
				AccessDeniedError,
			);
		});

		it('should deny update for unauthenticated users', async () => {
			const api = getMomentumAPI();

			await expect(
				api.global('site-settings').update({ 'site-name': 'Anonymous' }),
			).rejects.toThrow(AccessDeniedError);
		});
	});

	describe('hooks', () => {
		it('should run afterRead hooks', async () => {
			vi.mocked(mockAdapter.findGlobal).mockResolvedValue({
				slug: 'hooked-settings',
				value: 'test',
			});

			const api = getMomentumAPI();
			const result = await api.global<Record<string, unknown>>('hooked-settings').findOne();
			// afterRead hook adds readProcessed: true
			expect(result.readProcessed).toBe(true);
		});

		it('should run beforeChange hooks on update', async () => {
			vi.mocked(mockAdapter.findGlobal).mockResolvedValue({
				slug: 'hooked-settings',
				value: 'old',
			});
			vi.mocked(mockAdapter.updateGlobal).mockImplementation((_slug, data) =>
				Promise.resolve({ slug: 'hooked-settings', ...data }),
			);

			const api = getMomentumAPI();
			// hooked-settings has no access restrictions (undefined = allow all)
			const result = await api
				.global<Record<string, unknown>>('hooked-settings')
				.update({ value: 'new' });
			// beforeChange hook adds modified: true
			expect(result.modified).toBe(true);
		});

		it('should run afterChange hooks on update', async () => {
			vi.mocked(mockAdapter.findGlobal).mockResolvedValue({
				slug: 'hooked-settings',
				value: 'old',
			});
			vi.mocked(mockAdapter.updateGlobal).mockResolvedValue({
				slug: 'hooked-settings',
				value: 'new',
			});

			const api = getMomentumAPI();
			await api.global('hooked-settings').update({ value: 'new' });

			const afterChangeHook = mockGlobalWithHooks.hooks?.afterChange?.[0];
			expect(afterChangeHook).toHaveBeenCalled();
		});
	});
});
