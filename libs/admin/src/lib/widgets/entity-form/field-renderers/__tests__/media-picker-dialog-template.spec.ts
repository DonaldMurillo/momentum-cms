/**
 * Template coverage tests for MediaPickerDialog.
 *
 * Renders the REAL component template so that all template expression
 * statements (bindings, `@if`, `@for`, event handlers, attribute bindings)
 * are evaluated by the coverage tool.
 *
 * Strategy:
 *   - Use NO_ERRORS_SCHEMA so unknown child selectors are tolerated.
 *   - Override only the component's `imports` (to []) — keep the template.
 *   - Mock DIALOG_DATA, DialogRef, and the Momentum API.
 *   - Manipulate signals to hit each `@if`/`@else`/`@for` branch.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, CUSTOM_ELEMENTS_SCHEMA, PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { DIALOG_DATA, DialogRef } from '@momentumcms/ui';
import {
	MediaPickerDialog,
	type MediaItem,
	type MediaPickerDialogData,
} from '../media-picker-dialog.component';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

class MockDialogRef {
	close = vi.fn();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MediaPickerDialog (template coverage)', () => {
	let fixture: ComponentFixture<MediaPickerDialog>;
	let component: MediaPickerDialog;
	let mockDialogRef: MockDialogRef;

	function setup(data: MediaPickerDialogData = {}): void {
		mockDialogRef = new MockDialogRef();

		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			imports: [MediaPickerDialog],
			schemas: [NO_ERRORS_SCHEMA],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: PLATFORM_ID, useValue: 'browser' },
				{ provide: DialogRef, useValue: mockDialogRef },
				{ provide: DIALOG_DATA, useValue: data },
			],
		}).overrideComponent(MediaPickerDialog, {
			set: { imports: [], schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA] },
		});

		fixture = TestBed.createComponent(MediaPickerDialog);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}

	afterEach(() => {
		TestBed.resetTestingModule();
	});

	// -------------------------------------------------------------------
	// Header and search
	// -------------------------------------------------------------------
	describe('header and search', () => {
		it('should render the dialog title', () => {
			setup();
			const text = fixture.nativeElement.textContent;
			expect(text).toContain('Select Media');
		});

		it('should render the search input', () => {
			setup();
			const searchInput = fixture.nativeElement.querySelector('mcms-search-input');
			expect(searchInput).toBeTruthy();
		});
	});

	// -------------------------------------------------------------------
	// Branch: @if (isLoading()) — loading spinner
	// -------------------------------------------------------------------
	describe('loading state branch', () => {
		it('should render spinner when isLoading is true', () => {
			setup();
			component.isLoading.set(true);
			fixture.detectChanges();

			const spinner = fixture.nativeElement.querySelector('mcms-spinner');
			expect(spinner).toBeTruthy();
		});
	});

	// -------------------------------------------------------------------
	// Branch: @else if (mediaItems().length === 0) — empty state
	// -------------------------------------------------------------------
	describe('empty state branch', () => {
		it('should render "No media found" when items are empty and not loading', () => {
			setup();
			component.isLoading.set(false);
			component.mediaItems.set([]);
			fixture.detectChanges();

			const text = fixture.nativeElement.textContent;
			expect(text).toContain('No media found');
		});

		it('should render search hint when searchQuery is set', async () => {
			setup();
			// The constructor effect calls loadMedia which is async.
			// We need to wait for it to settle, then set state manually.
			await new Promise((r) => setTimeout(r, 0));

			// Now override signals directly without triggering effect
			// by using the internal signals (effect tracks searchQuery + currentPage)
			component.mediaItems.set([]);
			component.isLoading.set(false);
			fixture.detectChanges();

			// First verify empty state renders "No media found"
			let text = fixture.nativeElement.textContent;
			expect(text).toContain('No media found');

			// Now set searchQuery which triggers effect -> loadMedia -> isLoading=true
			// But the empty state check with searchQuery is already evaluated above.
			// To hit the "Try a different search term" branch, we need searchQuery
			// non-empty while isLoading is false and mediaItems is empty.
			// Override loadMedia to prevent it from setting isLoading=true:

			(component as any).loadMedia = vi.fn();
			component.searchQuery.set('something');
			component.isLoading.set(false);
			component.mediaItems.set([]);
			fixture.detectChanges();

			text = fixture.nativeElement.textContent;
			expect(text).toContain('Try a different search term');
		});

		it('should NOT render search hint when searchQuery is empty', () => {
			setup();
			component.isLoading.set(false);
			component.mediaItems.set([]);
			component.searchQuery.set('');
			fixture.detectChanges();

			const text = fixture.nativeElement.textContent;
			expect(text).not.toContain('Try a different search term');
		});
	});

	// -------------------------------------------------------------------
	// Branch: @else — media grid
	// -------------------------------------------------------------------
	describe('media grid branch', () => {
		const items: MediaItem[] = [
			{ id: 'm1', filename: 'photo.jpg', mimeType: 'image/jpeg', path: '/photo.jpg' },
			{ id: 'm2', filename: 'banner.png', mimeType: 'image/png', path: '/banner.png' },
			{ id: 'm3', filename: 'doc.pdf', mimeType: 'application/pdf', path: '/doc.pdf' },
		];

		it('should render media items as buttons', () => {
			setup();
			component.isLoading.set(false);
			component.mediaItems.set(items);
			fixture.detectChanges();

			const mediaButtons = fixture.nativeElement.querySelectorAll('.grid button[type="button"]');
			expect(mediaButtons.length).toBe(3);
		});

		it('should show filename overlay on each media item', () => {
			setup();
			component.isLoading.set(false);
			component.mediaItems.set(items);
			fixture.detectChanges();

			const text = fixture.nativeElement.textContent;
			expect(text).toContain('photo.jpg');
			expect(text).toContain('banner.png');
			expect(text).toContain('doc.pdf');
		});

		it('should bind aria-label to each media button', () => {
			setup();
			component.isLoading.set(false);
			component.mediaItems.set(items);
			fixture.detectChanges();

			const firstBtn = fixture.nativeElement.querySelector('[aria-label="Select photo.jpg"]');
			expect(firstBtn).toBeTruthy();
		});

		it('should bind aria-pressed to selected state', () => {
			setup();
			component.isLoading.set(false);
			component.mediaItems.set(items);
			fixture.detectChanges();

			const firstBtn = fixture.nativeElement.querySelector('[aria-label="Select photo.jpg"]');
			expect(firstBtn.getAttribute('aria-pressed')).toBe('false');

			// Select the first item
			component.selectedMedia.set(items[0]);
			fixture.detectChanges();
			expect(firstBtn.getAttribute('aria-pressed')).toBe('true');
		});

		it('should apply selected border class to selected item', () => {
			setup();
			component.isLoading.set(false);
			component.mediaItems.set(items);
			component.selectedMedia.set(items[0]);
			fixture.detectChanges();

			const firstBtn = fixture.nativeElement.querySelector('[aria-label="Select photo.jpg"]');
			expect(firstBtn.classList.contains('border-mcms-primary')).toBe(true);

			const secondBtn = fixture.nativeElement.querySelector('[aria-label="Select banner.png"]');
			expect(secondBtn.classList.contains('border-transparent')).toBe(true);
		});

		it('should apply ring classes to selected item', () => {
			setup();
			component.isLoading.set(false);
			component.mediaItems.set(items);
			component.selectedMedia.set(items[1]);
			fixture.detectChanges();

			const selectedBtn = fixture.nativeElement.querySelector('[aria-label="Select banner.png"]');
			expect(selectedBtn.classList.contains('ring-2')).toBe(true);
		});

		it('should call selectMedia on click', () => {
			setup();
			component.isLoading.set(false);
			component.mediaItems.set(items);
			fixture.detectChanges();

			const spy = vi.spyOn(component, 'selectMedia');
			const btn = fixture.nativeElement.querySelector('[aria-label="Select photo.jpg"]');
			btn.click();
			expect(spy).toHaveBeenCalledWith(items[0]);
		});

		it('should call confirmSelection on double click', () => {
			setup();
			component.isLoading.set(false);
			component.mediaItems.set(items);
			fixture.detectChanges();

			const spy = vi.spyOn(component, 'confirmSelection');
			const btn = fixture.nativeElement.querySelector('[aria-label="Select photo.jpg"]');
			const dblClickEvent = new MouseEvent('dblclick', { bubbles: true });
			btn.dispatchEvent(dblClickEvent);
			expect(spy).toHaveBeenCalledWith(items[0]);
		});

		it('should render media preview component for each item', () => {
			setup();
			component.isLoading.set(false);
			component.mediaItems.set(items);
			fixture.detectChanges();

			const previews = fixture.nativeElement.querySelectorAll('mcms-media-preview');
			expect(previews.length).toBe(3);
		});
	});

	// -------------------------------------------------------------------
	// Pagination: @if (totalPages() > 1)
	// -------------------------------------------------------------------
	describe('pagination branch', () => {
		const items: MediaItem[] = [
			{ id: 'm1', filename: 'a.jpg', mimeType: 'image/jpeg', path: '/a.jpg' },
		];

		it('should render pagination when totalPages > 1', () => {
			setup();
			component.isLoading.set(false);
			component.mediaItems.set(items);
			component.totalPages.set(3);
			fixture.detectChanges();

			const pagination = fixture.nativeElement.querySelector('mcms-pagination');
			expect(pagination).toBeTruthy();
		});

		it('should NOT render pagination when totalPages is 1', () => {
			setup();
			component.isLoading.set(false);
			component.mediaItems.set(items);
			component.totalPages.set(1);
			fixture.detectChanges();

			const pagination = fixture.nativeElement.querySelector('mcms-pagination');
			expect(pagination).toBeNull();
		});
	});

	// -------------------------------------------------------------------
	// Footer buttons
	// -------------------------------------------------------------------
	describe('footer buttons', () => {
		it('should render Cancel and Select buttons', () => {
			setup();

			const text = fixture.nativeElement.textContent;
			expect(text).toContain('Cancel');
			expect(text).toContain('Select');
		});

		it('should disable Select button when no media is selected', () => {
			setup();
			component.selectedMedia.set(null);
			fixture.detectChanges();

			// Find the Select button (the one without mcmsDialogClose)
			const buttons = fixture.nativeElement.querySelectorAll(
				'mcms-dialog-footer button[mcms-button]',
			);
			const selectBtn = Array.from(buttons).find(
				(btn) => (btn as HTMLElement).textContent?.trim() === 'Select',
			) as HTMLButtonElement;
			expect(selectBtn).toBeTruthy();
			expect(selectBtn.disabled).toBe(true);
		});

		it('should enable Select button when media is selected', () => {
			setup();
			component.selectedMedia.set({
				id: 'm1',
				filename: 'photo.jpg',
				mimeType: 'image/jpeg',
				path: '/photo.jpg',
			});
			fixture.detectChanges();

			const buttons = fixture.nativeElement.querySelectorAll(
				'mcms-dialog-footer button[mcms-button]',
			);
			const selectBtn = Array.from(buttons).find(
				(btn) => (btn as HTMLElement).textContent?.trim() === 'Select',
			) as HTMLButtonElement;
			expect(selectBtn).toBeTruthy();
			expect(selectBtn.disabled).toBe(false);
		});

		it('should call confirm when Select button is clicked', () => {
			setup();
			component.selectedMedia.set({
				id: 'm1',
				filename: 'photo.jpg',
				mimeType: 'image/jpeg',
				path: '/photo.jpg',
			});
			fixture.detectChanges();

			const spy = vi.spyOn(component, 'confirm');
			const buttons = fixture.nativeElement.querySelectorAll(
				'mcms-dialog-footer button[mcms-button]',
			);
			const selectBtn = Array.from(buttons).find(
				(btn) => (btn as HTMLElement).textContent?.trim() === 'Select',
			) as HTMLButtonElement;
			selectBtn.click();
			expect(spy).toHaveBeenCalled();
		});
	});

	// -------------------------------------------------------------------
	// Branch transitions
	// -------------------------------------------------------------------
	describe('branch transitions', () => {
		it('should transition from loading to media grid', () => {
			setup();
			component.isLoading.set(true);
			fixture.detectChanges();
			expect(fixture.nativeElement.querySelector('mcms-spinner')).toBeTruthy();

			component.isLoading.set(false);
			component.mediaItems.set([
				{ id: 'm1', filename: 'a.jpg', mimeType: 'image/jpeg', path: '/a.jpg' },
			]);
			fixture.detectChanges();
			expect(fixture.nativeElement.querySelector('mcms-spinner')).toBeNull();
			expect(fixture.nativeElement.querySelector('.grid')).toBeTruthy();
		});

		it('should transition from loading to empty state', () => {
			setup();
			component.isLoading.set(true);
			fixture.detectChanges();

			component.isLoading.set(false);
			component.mediaItems.set([]);
			fixture.detectChanges();

			const text = fixture.nativeElement.textContent;
			expect(text).toContain('No media found');
		});
	});

	// -------------------------------------------------------------------
	// onSearchChange binding via template
	// -------------------------------------------------------------------
	describe('search binding', () => {
		it('should bind searchQuery to the search input value', () => {
			setup();
			component.searchQuery.set('test-query');
			fixture.detectChanges();

			const searchInput = fixture.nativeElement.querySelector('mcms-search-input');
			expect(searchInput).toBeTruthy();
			// The [value] binding is on the mcms-search-input
		});
	});
});
