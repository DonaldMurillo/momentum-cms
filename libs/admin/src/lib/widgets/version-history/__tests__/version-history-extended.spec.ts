import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VersionHistoryWidget } from '../version-history.component';
import { VersionService, type DocumentVersionParsed } from '../../../services/version.service';
import { FeedbackService } from '../../feedback/feedback.service';
import { DialogService } from '@momentumcms/ui';

/**
 * Helper: creates a DocumentVersionParsed stub with sensible defaults.
 */
function makeVersion(overrides: Partial<DocumentVersionParsed> = {}): DocumentVersionParsed {
	return {
		id: overrides.id ?? 'v-default',
		parent: overrides.parent ?? 'doc-1',
		version: overrides.version ?? {},
		_status: overrides._status ?? 'draft',
		createdAt: overrides.createdAt ?? '2024-06-15T10:00:00Z',
		updatedAt: overrides.updatedAt ?? '2024-06-15T10:00:00Z',
		autosave: overrides.autosave ?? false,
	};
}

/**
 * Builds the page-1 result that the effect() will consume on initialisation.
 */
function makePage1Result(
	docs: DocumentVersionParsed[] = [],
	hasNextPage = false,
): {
	docs: DocumentVersionParsed[];
	hasNextPage: boolean;
	totalDocs: number;
	totalPages: number;
} {
	return { docs, hasNextPage, totalDocs: docs.length, totalPages: hasNextPage ? 2 : 1 };
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

class MockVersionService {
	findVersions = vi.fn().mockResolvedValue(makePage1Result());
	restore = vi.fn().mockResolvedValue(undefined);
	compareVersions = vi.fn().mockResolvedValue([]);
}

class MockFeedbackService {
	confirmRestore = vi.fn().mockResolvedValue(true);
	versionRestored = vi.fn();
	operationFailed = vi.fn();
}

class MockDialogService {
	open = vi.fn().mockReturnValue({ afterClosed: { subscribe: vi.fn() } });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VersionHistoryWidget (extended coverage)', () => {
	let fixture: ComponentFixture<VersionHistoryWidget>;
	let component: VersionHistoryWidget;
	let mockVersionService: MockVersionService;
	let mockFeedback: MockFeedbackService;
	let mockDialog: MockDialogService;

	beforeEach(async () => {
		mockVersionService = new MockVersionService();
		mockFeedback = new MockFeedbackService();
		mockDialog = new MockDialogService();

		await TestBed.configureTestingModule({
			imports: [VersionHistoryWidget],
			providers: [
				{ provide: VersionService, useValue: mockVersionService },
				{ provide: FeedbackService, useValue: mockFeedback },
				{ provide: DialogService, useValue: mockDialog },
			],
		})
			.overrideComponent(VersionHistoryWidget, {
				set: { template: '<div></div>', imports: [] },
			})
			.compileComponents();
	});

	/** Convenience: create the fixture, set required inputs, trigger CD. */
	function createComponent(
		collectionSlug = 'posts',
		docId = 'doc-1',
	): ComponentFixture<VersionHistoryWidget> {
		fixture = TestBed.createComponent(VersionHistoryWidget);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('collection', collectionSlug);
		fixture.componentRef.setInput('documentId', docId);
		fixture.detectChanges(); // triggers the effect()
		return fixture;
	}

	// -----------------------------------------------------------------------
	// 1. loadVersions with actual data (versions populated)
	// -----------------------------------------------------------------------
	describe('loadVersions – populated data path', () => {
		const v1 = makeVersion({
			id: 'v1',
			_status: 'published',
			createdAt: '2024-06-15T12:00:00Z',
		});
		const v2 = makeVersion({
			id: 'v2',
			_status: 'draft',
			createdAt: '2024-06-14T08:00:00Z',
		});

		it('should populate versions() with returned docs', async () => {
			mockVersionService.findVersions.mockResolvedValue(makePage1Result([v1, v2], false));
			createComponent();

			await vi.waitFor(() => {
				expect(component.versions()).toEqual([v1, v2]);
			});
		});

		it('should set currentPage() to 1 after initial load', async () => {
			mockVersionService.findVersions.mockResolvedValue(makePage1Result([v1], false));
			createComponent();

			await vi.waitFor(() => {
				expect(component.currentPage()).toBe(1);
			});
		});

		it('should set hasNextPage() to true when more pages exist', async () => {
			mockVersionService.findVersions.mockResolvedValue(makePage1Result([v1, v2], true));
			createComponent();

			await vi.waitFor(() => {
				expect(component.hasNextPage()).toBe(true);
			});
		});

		it('should set hasNextPage() to false when no more pages', async () => {
			mockVersionService.findVersions.mockResolvedValue(makePage1Result([v1], false));
			createComponent();

			await vi.waitFor(() => {
				expect(component.hasNextPage()).toBe(false);
			});
		});

		it('should transition isLoading from true to false', async () => {
			let resolveFindVersions!: (value: unknown) => void;
			mockVersionService.findVersions.mockImplementation(
				() => new Promise((resolve) => (resolveFindVersions = resolve)),
			);
			createComponent();

			// The effect has fired; findVersions is pending
			await vi.waitFor(() => {
				expect(component.isLoading()).toBe(true);
			});

			resolveFindVersions(makePage1Result([v1], false));

			await vi.waitFor(() => {
				expect(component.isLoading()).toBe(false);
			});
			expect(component.versions()).toEqual([v1]);
		});

		it('should pass correct options (limit, page, includeAutosave) to findVersions', async () => {
			mockVersionService.findVersions.mockResolvedValue(makePage1Result());
			createComponent();

			await vi.waitFor(() => {
				expect(mockVersionService.findVersions).toHaveBeenCalledWith('posts', 'doc-1', {
					limit: 10,
					page: 1,
					includeAutosave: true,
				});
			});
		});

		it('should replace versions (not append) on initial load', async () => {
			const initialDocs = [v1];
			const refreshDocs = [v2];

			mockVersionService.findVersions
				.mockResolvedValueOnce(makePage1Result(initialDocs, false))
				.mockResolvedValueOnce(makePage1Result(refreshDocs, false));

			createComponent();

			await vi.waitFor(() => {
				expect(component.versions()).toEqual(initialDocs);
			});

			// Simulate a reload by changing documentId (triggers effect again)
			fixture.componentRef.setInput('documentId', 'doc-2');
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.versions()).toEqual(refreshDocs);
			});
		});
	});

	// -----------------------------------------------------------------------
	// 2. loadVersions error path
	// -----------------------------------------------------------------------
	describe('loadVersions – error path', () => {
		it('should set error() to failure message when findVersions rejects', async () => {
			mockVersionService.findVersions.mockRejectedValue(new Error('API down'));
			createComponent();

			await vi.waitFor(() => {
				expect(component.error()).toBe('Failed to load version history');
			});
		});

		it('should set isLoading() to false after error', async () => {
			mockVersionService.findVersions.mockRejectedValue(new Error('500'));
			createComponent();

			await vi.waitFor(() => {
				expect(component.isLoading()).toBe(false);
			});
		});

		it('should clear error on next successful load', async () => {
			const v1 = makeVersion({ id: 'v1' });

			mockVersionService.findVersions
				.mockRejectedValueOnce(new Error('fail'))
				.mockResolvedValueOnce(makePage1Result([v1], false));

			createComponent();

			// First: error
			await vi.waitFor(() => {
				expect(component.error()).toBe('Failed to load version history');
			});

			// Trigger a reload via input change
			fixture.componentRef.setInput('documentId', 'doc-2');
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.error()).toBeNull();
				expect(component.versions()).toEqual([v1]);
			});
		});
	});

	// -----------------------------------------------------------------------
	// 3. loadMore with actual data (append mode)
	// -----------------------------------------------------------------------
	describe('loadMore – append mode', () => {
		const page1Docs = [
			makeVersion({ id: 'v1', createdAt: '2024-06-15T12:00:00Z' }),
			makeVersion({ id: 'v2', createdAt: '2024-06-14T12:00:00Z' }),
		];
		const page2Docs = [
			makeVersion({ id: 'v3', createdAt: '2024-06-13T12:00:00Z' }),
			makeVersion({ id: 'v4', createdAt: '2024-06-12T12:00:00Z' }),
		];

		it('should append new versions to existing ones', async () => {
			mockVersionService.findVersions.mockResolvedValueOnce(makePage1Result(page1Docs, true));
			createComponent();

			await vi.waitFor(() => {
				expect(component.versions().length).toBe(2);
			});

			mockVersionService.findVersions.mockResolvedValueOnce({
				docs: page2Docs,
				hasNextPage: false,
				totalDocs: 4,
				totalPages: 2,
			});

			component.loadMore();

			await vi.waitFor(() => {
				expect(component.versions().length).toBe(4);
			});

			// Verify order: page1 first, page2 appended
			expect(component.versions().map((v) => v.id)).toEqual(['v1', 'v2', 'v3', 'v4']);
		});

		it('should set isLoadingMore (not isLoading) during append', async () => {
			mockVersionService.findVersions.mockResolvedValueOnce(makePage1Result(page1Docs, true));
			createComponent();

			await vi.waitFor(() => {
				expect(component.versions().length).toBe(2);
			});

			let resolvePage2!: (value: unknown) => void;
			mockVersionService.findVersions.mockImplementation(
				() => new Promise((resolve) => (resolvePage2 = resolve)),
			);

			component.loadMore();

			await vi.waitFor(() => {
				expect(component.isLoadingMore()).toBe(true);
			});
			// isLoading should NOT be true for page > 1
			expect(component.isLoading()).toBe(false);

			resolvePage2({
				docs: page2Docs,
				hasNextPage: false,
				totalDocs: 4,
				totalPages: 2,
			});

			await vi.waitFor(() => {
				expect(component.isLoadingMore()).toBe(false);
			});
		});

		it('should update currentPage() after loadMore', async () => {
			mockVersionService.findVersions.mockResolvedValueOnce(makePage1Result(page1Docs, true));
			createComponent();

			await vi.waitFor(() => {
				expect(component.currentPage()).toBe(1);
			});

			mockVersionService.findVersions.mockResolvedValueOnce({
				docs: page2Docs,
				hasNextPage: false,
				totalDocs: 4,
				totalPages: 2,
			});

			component.loadMore();

			await vi.waitFor(() => {
				expect(component.currentPage()).toBe(2);
			});
		});

		it('should update hasNextPage() after loadMore', async () => {
			mockVersionService.findVersions.mockResolvedValueOnce(makePage1Result(page1Docs, true));
			createComponent();

			await vi.waitFor(() => {
				expect(component.hasNextPage()).toBe(true);
			});

			mockVersionService.findVersions.mockResolvedValueOnce({
				docs: page2Docs,
				hasNextPage: false,
				totalDocs: 4,
				totalPages: 2,
			});

			component.loadMore();

			await vi.waitFor(() => {
				expect(component.hasNextPage()).toBe(false);
			});
		});
	});

	// -----------------------------------------------------------------------
	// 4. loadMore error path
	// -----------------------------------------------------------------------
	describe('loadMore – error path', () => {
		it('should set isLoadingMore to false when loadMore fails', async () => {
			const page1Docs = [makeVersion({ id: 'v1' })];
			mockVersionService.findVersions.mockResolvedValueOnce(makePage1Result(page1Docs, true));
			createComponent();

			await vi.waitFor(() => {
				expect(component.versions().length).toBe(1);
			});

			mockVersionService.findVersions.mockRejectedValueOnce(new Error('Network error'));

			component.loadMore();

			await vi.waitFor(() => {
				expect(component.isLoadingMore()).toBe(false);
			});
		});

		it('should set error message when loadMore fails', async () => {
			const page1Docs = [makeVersion({ id: 'v1' })];
			mockVersionService.findVersions.mockResolvedValueOnce(makePage1Result(page1Docs, true));
			createComponent();

			await vi.waitFor(() => {
				expect(component.versions().length).toBe(1);
			});

			mockVersionService.findVersions.mockRejectedValueOnce(new Error('timeout'));

			component.loadMore();

			await vi.waitFor(() => {
				expect(component.error()).toBe('Failed to load version history');
			});
		});

		it('should preserve existing versions when loadMore fails', async () => {
			const page1Docs = [makeVersion({ id: 'v1' })];
			mockVersionService.findVersions.mockResolvedValueOnce(makePage1Result(page1Docs, true));
			createComponent();

			await vi.waitFor(() => {
				expect(component.versions().length).toBe(1);
			});

			mockVersionService.findVersions.mockRejectedValueOnce(new Error('fail'));

			component.loadMore();

			await vi.waitFor(() => {
				expect(component.isLoadingMore()).toBe(false);
			});
			// Existing versions should still be there
			expect(component.versions()).toEqual(page1Docs);
		});
	});

	// -----------------------------------------------------------------------
	// 5. onRestore success – emits restored output and reloads
	// -----------------------------------------------------------------------
	describe('onRestore – restored output & reload', () => {
		const version = makeVersion({
			id: 'v-old',
			_status: 'published',
			createdAt: '2024-05-01T00:00:00Z',
		});

		it('should emit the restored version via output', async () => {
			const initialDocs = [makeVersion({ id: 'v-current' }), version];
			mockVersionService.findVersions.mockResolvedValue(makePage1Result(initialDocs, false));
			createComponent();

			await vi.waitFor(() => {
				expect(component.versions().length).toBe(2);
			});

			const emittedValues: DocumentVersionParsed[] = [];
			component.restored.subscribe((v) => emittedValues.push(v));

			await component.onRestore(version);

			expect(emittedValues).toHaveLength(1);
			expect(emittedValues[0]).toBe(version);
		});

		it('should reload versions after successful restore', async () => {
			const initialDocs = [makeVersion({ id: 'v-current' }), version];
			mockVersionService.findVersions.mockResolvedValue(makePage1Result(initialDocs, false));
			createComponent();

			await vi.waitFor(() => {
				expect(component.versions().length).toBe(2);
			});

			// Clear call count from initial load
			mockVersionService.findVersions.mockClear();
			mockVersionService.findVersions.mockResolvedValue(makePage1Result(initialDocs, false));

			await component.onRestore(version);

			// findVersions should have been called again for reload
			expect(mockVersionService.findVersions).toHaveBeenCalledWith(
				'posts',
				'doc-1',
				expect.objectContaining({ page: 1 }),
			);
		});

		it('should call versionRestored on feedback service after success', async () => {
			mockVersionService.findVersions.mockResolvedValue(makePage1Result());
			createComponent();

			await vi.waitFor(() => {
				expect(component.isLoading()).toBe(false);
			});

			await component.onRestore(version);

			expect(mockFeedback.versionRestored).toHaveBeenCalledWith('Document');
		});

		it('should use custom documentLabel in feedback messages', async () => {
			mockVersionService.findVersions.mockResolvedValue(makePage1Result());
			createComponent();
			fixture.componentRef.setInput('documentLabel', 'Article');
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.isLoading()).toBe(false);
			});

			await component.onRestore(version);

			expect(mockFeedback.confirmRestore).toHaveBeenCalledWith('Article');
			expect(mockFeedback.versionRestored).toHaveBeenCalledWith('Article');
		});

		it('should not emit restored when confirmation is declined', async () => {
			mockVersionService.findVersions.mockResolvedValue(makePage1Result());
			createComponent();

			await vi.waitFor(() => {
				expect(component.isLoading()).toBe(false);
			});

			mockFeedback.confirmRestore.mockResolvedValue(false);

			const emittedValues: DocumentVersionParsed[] = [];
			component.restored.subscribe((v) => emittedValues.push(v));

			await component.onRestore(version);

			expect(emittedValues).toHaveLength(0);
			expect(mockVersionService.restore).not.toHaveBeenCalled();
		});

		it('should not emit restored when restore throws', async () => {
			mockVersionService.findVersions.mockResolvedValue(makePage1Result());
			createComponent();

			await vi.waitFor(() => {
				expect(component.isLoading()).toBe(false);
			});

			mockVersionService.restore.mockRejectedValue(new Error('Server error'));

			const emittedValues: DocumentVersionParsed[] = [];
			component.restored.subscribe((v) => emittedValues.push(v));

			await component.onRestore(version);

			expect(emittedValues).toHaveLength(0);
			expect(mockFeedback.operationFailed).toHaveBeenCalledWith(
				'Restore failed',
				expect.any(Error),
			);
		});

		it('should wrap non-Error thrown values in an Error for operationFailed', async () => {
			mockVersionService.findVersions.mockResolvedValue(makePage1Result());
			createComponent();

			await vi.waitFor(() => {
				expect(component.isLoading()).toBe(false);
			});

			mockVersionService.restore.mockRejectedValue('plain string error');

			await component.onRestore(version);

			expect(mockFeedback.operationFailed).toHaveBeenCalledWith(
				'Restore failed',
				expect.objectContaining({
					message: 'Could not restore to selected version',
				}),
			);
		});
	});

	// -----------------------------------------------------------------------
	// 6. onCompare – additional coverage
	// -----------------------------------------------------------------------
	describe('onCompare – with populated versions', () => {
		it('should use the first version in the array as "current"', async () => {
			const current = makeVersion({
				id: 'v-latest',
				_status: 'published',
				createdAt: '2024-06-20T00:00:00Z',
			});
			const older = makeVersion({
				id: 'v-older',
				_status: 'draft',
				createdAt: '2024-06-10T00:00:00Z',
			});

			mockVersionService.findVersions.mockResolvedValue(makePage1Result([current, older], false));
			createComponent();

			await vi.waitFor(() => {
				expect(component.versions().length).toBe(2);
			});

			component.onCompare(older);

			expect(mockDialog.open).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({
					data: expect.objectContaining({
						versionId1: 'v-older',
						versionId2: 'v-latest',
						label2: 'Current',
					}),
					width: '40rem',
				}),
			);
		});
	});
});
