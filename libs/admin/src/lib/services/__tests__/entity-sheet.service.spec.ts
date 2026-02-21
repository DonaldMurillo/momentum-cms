import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import {
	EntitySheetService,
	SHEET_QUERY_PARAMS,
	type EntitySheetResult,
} from '../entity-sheet.service';

describe('EntitySheetService', () => {
	let service: EntitySheetService;
	let router: Router;
	let navigateSpy: ReturnType<typeof vi.spyOn>;

	const TEST_UUID = '00000000-0000-0000-0000-000000000001';

	beforeEach(() => {
		vi.useFakeTimers();
		vi.spyOn(crypto, 'randomUUID').mockReturnValue(
			TEST_UUID as `${string}-${string}-${string}-${string}-${string}`,
		);

		TestBed.configureTestingModule({
			providers: [provideRouter([]), EntitySheetService],
		});

		service = TestBed.inject(EntitySheetService);
		router = TestBed.inject(Router);
		navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	// ============================================
	// Fixtures
	// ============================================

	const mockResult: EntitySheetResult = {
		action: 'created',
		entity: { id: '42', title: 'New Post' },
		collection: 'posts',
	};

	// ============================================
	// Signal Defaults
	// ============================================

	describe('signal defaults', () => {
		it('isOpen should default to false', () => {
			expect(service.isOpen()).toBe(false);
		});

		it('isClosing should default to false', () => {
			expect(service.isClosing()).toBe(false);
		});

		it('isVisible should be false when not open and not closing', () => {
			expect(service.isVisible()).toBe(false);
		});
	});

	// ============================================
	// openCreate
	// ============================================

	describe('openCreate', () => {
		it('should set isOpen to true', () => {
			service.openCreate('posts').subscribe();

			expect(service.isOpen()).toBe(true);
		});

		it('should update URL query params with collection, mode, and callback', () => {
			service.openCreate('posts').subscribe();

			expect(navigateSpy).toHaveBeenCalledWith([], {
				queryParams: {
					[SHEET_QUERY_PARAMS.collection]: 'posts',
					[SHEET_QUERY_PARAMS.mode]: 'create',
					[SHEET_QUERY_PARAMS.callback]: TEST_UUID,
					[SHEET_QUERY_PARAMS.entityId]: null,
				},
				queryParamsHandling: 'merge',
			});
		});

		it('should return an observable', () => {
			const result$ = service.openCreate('posts');

			expect(result$).toBeDefined();
			expect(typeof result$.subscribe).toBe('function');
		});

		it('should set entityId to null in query params', () => {
			service.openCreate('authors').subscribe();

			expect(navigateSpy).toHaveBeenCalledWith(
				[],
				expect.objectContaining({
					queryParams: expect.objectContaining({
						[SHEET_QUERY_PARAMS.entityId]: null,
					}),
				}),
			);
		});
	});

	// ============================================
	// openEdit
	// ============================================

	describe('openEdit', () => {
		it('should set isOpen to true with edit mode', () => {
			service.openEdit('posts', '42').subscribe();

			expect(service.isOpen()).toBe(true);
			expect(navigateSpy).toHaveBeenCalledWith(
				[],
				expect.objectContaining({
					queryParams: expect.objectContaining({
						[SHEET_QUERY_PARAMS.mode]: 'edit',
					}),
				}),
			);
		});

		it('should include entityId in query params', () => {
			service.openEdit('posts', '42').subscribe();

			expect(navigateSpy).toHaveBeenCalledWith(
				[],
				expect.objectContaining({
					queryParams: expect.objectContaining({
						[SHEET_QUERY_PARAMS.entityId]: '42',
						[SHEET_QUERY_PARAMS.collection]: 'posts',
					}),
				}),
			);
		});
	});

	// ============================================
	// openView
	// ============================================

	describe('openView', () => {
		it('should set isOpen to true with view mode', () => {
			service.openView('posts', '99').subscribe();

			expect(service.isOpen()).toBe(true);
			expect(navigateSpy).toHaveBeenCalledWith(
				[],
				expect.objectContaining({
					queryParams: expect.objectContaining({
						[SHEET_QUERY_PARAMS.mode]: 'view',
						[SHEET_QUERY_PARAMS.entityId]: '99',
						[SHEET_QUERY_PARAMS.collection]: 'posts',
					}),
				}),
			);
		});
	});

	// ============================================
	// close
	// ============================================

	describe('close', () => {
		it('should set isClosing to true', () => {
			service.openCreate('posts').subscribe();
			service.close();

			expect(service.isClosing()).toBe(true);
		});

		it('should set isOpen to false after animation delay', () => {
			service.openCreate('posts').subscribe();

			expect(service.isOpen()).toBe(true);

			service.close();

			// During animation, isOpen is still true
			expect(service.isOpen()).toBe(true);
			expect(service.isClosing()).toBe(true);

			vi.advanceTimersByTime(200);

			expect(service.isOpen()).toBe(false);
			expect(service.isClosing()).toBe(false);
		});

		it('should remove query params from URL after animation', () => {
			service.openCreate('posts').subscribe();
			navigateSpy.mockClear();

			service.close();
			vi.advanceTimersByTime(200);

			expect(navigateSpy).toHaveBeenCalledWith([], {
				queryParams: {
					[SHEET_QUERY_PARAMS.collection]: null,
					[SHEET_QUERY_PARAMS.entityId]: null,
					[SHEET_QUERY_PARAMS.mode]: null,
					[SHEET_QUERY_PARAMS.callback]: null,
				},
				queryParamsHandling: 'merge',
			});
		});

		it('should complete pending callback when closing without result', () => {
			// Set up the URL so getCurrentCallbackId returns our test UUID
			vi.spyOn(router, 'parseUrl').mockReturnValue({
				queryParams: { [SHEET_QUERY_PARAMS.callback]: TEST_UUID },
			} as ReturnType<Router['parseUrl']>);

			let completed = false;
			service.openCreate('posts').subscribe({
				complete: () => {
					completed = true;
				},
			});

			service.close();
			vi.advanceTimersByTime(200);

			expect(completed).toBe(true);
		});

		it('should emit result through callback observable', () => {
			vi.spyOn(router, 'parseUrl').mockReturnValue({
				queryParams: { [SHEET_QUERY_PARAMS.callback]: TEST_UUID },
			} as ReturnType<Router['parseUrl']>);

			let received: EntitySheetResult | undefined;
			service.openCreate('posts').subscribe((result) => {
				received = result;
			});

			service.close(mockResult);
			vi.advanceTimersByTime(200);

			expect(received).toEqual(mockResult);
		});

		it('should not emit if close is called without result', () => {
			vi.spyOn(router, 'parseUrl').mockReturnValue({
				queryParams: { [SHEET_QUERY_PARAMS.callback]: TEST_UUID },
			} as ReturnType<Router['parseUrl']>);

			let received: EntitySheetResult | undefined;
			service.openCreate('posts').subscribe((result) => {
				received = result;
			});

			service.close();
			vi.advanceTimersByTime(200);

			expect(received).toBeUndefined();
		});

		it('should be a no-op if already closing', () => {
			service.openCreate('posts').subscribe();
			service.close();

			expect(service.isClosing()).toBe(true);

			// Second close should be a no-op
			service.close();

			vi.advanceTimersByTime(200);

			// Should still properly finish the first close
			expect(service.isOpen()).toBe(false);
			expect(service.isClosing()).toBe(false);
		});

		it('should be a no-op if not open', () => {
			service.close();

			expect(service.isClosing()).toBe(false);
			expect(service.isOpen()).toBe(false);
			expect(navigateSpy).not.toHaveBeenCalled();
		});
	});

	// ============================================
	// isVisible
	// ============================================

	describe('isVisible', () => {
		it('should be true when open', () => {
			service.openCreate('posts').subscribe();

			expect(service.isVisible()).toBe(true);
		});

		it('should be true when closing (animation in progress)', () => {
			service.openCreate('posts').subscribe();
			service.close();

			// isOpen is still true + isClosing is true
			expect(service.isVisible()).toBe(true);
		});

		it('should be false when fully closed', () => {
			service.openCreate('posts').subscribe();
			service.close();
			vi.advanceTimersByTime(200);

			expect(service.isVisible()).toBe(false);
		});
	});

	// ============================================
	// State Transitions
	// ============================================

	describe('state transitions', () => {
		it('should handle rapid open/close', () => {
			service.openCreate('posts').subscribe();
			service.close();

			// isClosing is true, animation in progress
			expect(service.isClosing()).toBe(true);

			// Before the animation finishes, open again
			service.openCreate('authors').subscribe();

			// Should cancel close animation and be open
			expect(service.isClosing()).toBe(false);
			expect(service.isOpen()).toBe(true);

			vi.advanceTimersByTime(200);

			// After the original timer would have fired, we should still be open
			expect(service.isOpen()).toBe(true);
		});

		it('should cancel close animation on new open', () => {
			service.openCreate('posts').subscribe();
			service.close();

			expect(service.isClosing()).toBe(true);

			// New open should cancel the close
			service.openEdit('posts', '55').subscribe();

			expect(service.isClosing()).toBe(false);
			expect(service.isOpen()).toBe(true);

			// The delayed close callback should not run
			vi.advanceTimersByTime(200);

			expect(service.isOpen()).toBe(true);
			expect(service.isClosing()).toBe(false);
		});

		it('should complete previous callback when opening a new sheet', () => {
			vi.spyOn(router, 'parseUrl').mockReturnValue({
				queryParams: { [SHEET_QUERY_PARAMS.callback]: TEST_UUID },
			} as ReturnType<Router['parseUrl']>);

			let firstCompleted = false;
			service.openCreate('posts').subscribe({
				complete: () => {
					firstCompleted = true;
				},
			});

			// Opening a second sheet should complete the first callback
			service.openCreate('authors').subscribe();

			expect(firstCompleted).toBe(true);
		});
	});

	// ============================================
	// Focus Management
	// ============================================

	describe('focus management', () => {
		it('should restore focus to trigger element after close', () => {
			const doc = TestBed.inject(DOCUMENT);
			const triggerButton = doc.createElement('button');
			doc.body.appendChild(triggerButton);
			triggerButton.focus();

			const focusSpy = vi.spyOn(triggerButton, 'focus');

			service.openCreate('posts').subscribe();
			service.close();

			// Advance past the close animation (200ms), which queues a nested setTimeout(0) for focus
			vi.advanceTimersByTime(200);

			// Flush the nested setTimeout(0) that restoreFocus schedules
			vi.advanceTimersByTime(1);

			expect(focusSpy).toHaveBeenCalled();

			// Cleanup
			doc.body.removeChild(triggerButton);
		});

		it('should not throw if trigger element is not an HTMLElement', () => {
			// When document.activeElement is null (e.g., no focused element)
			service.openCreate('posts').subscribe();
			service.close();

			expect(() => vi.advanceTimersByTime(200)).not.toThrow();
		});
	});

	// ============================================
	// initFromQueryParams
	// ============================================

	describe('initFromQueryParams', () => {
		it('should open the sheet if URL contains sheet collection param', () => {
			vi.spyOn(router, 'parseUrl').mockReturnValue({
				queryParams: {
					[SHEET_QUERY_PARAMS.collection]: 'posts',
					[SHEET_QUERY_PARAMS.mode]: 'create',
				},
			} as ReturnType<Router['parseUrl']>);
			Object.defineProperty(router, 'url', {
				value: '/?sheetCollection=posts&sheetMode=create',
				configurable: true,
			});

			service.initFromQueryParams();

			expect(service.isOpen()).toBe(true);
		});

		it('should not open if URL has no sheet params', () => {
			vi.spyOn(router, 'parseUrl').mockReturnValue({
				queryParams: {},
			} as ReturnType<Router['parseUrl']>);
			Object.defineProperty(router, 'url', { value: '/', configurable: true });

			service.initFromQueryParams();

			expect(service.isOpen()).toBe(false);
		});

		it('should close sheet when URL loses sheet params (e.g., browser back)', () => {
			// First, open the sheet
			service.openCreate('posts').subscribe();
			expect(service.isOpen()).toBe(true);

			// Now simulate URL losing sheet params via parseUrl
			vi.spyOn(router, 'parseUrl').mockReturnValue({
				queryParams: {},
			} as ReturnType<Router['parseUrl']>);
			Object.defineProperty(router, 'url', { value: '/', configurable: true });

			service.initFromQueryParams();

			// Should immediately close without animation (browser back is not animated)
			expect(service.isOpen()).toBe(false);
		});

		it('should not reopen during close animation', () => {
			// Open sheet
			service.openCreate('posts').subscribe();
			expect(service.isOpen()).toBe(true);

			// Start closing
			service.close();
			expect(service.isClosing()).toBe(true);

			// Simulate URL still having sheet params (delayed NavigationEnd)
			vi.spyOn(router, 'parseUrl').mockReturnValue({
				queryParams: {
					[SHEET_QUERY_PARAMS.collection]: 'posts',
				},
			} as ReturnType<Router['parseUrl']>);

			// This should NOT reopen the sheet because isClosing() is true
			service.initFromQueryParams();

			// isOpen should still be true (hasn't finished closing yet), but isClosing should also be true
			expect(service.isClosing()).toBe(true);

			vi.advanceTimersByTime(200);

			expect(service.isOpen()).toBe(false);
			expect(service.isClosing()).toBe(false);
		});
	});
});
