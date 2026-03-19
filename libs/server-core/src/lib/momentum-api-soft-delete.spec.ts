import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	initializeMomentumAPI,
	resetMomentumAPI,
	DocumentNotFoundError,
	ValidationError,
} from './momentum-api';
import type { CollectionConfig, MomentumConfig, DatabaseAdapter } from '@momentumcms/core';
import {
	mockPostsCollection,
	mockUsersCollection,
	mockCollectionWithHooks,
} from './__tests__/test-fixtures';

describe('MomentumAPI', () => {
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
		};

		config = {
			collections: [mockPostsCollection, mockUsersCollection, mockCollectionWithHooks],
			db: { adapter: mockAdapter },
			server: { port: 4000 },
		};
	});

	afterEach(() => {
		resetMomentumAPI();
	});

	describe('Soft Delete', () => {
		const softDeleteCollection: CollectionConfig = {
			slug: 'pages',
			fields: [{ name: 'title', type: 'text', required: true }],
			softDelete: true,
		};

		let softDeleteConfig: MomentumConfig;

		beforeEach(() => {
			softDeleteConfig = {
				collections: [softDeleteCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
		});

		it('should inject deletedAt: null into find query for soft-delete collections', async () => {
			resetMomentumAPI();
			const api = initializeMomentumAPI(softDeleteConfig);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('pages').find();

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'pages',
				expect.objectContaining({ deletedAt: null }),
			);
		});

		it('should not inject deletedAt filter when withDeleted is true', async () => {
			resetMomentumAPI();
			const api = initializeMomentumAPI(softDeleteConfig);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('pages').find({ withDeleted: true });

			const callArgs = vi.mocked(mockAdapter.find).mock.calls[0]?.[1];
			expect(callArgs).not.toHaveProperty('deletedAt');
		});

		it('should inject $ne null filter when onlyDeleted is true', async () => {
			resetMomentumAPI();
			const api = initializeMomentumAPI(softDeleteConfig);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('pages').find({ onlyDeleted: true });

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'pages',
				expect.objectContaining({ deletedAt: { $ne: null } }),
			);
		});

		it('should throw DocumentNotFoundError for soft-deleted docs from findById by default', async () => {
			resetMomentumAPI();
			const api = initializeMomentumAPI(softDeleteConfig);
			vi.mocked(mockAdapter.findById).mockResolvedValue({
				id: '1',
				title: 'Page',
				deletedAt: '2024-06-01T00:00:00Z',
			});

			await expect(api.collection('pages').findById('1')).rejects.toThrow(DocumentNotFoundError);
		});

		it('should return soft-deleted docs from findById when withDeleted is true', async () => {
			resetMomentumAPI();
			const api = initializeMomentumAPI(softDeleteConfig);
			const deletedDoc = { id: '1', title: 'Page', deletedAt: '2024-06-01T00:00:00Z' };
			vi.mocked(mockAdapter.findById).mockResolvedValue(deletedDoc);

			const result = await api.collection('pages').findById('1', { withDeleted: true });

			expect(result).toEqual(deletedDoc);
		});

		it('should call adapter.softDelete when deleting from soft-delete collection', async () => {
			resetMomentumAPI();
			mockAdapter.softDelete = vi.fn().mockResolvedValue(true);
			const api = initializeMomentumAPI(softDeleteConfig);
			vi.mocked(mockAdapter.findById).mockResolvedValue({ id: '1', title: 'Page' });

			await api.collection('pages').delete('1');

			expect(mockAdapter.softDelete).toHaveBeenCalledWith('pages', '1', 'deletedAt');
			expect(mockAdapter.delete).not.toHaveBeenCalled();
		});

		it('should call adapter.delete for forceDelete', async () => {
			resetMomentumAPI();
			mockAdapter.softDelete = vi.fn();
			const api = initializeMomentumAPI(softDeleteConfig);
			vi.mocked(mockAdapter.findById).mockResolvedValue({ id: '1', title: 'Page' });
			vi.mocked(mockAdapter.delete).mockResolvedValue(true);

			await api.collection('pages').forceDelete('1');

			expect(mockAdapter.delete).toHaveBeenCalledWith('pages', '1');
			expect(mockAdapter.softDelete).not.toHaveBeenCalled();
		});

		it('should restore a soft-deleted document', async () => {
			resetMomentumAPI();
			const restoredDoc = { id: '1', title: 'Page', deletedAt: null };
			mockAdapter.restore = vi.fn().mockResolvedValue(restoredDoc);
			vi.mocked(mockAdapter.findById).mockResolvedValue({
				id: '1',
				title: 'Page',
				deletedAt: '2024-06-01T00:00:00Z',
			});
			const api = initializeMomentumAPI(softDeleteConfig);

			const result = await api.collection('pages').restore('1');

			expect(mockAdapter.restore).toHaveBeenCalledWith('pages', '1', 'deletedAt');
			expect(result).toEqual(restoredDoc);
		});

		it('should throw when restoring from non-soft-delete collection', async () => {
			resetMomentumAPI();
			const api = initializeMomentumAPI(config);

			await expect(api.collection('posts').restore('1')).rejects.toThrow();
		});
	});

	describe('restore on non-soft-delete collection', () => {
		it('should throw ValidationError for collections without soft delete', async () => {
			const api = initializeMomentumAPI(config);

			await expect(api.collection('posts').restore('some-id')).rejects.toThrow(ValidationError);
		});
	});
});
