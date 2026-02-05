import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VersionOperationsImpl } from './version-operations';
import { AccessDeniedError, DocumentNotFoundError } from './momentum-api.types';
import type {
	CollectionConfig,
	DatabaseAdapter,
	DocumentVersion,
	DocumentStatus,
} from '@momentum-cms/core';
import type { MomentumAPIContext } from './momentum-api.types';

// Mock collection with versioning enabled
const mockVersionedCollection: CollectionConfig = {
	slug: 'posts',
	labels: { singular: 'Post', plural: 'Posts' },
	fields: [
		{ name: 'title', type: 'text', required: true, label: 'Title' },
		{ name: 'content', type: 'textarea', label: 'Content' },
	],
	versions: { drafts: true, maxVersions: 10 },
};

// Mock collection with version access control
const mockRestrictedCollection: CollectionConfig = {
	slug: 'articles',
	labels: { singular: 'Article', plural: 'Articles' },
	fields: [{ name: 'title', type: 'text', required: true }],
	versions: { drafts: true },
	access: {
		read: () => true,
		readVersions: ({ req }) => !!req.user,
		publishVersions: ({ req }) => req.user?.role === 'admin',
		restoreVersions: ({ req }) => req.user?.role === 'admin',
	},
};

// Create a mock version
function createMockVersion(overrides: Partial<DocumentVersion> = {}): DocumentVersion {
	return {
		id: 'version-1',
		parent: 'doc-1',
		version: JSON.stringify({ title: 'Test', content: 'Hello' }),
		_status: 'draft' as DocumentStatus,
		autosave: false,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		...overrides,
	};
}

