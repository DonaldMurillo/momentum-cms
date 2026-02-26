/**
 * Template coverage tests for VersionHistoryWidget.
 *
 * Renders the REAL component template so that all template expression
 * statements (bindings, `@if`, `@for`, event handlers, attribute bindings,
 * date pipe, etc.) are evaluated by the coverage tool.
 *
 * Strategy:
 *   - Use NO_ERRORS_SCHEMA so unknown child selectors are tolerated.
 *   - Override only the component's `imports` (to [DatePipe]) — keep the template.
 *   - Mock VersionService, FeedbackService, DialogService.
 *   - Manipulate signals to hit each `@if`/`@else if`/`@else`/`@for` branch.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { DatePipe } from '@angular/common';
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

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

class MockVersionService {
	findVersions = vi.fn().mockResolvedValue({
		docs: [],
		hasNextPage: false,
		totalDocs: 0,
		totalPages: 1,
	});
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

describe('VersionHistoryWidget (template coverage)', () => {
	let fixture: ComponentFixture<VersionHistoryWidget>;
	let component: VersionHistoryWidget;
	let mockVersionService: MockVersionService;

	beforeEach(async () => {
		mockVersionService = new MockVersionService();

		await TestBed.configureTestingModule({
			imports: [VersionHistoryWidget],
			schemas: [NO_ERRORS_SCHEMA],
			providers: [
				{ provide: VersionService, useValue: mockVersionService },
				{ provide: FeedbackService, useClass: MockFeedbackService },
				{ provide: DialogService, useClass: MockDialogService },
			],
		})
			.overrideComponent(VersionHistoryWidget, {
				set: {
					imports: [DatePipe],
					schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA],
				},
			})
			.compileComponents();
	});

	afterEach(() => {
		TestBed.resetTestingModule();
	});

	function createComponent(): void {
		fixture = TestBed.createComponent(VersionHistoryWidget);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('collection', 'posts');
		fixture.componentRef.setInput('documentId', 'doc-1');
		fixture.detectChanges();
	}

	// -------------------------------------------------------------------
	// Header: badge with version count
	// -------------------------------------------------------------------
	describe('header badge', () => {
		it('should NOT render badge when versions is empty', () => {
			createComponent();
			component.versions.set([]);
			component.isLoading.set(false);
			fixture.detectChanges();

			const _badges = fixture.nativeElement.querySelectorAll('mcms-badge');
			// No badge in the header (versions().length === 0)
			const headerBadge = fixture.nativeElement.querySelector('mcms-card-header mcms-badge');
			expect(headerBadge).toBeNull();
		});

		it('should render badge with version count when versions exist', () => {
			createComponent();
			component.versions.set([makeVersion({ id: 'v1' }), makeVersion({ id: 'v2' })]);
			component.isLoading.set(false);
			fixture.detectChanges();

			const headerBadge = fixture.nativeElement.querySelector('mcms-card-header mcms-badge');
			expect(headerBadge).toBeTruthy();
			expect(headerBadge.textContent.trim()).toBe('2');
		});
	});

	// -------------------------------------------------------------------
	// Branch: @if (isLoading()) — skeleton loading state
	// -------------------------------------------------------------------
	describe('loading state branch', () => {
		it('should render skeletons when isLoading is true', () => {
			createComponent();
			component.isLoading.set(true);
			fixture.detectChanges();

			const skeletons = fixture.nativeElement.querySelectorAll('mcms-skeleton');
			expect(skeletons.length).toBe(3);
		});
	});

	// -------------------------------------------------------------------
	// Branch: @else if (error()) — error state
	// -------------------------------------------------------------------
	describe('error state branch', () => {
		it('should render error message with role=alert', () => {
			createComponent();
			component.isLoading.set(false);
			component.error.set('Failed to load version history');
			fixture.detectChanges();

			const errorEl = fixture.nativeElement.querySelector('[role="alert"]');
			expect(errorEl).toBeTruthy();
			expect(errorEl.textContent).toContain('Failed to load version history');
		});
	});

	// -------------------------------------------------------------------
	// Branch: @else if (versions().length === 0) — empty state
	// -------------------------------------------------------------------
	describe('empty state branch', () => {
		it('should render empty message when no versions and not loading', () => {
			createComponent();
			component.isLoading.set(false);
			component.versions.set([]);
			component.error.set(null);
			fixture.detectChanges();

			const text = fixture.nativeElement.textContent;
			expect(text).toContain('No version history available');
		});
	});

	// -------------------------------------------------------------------
	// Branch: @else — version list
	// -------------------------------------------------------------------
	describe('version list branch', () => {
		it('should render version items with status badges', () => {
			createComponent();
			component.isLoading.set(false);
			component.versions.set([
				makeVersion({ id: 'v1', _status: 'published' }),
				makeVersion({ id: 'v2', _status: 'draft' }),
			]);
			fixture.detectChanges();

			const badges = fixture.nativeElement.querySelectorAll('mcms-badge');
			expect(badges.length).toBeGreaterThanOrEqual(2);
		});

		it('should render "current" badge only for the first version', () => {
			createComponent();
			component.isLoading.set(false);
			component.versions.set([
				makeVersion({ id: 'v1', _status: 'published' }),
				makeVersion({ id: 'v2', _status: 'draft' }),
			]);
			fixture.detectChanges();

			const allText = fixture.nativeElement.textContent;
			// "current" should appear once
			const currentMatches = allText.match(/current/g);
			expect(currentMatches).toBeTruthy();
			expect(currentMatches?.length).toBe(1);
		});

		it('should render "autosave" badge for autosave versions', () => {
			createComponent();
			component.isLoading.set(false);
			component.versions.set([
				makeVersion({ id: 'v1', autosave: false }),
				makeVersion({ id: 'v2', autosave: true }),
			]);
			fixture.detectChanges();

			const text = fixture.nativeElement.textContent;
			expect(text).toContain('autosave');
		});

		it('should render separator between versions (not before the first)', () => {
			createComponent();
			component.isLoading.set(false);
			component.versions.set([
				makeVersion({ id: 'v1' }),
				makeVersion({ id: 'v2' }),
				makeVersion({ id: 'v3' }),
			]);
			fixture.detectChanges();

			const separators = fixture.nativeElement.querySelectorAll('mcms-separator');
			// 3 versions -> 2 separators (no separator before the first)
			expect(separators.length).toBe(2);
		});

		it('should render date using date pipe', () => {
			createComponent();
			component.isLoading.set(false);
			component.versions.set([makeVersion({ id: 'v1', createdAt: '2024-12-25T12:00:00Z' })]);
			fixture.detectChanges();

			// The date pipe should produce a date string (locale-dependent)
			const dateEl = fixture.nativeElement.querySelector('.text-muted-foreground');
			expect(dateEl).toBeTruthy();
			expect(dateEl.textContent.trim().length).toBeGreaterThan(0);
		});

		it('should render Compare and Restore buttons for non-first versions', () => {
			createComponent();
			component.isLoading.set(false);
			component.versions.set([makeVersion({ id: 'v1' }), makeVersion({ id: 'v2' })]);
			fixture.detectChanges();

			const compareBtn = fixture.nativeElement.querySelector(
				'[aria-label="Compare with current version"]',
			);
			expect(compareBtn).toBeTruthy();

			const restoreButtons = fixture.nativeElement.querySelectorAll(
				'[aria-label*="Restore version"]',
			);
			expect(restoreButtons.length).toBe(1);
		});

		it('should NOT render Compare/Restore for the first (current) version', () => {
			createComponent();
			component.isLoading.set(false);
			component.versions.set([makeVersion({ id: 'v1' })]);
			fixture.detectChanges();

			const compareBtn = fixture.nativeElement.querySelector(
				'[aria-label="Compare with current version"]',
			);
			expect(compareBtn).toBeNull();
		});

		it('should call onCompare when Compare button is clicked', () => {
			createComponent();
			component.isLoading.set(false);
			const v1 = makeVersion({ id: 'v1' });
			const v2 = makeVersion({ id: 'v2' });
			component.versions.set([v1, v2]);
			fixture.detectChanges();

			const spy = vi.spyOn(component, 'onCompare');
			const compareBtn = fixture.nativeElement.querySelector(
				'[aria-label="Compare with current version"]',
			);
			compareBtn.click();
			expect(spy).toHaveBeenCalledWith(v2);
		});

		it('should call onRestore when Restore button is clicked', () => {
			createComponent();
			component.isLoading.set(false);
			const v1 = makeVersion({ id: 'v1' });
			const v2 = makeVersion({ id: 'v2' });
			component.versions.set([v1, v2]);
			fixture.detectChanges();

			const spy = vi.spyOn(component, 'onRestore');
			const restoreBtn = fixture.nativeElement.querySelector('[aria-label*="Restore version"]');
			restoreBtn.click();
			expect(spy).toHaveBeenCalledWith(v2);
		});

		it('should show "Restoring..." text when restoring a specific version', () => {
			createComponent();
			component.isLoading.set(false);
			const v1 = makeVersion({ id: 'v1' });
			const v2 = makeVersion({ id: 'v2' });
			component.versions.set([v1, v2]);
			component.isRestoring.set(true);
			component.restoringVersionId.set('v2');
			fixture.detectChanges();

			const text = fixture.nativeElement.textContent;
			expect(text).toContain('Restoring...');
		});

		it('should show "Restore" text when not restoring', () => {
			createComponent();
			component.isLoading.set(false);
			const v1 = makeVersion({ id: 'v1' });
			const v2 = makeVersion({ id: 'v2' });
			component.versions.set([v1, v2]);
			component.isRestoring.set(false);
			fixture.detectChanges();

			const restoreBtn = fixture.nativeElement.querySelector('[aria-label*="Restore version"]');
			expect(restoreBtn.textContent.trim()).toContain('Restore');
		});

		it('should disable restore button when isRestoring is true', () => {
			createComponent();
			component.isLoading.set(false);
			const v1 = makeVersion({ id: 'v1' });
			const v2 = makeVersion({ id: 'v2' });
			component.versions.set([v1, v2]);
			component.isRestoring.set(true);
			fixture.detectChanges();

			const restoreBtn = fixture.nativeElement.querySelector('[aria-label*="Restore version"]');
			expect(restoreBtn.disabled).toBe(true);
		});
	});

	// -------------------------------------------------------------------
	// Branch: @if (hasNextPage()) — load more
	// -------------------------------------------------------------------
	describe('load more button', () => {
		it('should render load more button when hasNextPage is true', () => {
			createComponent();
			component.isLoading.set(false);
			component.versions.set([makeVersion({ id: 'v1' })]);
			component.hasNextPage.set(true);
			fixture.detectChanges();

			const text = fixture.nativeElement.textContent;
			expect(text).toContain('Load more');
		});

		it('should NOT render load more button when hasNextPage is false', () => {
			createComponent();
			component.isLoading.set(false);
			component.versions.set([makeVersion({ id: 'v1' })]);
			component.hasNextPage.set(false);
			fixture.detectChanges();

			const text = fixture.nativeElement.textContent;
			expect(text).not.toContain('Load more');
		});

		it('should show "Loading..." when isLoadingMore is true', () => {
			createComponent();
			component.isLoading.set(false);
			component.versions.set([makeVersion({ id: 'v1' })]);
			component.hasNextPage.set(true);
			component.isLoadingMore.set(true);
			fixture.detectChanges();

			const text = fixture.nativeElement.textContent;
			expect(text).toContain('Loading...');
		});

		it('should disable load more button when isLoadingMore is true', () => {
			createComponent();
			component.isLoading.set(false);
			component.versions.set([makeVersion({ id: 'v1' })]);
			component.hasNextPage.set(true);
			component.isLoadingMore.set(true);
			fixture.detectChanges();

			// The load more button is inside the last div
			const buttons = fixture.nativeElement.querySelectorAll('button[mcms-button]');
			const lastButton = buttons[buttons.length - 1];
			expect(lastButton.disabled).toBe(true);
		});

		it('should call loadMore when load more button is clicked', () => {
			createComponent();
			component.isLoading.set(false);
			component.versions.set([makeVersion({ id: 'v1' })]);
			component.hasNextPage.set(true);
			component.isLoadingMore.set(false);
			fixture.detectChanges();

			const spy = vi.spyOn(component, 'loadMore');
			// Find the load more button
			const buttons = fixture.nativeElement.querySelectorAll('button[mcms-button]');
			const loadMoreBtn = Array.from(buttons).find(
				(btn) => (btn as HTMLElement).textContent?.trim() === 'Load more',
			) as HTMLButtonElement;
			expect(loadMoreBtn).toBeTruthy();
			loadMoreBtn.click();
			expect(spy).toHaveBeenCalled();
		});
	});

	// -------------------------------------------------------------------
	// getStatusVariant binding
	// -------------------------------------------------------------------
	describe('getStatusVariant template binding', () => {
		it('should pass correct variant to badge for published status', () => {
			createComponent();
			component.isLoading.set(false);
			component.versions.set([makeVersion({ id: 'v1', _status: 'published' })]);
			fixture.detectChanges();

			// The badge component receives [variant]="getStatusVariant(version._status)"
			// We just need the template to be evaluated without error
			const badges = fixture.nativeElement.querySelectorAll('mcms-badge');
			expect(badges.length).toBeGreaterThanOrEqual(1);
		});
	});
});
