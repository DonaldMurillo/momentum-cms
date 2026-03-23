import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { DIALOG_DATA } from '@momentumcms/ui';
import {
	VersionDiffDialogComponent,
	type VersionDiffDialogData,
} from '../version-diff-dialog.component';
import { VersionService } from '../../../services/version.service';
import { vi } from 'vitest';
import type { DeepDiffResult } from '@momentumcms/core';

class MockVersionService {
	compareVersions = vi.fn();
}

describe('VersionDiffDialogComponent', () => {
	let component: VersionDiffDialogComponent;
	let mockVersionService: MockVersionService;

	const dialogData: VersionDiffDialogData = {
		collection: 'posts',
		documentId: 'doc-1',
		versionId1: 'v1',
		versionId2: 'v2',
		label1: 'Version 1',
		label2: 'Version 2',
		versions: [
			{
				id: 'v3',
				parent: 'doc-1',
				version: {},
				_status: 'published',
				autosave: false,
				createdAt: '2024-01-03T00:00:00Z',
				updatedAt: '2024-01-03T00:00:00Z',
			},
			{
				id: 'v2',
				parent: 'doc-1',
				version: {},
				_status: 'published',
				autosave: false,
				createdAt: '2024-01-02T00:00:00Z',
				updatedAt: '2024-01-02T00:00:00Z',
			},
			{
				id: 'v1',
				parent: 'doc-1',
				version: {},
				_status: 'draft',
				autosave: false,
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z',
			},
		],
	};

	beforeEach(async () => {
		mockVersionService = new MockVersionService();
		mockVersionService.compareVersions.mockResolvedValue([]);

		await TestBed.configureTestingModule({
			imports: [VersionDiffDialogComponent],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: DIALOG_DATA, useValue: dialogData },
				{ provide: VersionService, useValue: mockVersionService },
			],
		}).compileComponents();

		const fixture = TestBed.createComponent(VersionDiffDialogComponent);
		component = fixture.componentInstance;
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should have correct dialog data', () => {
		expect(component.data.collection).toBe('posts');
		expect(component.data.label1).toBe('Version 1');
		expect(component.data.label2).toBe('Version 2');
		expect(component.data.versions).toHaveLength(3);
	});

	it('should initialize with correct version selections', () => {
		expect(component.selectedVersion1()).toBe('v1');
		expect(component.selectedVersion2()).toBe('v2');
	});

	it('should default to inline view mode', () => {
		expect(component.viewMode()).toBe('inline');
	});

	it('should default to show only changes', () => {
		expect(component.showOnlyChanges()).toBe(true);
	});

	it('should load differences on construction', async () => {
		const diffs: DeepDiffResult[] = [
			{
				field: 'title',
				changeType: 'changed',
				oldValue: 'Old',
				newValue: 'New',
				fieldType: 'text',
			},
			{ field: 'content', changeType: 'unchanged', fieldType: 'textarea' },
		];
		mockVersionService.compareVersions.mockResolvedValue(diffs);

		const fixture = TestBed.createComponent(VersionDiffDialogComponent);
		const comp = fixture.componentInstance;

		await vi.waitFor(() => {
			expect(comp.isLoading()).toBe(false);
		});

		expect(comp.differences()).toEqual(diffs);
		expect(comp.error()).toBeNull();
	});

	it('should compute summary counts', async () => {
		const diffs: DeepDiffResult[] = [
			{ field: 'title', changeType: 'changed' },
			{ field: 'status', changeType: 'added' },
			{ field: 'old_field', changeType: 'removed' },
			{ field: 'same', changeType: 'unchanged' },
		];
		mockVersionService.compareVersions.mockResolvedValue(diffs);

		const fixture = TestBed.createComponent(VersionDiffDialogComponent);
		const comp = fixture.componentInstance;

		await vi.waitFor(() => {
			expect(comp.isLoading()).toBe(false);
		});

		expect(comp.summary()).toEqual({ added: 1, removed: 1, changed: 1 });
	});

	it('should filter unchanged diffs when showOnlyChanges is true', async () => {
		const diffs: DeepDiffResult[] = [
			{ field: 'title', changeType: 'changed' },
			{ field: 'content', changeType: 'unchanged' },
		];
		mockVersionService.compareVersions.mockResolvedValue(diffs);

		const fixture = TestBed.createComponent(VersionDiffDialogComponent);
		const comp = fixture.componentInstance;

		await vi.waitFor(() => {
			expect(comp.isLoading()).toBe(false);
		});

		expect(comp.visibleDiffs()).toHaveLength(1);
		expect(comp.visibleDiffs()[0].field).toBe('title');

		comp.showOnlyChanges.set(false);
		expect(comp.visibleDiffs()).toHaveLength(2);
	});

	it('should handle error when loading differences fails', async () => {
		mockVersionService.compareVersions.mockRejectedValue(new Error('Network error'));

		const fixture = TestBed.createComponent(VersionDiffDialogComponent);
		const comp = fixture.componentInstance;

		await vi.waitFor(() => {
			expect(comp.isLoading()).toBe(false);
		});

		expect(comp.error()).toBe('Failed to compare versions');
		expect(comp.differences()).toEqual([]);
	});

	it('should swap version selections', () => {
		component.swap();
		expect(component.selectedVersion1()).toBe('v2');
		expect(component.selectedVersion2()).toBe('v1');
	});

	it('should toggle view mode', () => {
		component.viewMode.set('side-by-side');
		expect(component.viewMode()).toBe('side-by-side');
		component.viewMode.set('inline');
		expect(component.viewMode()).toBe('inline');
	});

	it('goPrev should shift both version selections to previous indices', () => {
		// Initial: selectedVersion1='v1' (index 2), selectedVersion2='v2' (index 1)
		component.goPrev();
		// Both shift down by 1: index 2->1 = 'v2', index 1->0 = 'v3'
		expect(component.selectedVersion1()).toBe('v2');
		expect(component.selectedVersion2()).toBe('v3');
	});

	it('goPrev should navigate to "current" when at the first version entries', () => {
		// v3 (index 0), v2 (index 1) — goPrev shifts to (current, v3)
		component.selectedVersion1.set('v3');
		component.selectedVersion2.set('v2');
		component.goPrev();
		expect(component.selectedVersion1()).toBe('current');
		expect(component.selectedVersion2()).toBe('v3');
	});

	it('goPrev should not change when one selection is "current"', () => {
		component.selectedVersion1.set('current');
		component.selectedVersion2.set('v3');
		component.goPrev();
		expect(component.selectedVersion1()).toBe('current');
		expect(component.selectedVersion2()).toBe('v3');
	});

	it('goNext should shift both version selections to next indices', () => {
		component.selectedVersion1.set('v3');
		component.selectedVersion2.set('v2');
		component.goNext();
		expect(component.selectedVersion1()).toBe('v2');
		expect(component.selectedVersion2()).toBe('v1');
	});

	it('goNext should not change selections when already at the end', () => {
		// v1 (index 2) is the last version, so goNext guard fails
		component.selectedVersion1.set('v1');
		component.selectedVersion2.set('v2');
		component.goNext();
		expect(component.selectedVersion1()).toBe('v1');
		expect(component.selectedVersion2()).toBe('v2');
	});

	it('canGoPrev should return true when both selections are in the versions list', () => {
		// v1 (index 2), v2 (index 1) — both >= 0
		expect(component.canGoPrev()).toBe(true);
	});

	it('canGoPrev should return false when a selection is "current"', () => {
		component.selectedVersion2.set('current');
		expect(component.canGoPrev()).toBe(false);
	});

	it('canGoNext should return true when neither is at the last version', () => {
		component.selectedVersion1.set('v3'); // index 0
		component.selectedVersion2.set('v2'); // index 1
		expect(component.canGoNext()).toBe(true);
	});

	it('canGoNext should return false when a selection is at the last version', () => {
		// v1 is at index 2 (last), max is 2, 2 < 2 is false
		component.selectedVersion1.set('v1');
		expect(component.canGoNext()).toBe(false);
	});

	it('canGoNext should return false when version1 is at the last index', () => {
		// Initial: version1='v1' (index 2), versions.length - 2 = 1, 2 < 1 is false
		expect(component.canGoNext()).toBe(false);
	});

	it('canGoNext should return false when version2 is at the last index', () => {
		// version1='v3' (index 0) passes idx1 < 1, but version2='v1' (index 2) fails idx2 < 2
		component.selectedVersion1.set('v3');
		component.selectedVersion2.set('v1');
		expect(component.canGoNext()).toBe(false);
	});

	it('onVersion1Change should update selectedVersion1 from select event', () => {
		const selectEl = document.createElement('select');
		const option = document.createElement('option');
		option.value = 'v3';
		selectEl.appendChild(option);
		selectEl.value = 'v3';
		const realEvent = new Event('change');
		Object.defineProperty(realEvent, 'target', { value: selectEl });

		component.onVersion1Change(realEvent);
		expect(component.selectedVersion1()).toBe('v3');
	});

	it('onVersion2Change should update selectedVersion2 from select event', () => {
		const selectEl = document.createElement('select');
		const option = document.createElement('option');
		option.value = 'v1';
		selectEl.appendChild(option);
		selectEl.value = 'v1';
		const realEvent = new Event('change');
		Object.defineProperty(realEvent, 'target', { value: selectEl });

		component.onVersion2Change(realEvent);
		expect(component.selectedVersion2()).toBe('v1');
	});

	it('onVersion1Change should not update when target is not a select element', () => {
		const divEl = document.createElement('div');
		const event = new Event('change');
		Object.defineProperty(event, 'target', { value: divEl });

		component.onVersion1Change(event);
		expect(component.selectedVersion1()).toBe('v1');
	});

	it('onVersion2Change should not update when target is not a select element', () => {
		const divEl = document.createElement('div');
		const event = new Event('change');
		Object.defineProperty(event, 'target', { value: divEl });

		component.onVersion2Change(event);
		expect(component.selectedVersion2()).toBe('v2');
	});

	it('should discard stale responses when version selection changes rapidly', async () => {
		// Wait for initial load
		await vi.waitFor(() => {
			expect(component.isLoading()).toBe(false);
		});

		mockVersionService.compareVersions.mockClear();

		// Simulate two rapid changes. The first resolves AFTER the second.
		const staleDiffs: DeepDiffResult[] = [{ field: 'stale', changeType: 'changed' }];
		const freshDiffs: DeepDiffResult[] = [{ field: 'fresh', changeType: 'added' }];

		let resolveStale!: (v: DeepDiffResult[]) => void;
		const stalePromise = new Promise<DeepDiffResult[]>((r) => (resolveStale = r));

		let resolveFresh!: (v: DeepDiffResult[]) => void;
		const freshPromise = new Promise<DeepDiffResult[]>((r) => (resolveFresh = r));

		mockVersionService.compareVersions
			.mockReturnValueOnce(stalePromise)
			.mockReturnValueOnce(freshPromise);

		// First change triggers request #1
		component.selectedVersion1.set('v3');

		// Wait for the effect to fire
		await vi.waitFor(() => {
			expect(mockVersionService.compareVersions).toHaveBeenCalledTimes(1);
		});

		// Second change triggers request #2 (before #1 resolves)
		component.selectedVersion1.set('v2');

		await vi.waitFor(() => {
			expect(mockVersionService.compareVersions).toHaveBeenCalledTimes(2);
		});

		// Resolve #2 (fresh) first, then #1 (stale)
		resolveFresh(freshDiffs);
		await vi.waitFor(() => {
			expect(component.differences()).toEqual(freshDiffs);
		});

		// Now resolve #1 (stale) — it should be discarded
		resolveStale(staleDiffs);

		// Give a tick for the stale promise to settle
		await new Promise((r) => setTimeout(r, 10));

		// Differences should still be freshDiffs, NOT staleDiffs
		expect(component.differences()).toEqual(freshDiffs);
		expect(component.isLoading()).toBe(false);
	});

	it('should have proper ARIA tab pattern with aria-controls and tabindex', async () => {
		const diffs: DeepDiffResult[] = [
			{ field: 'title', changeType: 'changed', oldValue: 'Old', newValue: 'New' },
		];
		mockVersionService.compareVersions.mockResolvedValue(diffs);

		const fixture = TestBed.createComponent(VersionDiffDialogComponent);
		fixture.detectChanges();

		await vi.waitFor(() => {
			expect(fixture.componentInstance.isLoading()).toBe(false);
		});
		fixture.detectChanges();

		const el = fixture.nativeElement;

		// Tabs should have aria-controls pointing to the panel
		const inlineTab = el.querySelector('[data-testid="tab-inline"]');
		const sideBySideTab = el.querySelector('[data-testid="tab-side-by-side"]');
		expect(inlineTab).toBeTruthy();
		expect(sideBySideTab).toBeTruthy();
		expect(inlineTab.getAttribute('aria-controls')).toBe('diff-tabpanel');
		expect(sideBySideTab.getAttribute('aria-controls')).toBe('diff-tabpanel');

		// Active tab should have tabindex=0, inactive tabindex=-1
		expect(inlineTab.getAttribute('tabindex')).toBe('0');
		expect(sideBySideTab.getAttribute('tabindex')).toBe('-1');

		// Panel should have role=tabpanel and correct id
		const panel = el.querySelector('[role="tabpanel"]');
		expect(panel).toBeTruthy();
		expect(panel.getAttribute('id')).toBe('diff-tabpanel');
		expect(panel.getAttribute('aria-labelledby')).toBeTruthy();
	});

	it('version change should trigger re-compare via effect', async () => {
		// Wait for initial load
		await vi.waitFor(() => {
			expect(component.isLoading()).toBe(false);
		});

		mockVersionService.compareVersions.mockClear();
		const newDiffs: DeepDiffResult[] = [
			{ field: 'title', changeType: 'added', newValue: 'New Title', fieldType: 'text' },
		];
		mockVersionService.compareVersions.mockResolvedValue(newDiffs);

		// Change version selection to trigger the effect
		component.selectedVersion1.set('v3');

		await vi.waitFor(() => {
			expect(mockVersionService.compareVersions).toHaveBeenCalledWith('posts', 'doc-1', 'v3', 'v2');
		});

		await vi.waitFor(() => {
			expect(component.isLoading()).toBe(false);
		});

		expect(component.differences()).toEqual(newDiffs);
	});
});
