import { DestroyRef, inject, Injectable, signal } from '@angular/core';
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

	/** Pending callback subjects keyed by callback ID */
	private readonly pendingCallbacks = new Map<string, Subject<EntitySheetResult>>();

	/** Whether the sheet is currently open */
	readonly isOpen = signal(false);

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
	 * Close the sheet and emit the result to any pending callback.
	 */
	close(result?: EntitySheetResult): void {
		// Resolve pending callback
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

		this.isOpen.set(false);

		// Clear sheet query params
		this.router.navigate([], {
			queryParams: {
				sheetCollection: null,
				sheetEntityId: null,
				sheetMode: null,
				sheetCallback: null,
			},
			queryParamsHandling: 'merge',
		});
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
		const hasSheet = !!urlTree.queryParams['sheetCollection'];
		this.isOpen.set(hasSheet);
	}

	private openSheet(
		collection: string,
		entityId: string | undefined,
		mode: 'view' | 'edit' | 'create',
	): Observable<EntitySheetResult> {
		const callbackId = crypto.randomUUID();
		const subject = new Subject<EntitySheetResult>();
		this.pendingCallbacks.set(callbackId, subject);

		this.isOpen.set(true);

		this.router.navigate([], {
			queryParams: {
				sheetCollection: collection,
				sheetMode: mode,
				sheetCallback: callbackId,
				sheetEntityId: entityId ?? null,
			},
			queryParamsHandling: 'merge',
		});

		return subject.asObservable().pipe(take(1));
	}

	private getCurrentCallbackId(): string | null {
		const urlTree = this.router.parseUrl(this.router.url);
		const callbackParam = urlTree.queryParams['sheetCallback'];
		if (typeof callbackParam === 'string') return callbackParam;
		return null;
	}
}
