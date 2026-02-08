import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Observable, Subject, take } from 'rxjs';
import type { Entity } from '../widgets/widget.types';

/**
 * Result emitted when the entity sheet closes.
 */
export interface EntitySheetResult {
	/** What happened in the sheet */
	action: 'created' | 'updated' | 'cancelled';
	/** The entity that was created or updated (undefined on cancel) */
	entity?: Entity;
	/** The collection slug */
	collection: string;
}

/** Query parameter keys used by the entity sheet */
export const SHEET_QUERY_PARAMS = {
	collection: 'sheetCollection',
	entityId: 'sheetEntityId',
	mode: 'sheetMode',
	callback: 'sheetCallback',
};

/** Duration of the close animation in milliseconds (must match CSS) */
const CLOSE_ANIMATION_MS = 200;

/**
 * Service for opening/closing the entity sheet via query parameters.
 *
 * The sheet is rendered directly in the AdminShell (no named router outlet).
 * Query parameters carry the state: `sheetCollection`, `sheetEntityId`, `sheetMode`, `sheetCallback`.
 * This approach keeps the URL clean and SSR-friendly (no auxiliary route parentheses).
 *
 * Usage:
 * ```typescript
 * const sheetService = inject(EntitySheetService);
 *
 * sheetService.openCreate('authors').subscribe((result) => {
 *   if (result.action === 'created') {
 *     console.log('Created:', result.entity);
 *   }
 * });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class EntitySheetService {
	private readonly router = inject(Router);
	private readonly destroyRef = inject(DestroyRef);
	private readonly document = inject(DOCUMENT);

	/** Pending callback subjects keyed by callback ID */
	private readonly pendingCallbacks = new Map<string, Subject<EntitySheetResult>>();

	/** Handle for the close animation timer (for cancellation on rapid open/close) */
	private closeTimerId: ReturnType<typeof setTimeout> | null = null;

	/** Element that had focus when the sheet was opened (for focus restoration) */
	private triggerElement: Element | null = null;

	/** Whether the sheet is currently open */
	readonly isOpen = signal(false);

	/** Whether the sheet is playing its close animation */
	readonly isClosing = signal(false);

	/** Whether the sheet DOM should be present (open or animating closed) */
	readonly isVisible = computed(() => this.isOpen() || this.isClosing());

	/**
	 * Open the entity sheet to create a new entity.
	 */
	openCreate(collection: string): Observable<EntitySheetResult> {
		return this.openSheet(collection, undefined, 'create');
	}

	/**
	 * Open the entity sheet to edit an existing entity.
	 */
	openEdit(collection: string, entityId: string): Observable<EntitySheetResult> {
		return this.openSheet(collection, entityId, 'edit');
	}

	/**
	 * Open the entity sheet to view an existing entity.
	 */
	openView(collection: string, entityId: string): Observable<EntitySheetResult> {
		return this.openSheet(collection, entityId, 'view');
	}

	/**
	 * Close the sheet with a slide-out animation, then emit the result to any pending callback.
	 */
	close(result?: EntitySheetResult): void {
		if (this.isClosing() || !this.isOpen()) return;

		// Resolve pending callback immediately
		const callbackId = this.getCurrentCallbackId();
		if (callbackId) {
			const subject = this.pendingCallbacks.get(callbackId);
			if (subject) {
				if (result) {
					subject.next(result);
				}
				subject.complete();
				this.pendingCallbacks.delete(callbackId);
			}
		}

		// Start close animation
		this.isClosing.set(true);

		this.closeTimerId = setTimeout(() => {
			this.closeTimerId = null;
			this.isOpen.set(false);
			this.isClosing.set(false);
			this.restoreFocus();

			// Clear sheet query params after animation completes
			this.router.navigate([], {
				queryParams: {
					[SHEET_QUERY_PARAMS.collection]: null,
					[SHEET_QUERY_PARAMS.entityId]: null,
					[SHEET_QUERY_PARAMS.mode]: null,
					[SHEET_QUERY_PARAMS.callback]: null,
				},
				queryParamsHandling: 'merge',
			});
		}, CLOSE_ANIMATION_MS);
	}

	/**
	 * Restore sheet state from query params and sync on navigation.
	 * Handles page refresh and browser back/forward.
	 * Called by AdminShellComponent on browser init.
	 */
	initFromQueryParams(): void {
		this.syncIsOpenFromUrl();

		// Keep isOpen in sync when URL changes (e.g., browser back button)
		this.router.events
			.pipe(
				filter((e) => e instanceof NavigationEnd),
				takeUntilDestroyed(this.destroyRef),
			)
			.subscribe(() => this.syncIsOpenFromUrl());
	}

	private syncIsOpenFromUrl(): void {
		const urlTree = this.router.parseUrl(this.router.url);
		const hasSheet = !!urlTree.queryParams[SHEET_QUERY_PARAMS.collection];

		if (hasSheet) {
			this.cancelCloseAnimation();
			this.isOpen.set(true);
		} else if (this.isOpen() && !this.isClosing()) {
			// URL lost sheet params (e.g., browser back button) — clean up and close immediately
			this.cleanupAllPendingCallbacks();
			this.isOpen.set(false);
			this.restoreFocus();
		}
	}

	private openSheet(
		collection: string,
		entityId: string | undefined,
		mode: 'view' | 'edit' | 'create',
	): Observable<EntitySheetResult> {
		// Cancel any in-progress close animation
		this.cancelCloseAnimation();

		// Capture the trigger element for focus restoration on close
		this.triggerElement = this.document.activeElement;

		const callbackId = crypto.randomUUID();
		const subject = new Subject<EntitySheetResult>();
		this.pendingCallbacks.set(callbackId, subject);

		this.isOpen.set(true);

		this.router.navigate([], {
			queryParams: {
				[SHEET_QUERY_PARAMS.collection]: collection,
				[SHEET_QUERY_PARAMS.mode]: mode,
				[SHEET_QUERY_PARAMS.callback]: callbackId,
				[SHEET_QUERY_PARAMS.entityId]: entityId ?? null,
			},
			queryParamsHandling: 'merge',
		});

		return subject.asObservable().pipe(take(1));
	}

	private cancelCloseAnimation(): void {
		if (this.closeTimerId !== null) {
			clearTimeout(this.closeTimerId);
			this.closeTimerId = null;
			this.isClosing.set(false);
		}
	}

	/** Complete and remove all pending callback subjects (prevents memory leaks) */
	private cleanupAllPendingCallbacks(): void {
		for (const [, subject] of this.pendingCallbacks) {
			subject.complete();
		}
		this.pendingCallbacks.clear();
	}

	/** Return focus to the element that triggered the sheet open */
	private restoreFocus(): void {
		const el = this.triggerElement;
		this.triggerElement = null;
		if (el instanceof HTMLElement) {
			setTimeout(() => el.focus());
		}
	}

	private getCurrentCallbackId(): string | null {
		const urlTree = this.router.parseUrl(this.router.url);
		const callbackParam = urlTree.queryParams[SHEET_QUERY_PARAMS.callback];
		if (typeof callbackParam === 'string') return callbackParam;
		return null;
	}
}
