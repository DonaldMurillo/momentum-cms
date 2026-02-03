import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSeedTracker, type SeedTracker } from '../seed-tracker';
import type { DatabaseAdapter } from '@momentum-cms/core';

describe('createSeedTracker', () => {
	let mockAdapter: DatabaseAdapter;
	let tracker: SeedTracker;

	beforeEach(() => {
		mockAdapter = {
			find: vi.fn(),
			findById: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		};
		tracker = createSeedTracker(mockAdapter);
	});

	describe('findBySeedId', () => {
		it('should return null when no seed found', async () => {
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			const result = await tracker.findBySeedId('non-existent');

			expect(result).toBeNull();
			expect(mockAdapter.find).toHaveBeenCalledWith('_momentum_seeds', { seedId: 'non-existent' });
		});

		it('should return seed tracking document when found', async () => {
			const mockDoc = {
				id: 'track-1',
				seedId: 'admin-user',
				collection: 'user',
				documentId: 'user-123',
				checksum: 'abc123',
				createdAt: '2024-01-01T00:00:00.000Z',
				updatedAt: '2024-01-01T00:00:00.000Z',
			};
			vi.mocked(mockAdapter.find).mockResolvedValue([mockDoc]);

			const result = await tracker.findBySeedId('admin-user');

			expect(result).toEqual(mockDoc);
		});

		it('should return first match when multiple found', async () => {
			const mockDocs = [
				{ id: 'track-1', seedId: 'admin-user' },
				{ id: 'track-2', seedId: 'admin-user' },
			];
			vi.mocked(mockAdapter.find).mockResolvedValue(mockDocs);

			const result = await tracker.findBySeedId('admin-user');

			expect(result?.id).toBe('track-1');
		});
	});

	describe('create', () => {
		it('should create seed tracking record', async () => {
			const mockCreated = {
				id: 'track-1',
				seedId: 'admin-user',
				collection: 'user',
				documentId: 'user-123',
				checksum: 'abc123',
				createdAt: '2024-01-01T00:00:00.000Z',
				updatedAt: '2024-01-01T00:00:00.000Z',
			};
			vi.mocked(mockAdapter.create).mockResolvedValue(mockCreated);

			const result = await tracker.create({
				seedId: 'admin-user',
				collection: 'user',
				documentId: 'user-123',
				checksum: 'abc123',
			});

			expect(result.seedId).toBe('admin-user');
			expect(result.collection).toBe('user');
			expect(result.documentId).toBe('user-123');
			expect(result.checksum).toBe('abc123');
			expect(mockAdapter.create).toHaveBeenCalledWith(
				'_momentum_seeds',
				expect.objectContaining({
					seedId: 'admin-user',
					collection: 'user',
					documentId: 'user-123',
					checksum: 'abc123',
				}),
			);
		});

		it('should generate UUID and timestamps', async () => {
			vi.mocked(mockAdapter.create).mockImplementation(async (_coll, data) => data);

			await tracker.create({
				seedId: 'test-seed',
				collection: 'posts',
				documentId: 'post-1',
				checksum: 'hash',
			});

			const createCall = vi.mocked(mockAdapter.create).mock.calls[0];
			const data = createCall[1];

			// Check UUID format
			expect(data['id']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
			// Check timestamps are ISO strings
			expect(data['createdAt']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
			expect(data['updatedAt']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		});
	});

	describe('updateChecksum', () => {
		it('should update checksum of existing seed', async () => {
			const existingDoc = {
				id: 'track-1',
				seedId: 'admin-user',
				collection: 'user',
				documentId: 'user-123',
				checksum: 'old-hash',
				createdAt: '2024-01-01T00:00:00.000Z',
				updatedAt: '2024-01-01T00:00:00.000Z',
			};
			vi.mocked(mockAdapter.find).mockResolvedValue([existingDoc]);
			vi.mocked(mockAdapter.update).mockResolvedValue({
				...existingDoc,
				checksum: 'new-hash',
				updatedAt: '2024-01-02T00:00:00.000Z',
			});

			const result = await tracker.updateChecksum('admin-user', 'new-hash');

			expect(result.checksum).toBe('new-hash');
			expect(mockAdapter.update).toHaveBeenCalledWith(
				'_momentum_seeds',
				'track-1',
				expect.objectContaining({
					checksum: 'new-hash',
				}),
			);
		});

		it('should throw error when seed not found', async () => {
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(tracker.updateChecksum('non-existent', 'hash')).rejects.toThrow(
				'Seed tracking record not found for seedId: non-existent',
			);
		});
	});

	describe('delete', () => {
		it('should delete existing seed tracking record', async () => {
			const existingDoc = {
				id: 'track-1',
				seedId: 'admin-user',
				collection: 'user',
				documentId: 'user-123',
			};
			vi.mocked(mockAdapter.find).mockResolvedValue([existingDoc]);
			vi.mocked(mockAdapter.delete).mockResolvedValue(true);

			const result = await tracker.delete('admin-user');

			expect(result).toBe(true);
			expect(mockAdapter.delete).toHaveBeenCalledWith('_momentum_seeds', 'track-1');
		});

		it('should return false when seed not found', async () => {
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			const result = await tracker.delete('non-existent');

			expect(result).toBe(false);
			expect(mockAdapter.delete).not.toHaveBeenCalled();
		});
	});
});