describe('VersionOperationsImpl', () => {
	let mockAdapter: DatabaseAdapter;
	let context: MomentumAPIContext;

	beforeEach(() => {
		mockAdapter = {
			find: vi.fn(),
			findById: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
			// Version operations
			createVersion: vi.fn(),
			findVersions: vi.fn(),
			findVersionById: vi.fn(),
			restoreVersion: vi.fn(),
			deleteVersions: vi.fn(),
			countVersions: vi.fn(),
			updateStatus: vi.fn(),
		};

		context = {};
	});

	describe('findVersions()', () => {
		it('should return paginated versions for a document', async () => {
			const mockVersions = [createMockVersion({ id: 'v1' }), createMockVersion({ id: 'v2' })];
			vi.mocked(mockAdapter.findById).mockResolvedValue({ id: 'doc-1', title: 'Test' });
			vi.mocked(mockAdapter.findVersions).mockResolvedValue(mockVersions);
			vi.mocked(mockAdapter.countVersions).mockResolvedValue(2);

			const versionOps = new VersionOperationsImpl(
				'posts',
				mockVersionedCollection,
				mockAdapter,
				context,
			);

			const result = await versionOps.findVersions('doc-1', { limit: 10, page: 1 });

			expect(result.docs).toHaveLength(2);
			expect(result.totalDocs).toBe(2);
			expect(result.page).toBe(1);
			expect(result.limit).toBe(10);
			expect(mockAdapter.findVersions).toHaveBeenCalledWith('posts', 'doc-1', expect.any(Object));
		});

		it('should throw DocumentNotFoundError if parent document does not exist', async () => {
			vi.mocked(mockAdapter.findById).mockResolvedValue(null);

			const versionOps = new VersionOperationsImpl(
				'posts',
				mockVersionedCollection,
				mockAdapter,
				context,
			);

			await expect(versionOps.findVersions('nonexistent')).rejects.toThrow(DocumentNotFoundError);
		});

		it('should parse version JSON data', async () => {
			const mockVersion = createMockVersion({
				version: JSON.stringify({ title: 'Parsed Title', content: 'Parsed Content' }),
			});
			vi.mocked(mockAdapter.findById).mockResolvedValue({ id: 'doc-1' });
			vi.mocked(mockAdapter.findVersions).mockResolvedValue([mockVersion]);
			vi.mocked(mockAdapter.countVersions).mockResolvedValue(1);

			const versionOps = new VersionOperationsImpl(
				'posts',
				mockVersionedCollection,
				mockAdapter,
				context,
			);

			const result = await versionOps.findVersions('doc-1');

			expect(result.docs[0].version).toEqual({
				title: 'Parsed Title',
				content: 'Parsed Content',
			});
		});

		it('should deny access when readVersions returns false', async () => {
			const versionOps = new VersionOperationsImpl(
				'articles',
				mockRestrictedCollection,
				mockAdapter,
				{}, // No user context
			);

			await expect(versionOps.findVersions('doc-1')).rejects.toThrow(AccessDeniedError);
		});

		it('should allow access when user is authenticated', async () => {
			vi.mocked(mockAdapter.findById).mockResolvedValue({ id: 'doc-1' });
			vi.mocked(mockAdapter.findVersions).mockResolvedValue([]);
			vi.mocked(mockAdapter.countVersions).mockResolvedValue(0);

			const versionOps = new VersionOperationsImpl(
				'articles',
				mockRestrictedCollection,
				mockAdapter,
				{ user: { id: '1' } },
			);

			await expect(versionOps.findVersions('doc-1')).resolves.toBeDefined();
		});
	});

	describe('findVersionById()', () => {
		it('should return a specific version by ID', async () => {
			const mockVersion = createMockVersion({ id: 'v1' });
			vi.mocked(mockAdapter.findVersionById).mockResolvedValue(mockVersion);

			const versionOps = new VersionOperationsImpl(
				'posts',
				mockVersionedCollection,
				mockAdapter,
				context,
			);

			const result = await versionOps.findVersionById('v1');

			expect(result).toBeDefined();
			expect(result?.id).toBe('v1');
			expect(mockAdapter.findVersionById).toHaveBeenCalledWith('posts', 'v1');
		});

		it('should return null when version not found', async () => {
			vi.mocked(mockAdapter.findVersionById).mockResolvedValue(null);

			const versionOps = new VersionOperationsImpl(
				'posts',
				mockVersionedCollection,
				mockAdapter,
				context,
			);

			const result = await versionOps.findVersionById('nonexistent');

			expect(result).toBeNull();
		});
	});

	describe('publish()', () => {
		it('should publish a document', async () => {
			const doc = { id: 'doc-1', title: 'Test', _status: 'draft' };
			vi.mocked(mockAdapter.findById)
				.mockResolvedValueOnce(doc)
				.mockResolvedValueOnce({ ...doc, _status: 'published' });
			vi.mocked(mockAdapter.updateStatus).mockResolvedValue(undefined);
			vi.mocked(mockAdapter.createVersion).mockResolvedValue(createMockVersion());

			const versionOps = new VersionOperationsImpl(
				'posts',
				mockVersionedCollection,
				mockAdapter,
				context,
			);

			const result = await versionOps.publish('doc-1');

			expect(result).toBeDefined();
			expect(mockAdapter.updateStatus).toHaveBeenCalledWith('posts', 'doc-1', 'published');
		});

		it('should throw DocumentNotFoundError for non-existent document', async () => {
			vi.mocked(mockAdapter.findById).mockResolvedValue(null);

			const versionOps = new VersionOperationsImpl(
				'posts',
				mockVersionedCollection,
				mockAdapter,
				context,
			);

			await expect(versionOps.publish('nonexistent')).rejects.toThrow(DocumentNotFoundError);
		});

		it('should deny access when user is not admin', async () => {
			const versionOps = new VersionOperationsImpl(
				'articles',
				mockRestrictedCollection,
				mockAdapter,
				{ user: { id: '1', role: 'user' } },
			);

			await expect(versionOps.publish('doc-1')).rejects.toThrow(AccessDeniedError);
		});

		it('should allow publish when user is admin', async () => {
			const doc = { id: 'doc-1', title: 'Test' };
			vi.mocked(mockAdapter.findById).mockResolvedValue(doc);
			vi.mocked(mockAdapter.updateStatus).mockResolvedValue(undefined);
			vi.mocked(mockAdapter.createVersion).mockResolvedValue(createMockVersion());

			const versionOps = new VersionOperationsImpl(
				'articles',
				mockRestrictedCollection,
				mockAdapter,
				{ user: { id: '1', role: 'admin' } },
			);

			await expect(versionOps.publish('doc-1')).resolves.toBeDefined();
		});
	});

	describe('unpublish()', () => {
		it('should unpublish a document', async () => {
			const doc = { id: 'doc-1', title: 'Test', _status: 'published' };
			vi.mocked(mockAdapter.findById)
				.mockResolvedValueOnce(doc)
				.mockResolvedValueOnce({ ...doc, _status: 'draft' });
			vi.mocked(mockAdapter.updateStatus).mockResolvedValue(undefined);

			const versionOps = new VersionOperationsImpl(
				'posts',
				mockVersionedCollection,
				mockAdapter,
				context,
			);

			const result = await versionOps.unpublish('doc-1');

			expect(result).toBeDefined();
			expect(mockAdapter.updateStatus).toHaveBeenCalledWith('posts', 'doc-1', 'draft');
		});

		it('should throw DocumentNotFoundError for non-existent document', async () => {
			vi.mocked(mockAdapter.findById).mockResolvedValue(null);

			const versionOps = new VersionOperationsImpl(
				'posts',
				mockVersionedCollection,
				mockAdapter,
				context,
			);

			await expect(versionOps.unpublish('nonexistent')).rejects.toThrow(DocumentNotFoundError);
		});
	});

	describe('restore()', () => {
		it('should restore a version', async () => {
			const restoredDoc = { id: 'doc-1', title: 'Restored', content: 'Old content' };
			vi.mocked(mockAdapter.restoreVersion).mockResolvedValue(restoredDoc);

			const versionOps = new VersionOperationsImpl(
				'posts',
				mockVersionedCollection,
				mockAdapter,
				context,
			);

			const result = await versionOps.restore({ versionId: 'v1' });

			expect(result).toEqual(restoredDoc);
			expect(mockAdapter.restoreVersion).toHaveBeenCalledWith('posts', 'v1');
		});

		it('should publish after restore when publish option is true', async () => {
			const restoredDoc = { id: 'doc-1', title: 'Restored' };
			vi.mocked(mockAdapter.restoreVersion).mockResolvedValue(restoredDoc);
			vi.mocked(mockAdapter.updateStatus).mockResolvedValue(undefined);

			const versionOps = new VersionOperationsImpl(
				'posts',
				mockVersionedCollection,
				mockAdapter,
				context,
			);

			await versionOps.restore({ versionId: 'v1', publish: true });

			expect(mockAdapter.updateStatus).toHaveBeenCalledWith('posts', 'doc-1', 'published');
		});

		it('should deny access when user is not admin', async () => {
			const versionOps = new VersionOperationsImpl(
				'articles',
				mockRestrictedCollection,
				mockAdapter,
				{ user: { id: '1', role: 'user' } },
			);

			await expect(versionOps.restore({ versionId: 'v1' })).rejects.toThrow(AccessDeniedError);
		});
	});

	describe('saveDraft()', () => {
		it('should save a draft version', async () => {
			const doc = { id: 'doc-1', title: 'Original' };
			const draftVersion = createMockVersion({ autosave: true });
			vi.mocked(mockAdapter.findById).mockResolvedValue(doc);
			vi.mocked(mockAdapter.createVersion).mockResolvedValue(draftVersion);

			const versionOps = new VersionOperationsImpl(
				'posts',
				mockVersionedCollection,
				mockAdapter,
				context,
			);

			const result = await versionOps.saveDraft('doc-1', { title: 'Draft Title' });

			expect(result).toBeDefined();
			expect(result.autosave).toBe(true);
			expect(mockAdapter.createVersion).toHaveBeenCalledWith(
				'posts',
				'doc-1',
				expect.objectContaining({ title: 'Draft Title' }),
				expect.objectContaining({ status: 'draft', autosave: true }),
			);
		});

		it('should throw DocumentNotFoundError for non-existent document', async () => {
			vi.mocked(mockAdapter.findById).mockResolvedValue(null);

			const versionOps = new VersionOperationsImpl(
				'posts',
				mockVersionedCollection,
				mockAdapter,
				context,
			);

			await expect(versionOps.saveDraft('nonexistent', {})).rejects.toThrow(DocumentNotFoundError);
		});
	});

	describe('getStatus()', () => {
		it('should return published status', async () => {
			vi.mocked(mockAdapter.findById).mockResolvedValue({ id: 'doc-1', _status: 'published' });

			const versionOps = new VersionOperationsImpl(
				'posts',
				mockVersionedCollection,
				mockAdapter,
				context,
			);

			const status = await versionOps.getStatus('doc-1');

			expect(status).toBe('published');
		});

		it('should return draft status by default', async () => {
			vi.mocked(mockAdapter.findById).mockResolvedValue({ id: 'doc-1' }); // No _status field

			const versionOps = new VersionOperationsImpl(
				'posts',
				mockVersionedCollection,
				mockAdapter,
				context,
			);

			const status = await versionOps.getStatus('doc-1');

			expect(status).toBe('draft');
		});

		it('should throw DocumentNotFoundError for non-existent document', async () => {
			vi.mocked(mockAdapter.findById).mockResolvedValue(null);

			const versionOps = new VersionOperationsImpl(
				'posts',
				mockVersionedCollection,
				mockAdapter,
				context,
			);

			await expect(versionOps.getStatus('nonexistent')).rejects.toThrow(DocumentNotFoundError);
		});
	});

	describe('compare()', () => {
		it('should compare two versions and return differences', async () => {
			const version1 = createMockVersion({
				id: 'v1',
				version: JSON.stringify({ title: 'Original', content: 'Hello' }),
			});
			const version2 = createMockVersion({
				id: 'v2',
				version: JSON.stringify({ title: 'Modified', content: 'Hello' }),
			});
			vi.mocked(mockAdapter.findVersionById)
				.mockResolvedValueOnce(version1)
				.mockResolvedValueOnce(version2);

			const versionOps = new VersionOperationsImpl(
				'posts',
				mockVersionedCollection,
				mockAdapter,
				context,
			);

			const differences = await versionOps.compare('v1', 'v2');

			expect(differences).toHaveLength(1);
			expect(differences[0]).toEqual({
				field: 'title',
				oldValue: 'Original',
				newValue: 'Modified',
			});
		});

		it('should throw error when version not found', async () => {
			vi.mocked(mockAdapter.findVersionById).mockResolvedValue(null);

			const versionOps = new VersionOperationsImpl(
				'posts',
				mockVersionedCollection,
				mockAdapter,
				context,
			);

			await expect(versionOps.compare('v1', 'v2')).rejects.toThrow(
				'One or both versions not found',
			);
		});
	});
});
