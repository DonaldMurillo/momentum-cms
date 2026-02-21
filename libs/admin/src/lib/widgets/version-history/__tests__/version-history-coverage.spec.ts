/**
 * Additional coverage tests for VersionHistoryWidget.
 *
 * Targets remaining uncovered statements/branches:
 * - loadVersions: page > 1 path (isLoadingMore vs isLoading)
 * - loadMore: error path setting isLoadingMore to false
 * - onRestore: isRestoring / restoringVersionId lifecycle
 * - onCompare: label1 date formatting
 * - getStatusVariant: coverage for all status values
 * - Effect: does NOT fire when collection or documentId is empty
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VersionHistoryWidget } from '../version-history.component';
import { VersionService, type DocumentVersionParsed } from '../../../services/version.service';
import { FeedbackService } from '../../feedback/feedback.service';
import { DialogService } from '@momentumcms/ui';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

describe('VersionHistoryWidget (coverage)', () => {
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

	function createComponent(
		collectionSlug = 'posts',
		docId = 'doc-1',
	): ComponentFixture<VersionHistoryWidget> {
		fixture = TestBed.createComponent(VersionHistoryWidget);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('collection', collectionSlug);
		fixture.componentRef.setInput('documentId', docId);
		fixture.detectChanges();
		return fixture;
	}

	// -----------------------------------------------------------------------
	// Effect does NOT fire without both inputs
	// -----------------------------------------------------------------------
	describe('effect - empty inputs', () => {
		it('should not call findVersions when collection is empty string', async () => {
			fixture = TestBed.createComponent(VersionHistoryWidget);
			component = fixture.componentInstance;
			fixture.componentRef.setInput('collection', '');
			fixture.componentRef.setInput('documentId', 'doc-1');
			fixture.detectChanges();

			await new Promise((r) => setTimeout(r, 50));
			expect(mockVersionService.findVersions).not.toHaveBeenCalled();
		});

		it('should not call findVersions when documentId is empty string', async () => {
			fixture = TestBed.createComponent(VersionHistoryWidget);
			component = fixture.componentInstance;
			fixture.componentRef.setInput('collection', 'posts');
			fixture.componentRef.setInput('documentId', '');
			fixture.detectChanges();

			await new Promise((r) => setTimeout(r, 50));
			expect(mockVersionService.findVersions).not.toHaveBeenCalled();
		});
	});

	// -----------------------------------------------------------------------
	// loadMore - page 2 sets isLoadingMore, not isLoading
	// -----------------------------------------------------------------------
	describe('loadMore - isLoadingMore lifecycle', () => {
		it('should set isLoadingMore to true during page 2 load', async () => {
			const page1Docs = [makeVersion({ id: 'v1' }), makeVersion({ id: 'v2' })];
			mockVersionService.findVersions.mockResolvedValueOnce(makePage1Result(page1Docs, true));
			createComponent();

			await vi.waitFor(() => {
				expect(component.versions().length).toBe(2);
			});

			// Setup slow resolve for page 2
			let resolvePage2!: (value: unknown) => void;
			mockVersionService.findVersions.mockImplementation(
				() => new Promise((resolve) => (resolvePage2 = resolve)),
			);

			component.loadMore();

			// isLoadingMore should be true; isLoading should be false
			await vi.waitFor(() => {
				expect(component.isLoadingMore()).toBe(true);
			});
			expect(component.isLoading()).toBe(false);

			// Resolve
			resolvePage2({
				docs: [makeVersion({ id: 'v3' })],
				hasNextPage: false,
				totalDocs: 3,
				totalPages: 1,
			});

			await vi.waitFor(() => {
				expect(component.isLoadingMore()).toBe(false);
			});
		});
	});

	// -----------------------------------------------------------------------
	// onRestore - full lifecycle of isRestoring / restoringVersionId
	// -----------------------------------------------------------------------
	describe('onRestore - state lifecycle', () => {
		it('should set restoringVersionId to the version id during restore', async () => {
			const version = makeVersion({ id: 'v-restore' });
			mockVersionService.findVersions.mockResolvedValue(makePage1Result([version], false));
			createComponent();

			await vi.waitFor(() => {
				expect(component.isLoading()).toBe(false);
			});

			let resolveRestore!: () => void;
			mockVersionService.restore.mockImplementation(
				() => new Promise<void>((resolve) => (resolveRestore = resolve)),
			);

			const promise = component.onRestore(version);

			await vi.waitFor(() => {
				expect(component.isRestoring()).toBe(true);
				expect(component.restoringVersionId()).toBe('v-restore');
			});

			resolveRestore();
			await promise;

			expect(component.isRestoring()).toBe(false);
			expect(component.restoringVersionId()).toBeNull();
		});

		it('should reset isRestoring and restoringVersionId on error', async () => {
			const version = makeVersion({ id: 'v-fail' });
			mockVersionService.findVersions.mockResolvedValue(makePage1Result());
			createComponent();

			await vi.waitFor(() => {
				expect(component.isLoading()).toBe(false);
			});

			mockVersionService.restore.mockRejectedValue(new Error('Server down'));
			await component.onRestore(version);

			expect(component.isRestoring()).toBe(false);
			expect(component.restoringVersionId()).toBeNull();
		});
	});

	// -----------------------------------------------------------------------
	// onCompare - label1 is formatted date
	// -----------------------------------------------------------------------
	describe('onCompare - label1 formatting', () => {
		it('should set label1 as locale formatted date string', async () => {
			const current = makeVersion({
				id: 'v-current',
				createdAt: '2024-12-25T12:00:00Z',
			});
			const older = makeVersion({
				id: 'v-old',
				createdAt: '2024-06-15T08:30:00Z',
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
						versionId1: 'v-old',
						versionId2: 'v-current',
						label1: expect.any(String),
						label2: 'Current',
						collection: 'posts',
						documentId: 'doc-1',
					}),
					width: '40rem',
				}),
			);

			// label1 should be a date string (locale-dependent)
			const callData = mockDialog.open.mock.calls[0][1].data;
			expect(callData.label1.length).toBeGreaterThan(0);
		});
	});

	// -----------------------------------------------------------------------
	// getStatusVariant - all status types
	// -----------------------------------------------------------------------
	describe('getStatusVariant - all statuses', () => {
		it('should return "default" for "published"', () => {
			createComponent();
			expect(component.getStatusVariant('published')).toBe('default');
		});

		it('should return "secondary" for "draft"', () => {
			createComponent();
			expect(component.getStatusVariant('draft')).toBe('secondary');
		});

		it('should return "secondary" for any non-published status', () => {
			createComponent();
			expect(component.getStatusVariant('changed' as 'draft')).toBe('secondary');
		});
	});

	// -----------------------------------------------------------------------
	// documentLabel - custom vs default
	// -----------------------------------------------------------------------
	describe('documentLabel - used in restore flow', () => {
		it('should pass custom documentLabel to confirmRestore and versionRestored', async () => {
			mockVersionService.findVersions.mockResolvedValue(makePage1Result());
			createComponent();
			fixture.componentRef.setInput('documentLabel', 'Blog Post');
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.isLoading()).toBe(false);
			});

			const version = makeVersion({ id: 'v-custom-label' });
			await component.onRestore(version);

			expect(mockFeedback.confirmRestore).toHaveBeenCalledWith('Blog Post');
			expect(mockFeedback.versionRestored).toHaveBeenCalledWith('Blog Post');
		});
	});

	// -----------------------------------------------------------------------
	// loadVersions replace vs append behavior
	// -----------------------------------------------------------------------
	describe('loadVersions - replace on new input change', () => {
		it('should replace versions (not append) when documentId changes', async () => {
			const docsA = [makeVersion({ id: 'a1' }), makeVersion({ id: 'a2' })];
			const docsB = [makeVersion({ id: 'b1' })];

			mockVersionService.findVersions
				.mockResolvedValueOnce(makePage1Result(docsA, false))
				.mockResolvedValueOnce(makePage1Result(docsB, false));

			createComponent('posts', 'doc-A');

			await vi.waitFor(() => {
				expect(component.versions().length).toBe(2);
			});

			// Change documentId -> triggers effect -> replace
			fixture.componentRef.setInput('documentId', 'doc-B');
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.versions().length).toBe(1);
				expect(component.versions()[0].id).toBe('b1');
			});
		});
	});
});
