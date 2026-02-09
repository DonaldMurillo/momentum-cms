import {
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	inject,
	PLATFORM_ID,
	signal,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, switchMap, map, catchError, of, startWith } from 'rxjs';
import { injectMomentumAPI, MomentumAuthService, type FindResult } from '@momentum-cms/admin';
import { BlockRendererComponent, BlockAdminModeService, DialogService } from '@momentum-cms/ui';
import type { BlocksField } from '@momentum-cms/core';
import {
	InlineBlockEditDialog,
	type InlineBlockEditData,
} from './inline-block-edit-dialog.component';
import { Pages } from '../../collections/pages.collection';

interface PageState {
	page: Record<string, unknown> | null;
	loading: boolean;
	error: boolean;
}

@Component({
	selector: 'app-page',
	imports: [BlockRendererComponent],
	providers: [BlockAdminModeService],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block min-h-screen',
	},
	template: `
		@if (loading()) {
			<div class="flex items-center justify-center min-h-screen" data-testid="page-loading">
				<p class="text-lg text-gray-500">Loading...</p>
			</div>
		} @else if (error()) {
			<div class="flex items-center justify-center min-h-screen" data-testid="page-error">
				<div class="text-center">
					<h1 class="text-4xl font-bold text-gray-900 mb-2">404</h1>
					<p class="text-lg text-gray-500">Page not found</p>
				</div>
			</div>
		} @else {
			<main data-testid="page-content">
				@if (blocks().length === 0) {
					<div class="flex items-center justify-center min-h-[50vh]" data-testid="page-empty">
						<p class="text-lg text-gray-400">This page has no content yet.</p>
					</div>
				} @else {
					<mcms-block-renderer [blocks]="blocks()" (editBlock)="onEditBlock($event)" />
				}
			</main>
		}
	`,
})
export class PageComponent {
	private readonly route = inject(ActivatedRoute);
	private readonly api = injectMomentumAPI();
	private readonly platformId = inject(PLATFORM_ID);
	private readonly doc = inject(DOCUMENT);
	private readonly destroyRef = inject(DestroyRef);
	private readonly adminModeService = inject(BlockAdminModeService);
	private readonly authService = inject(MomentumAuthService);
	private readonly dialog = inject(DialogService);

	/** Live preview override: when set, takes precedence over DB data. */
	readonly previewOverride = signal<Record<string, unknown>[] | null>(null);

	/** Incremented to force a re-fetch from the API after inline edit save. */
	private readonly refreshTrigger = signal(0);

	/** Reactive slug from route params, falling back to route data */
	private readonly slug = toSignal(
		this.route.params.pipe(
			map((params) => {
				const slug = params['slug'];
				if (slug) return slug;
				const dataSlug: unknown = this.route.snapshot.data['slug'];
				return typeof dataSlug === 'string' ? dataSlug : undefined;
			}),
		),
	);

	/**
	 * Reactive page state derived from the slug signal.
	 * Uses observable pipeline so Angular SSR can track the pending API call.
	 */
	private readonly state = toSignal(
		combineLatest([toObservable(this.slug), toObservable(this.refreshTrigger)]).pipe(
			switchMap(([slug]) => {
				if (!slug) {
					return of<PageState>({ page: null, loading: false, error: true });
				}
				return this.api
					.collection('pages')
					.find$({
						where: { slug: { equals: slug } },
						limit: 1,
					})
					.pipe(
						map(
							(result: FindResult<Record<string, unknown>>): PageState => ({
								page: result.docs[0] ?? null,
								loading: false,
								error: !result.docs[0],
							}),
						),
						catchError(() => of<PageState>({ page: null, loading: false, error: true })),
						startWith<PageState>({ page: null, loading: true, error: false }),
					);
			}),
		),
	);

	/** Expose individual state fields as signals */
	readonly page = computed(() => this.state()?.page ?? null);
	readonly loading = computed(() => this.state()?.loading ?? true);
	readonly error = computed(() => this.state()?.error ?? false);

	/** Computed blocks: prefer preview data over page data. */
	readonly blocks = computed((): Record<string, unknown>[] => {
		const override = this.previewOverride();
		if (override) return override;
		const content = this.page()?.['content'];
		return Array.isArray(content) ? content : [];
	});

	constructor() {
		if (isPlatformBrowser(this.platformId)) {
			this.setupPreviewListener();

			// Trigger auth initialization if not yet done
			// (user navigated directly to frontend page, bypassing admin guards)
			if (this.authService.loading()) {
				this.authService.initialize().catch(() => {
					/* auth init is best-effort on frontend pages */
				});
			}

			// Admin mode derived from auth role — reactive via computed
			this.adminModeService.isAdmin = computed(() => this.authService.isAdmin());
		}
	}

	/** Handle edit block request from overlay */
	onEditBlock(blockIndex: number): void {
		if (!isPlatformBrowser(this.platformId)) return;

		const win = this.doc.defaultView;
		if (win && this.isInPreviewIframe(win)) {
			// In preview iframe — tell admin parent to focus on this block
			win.parent.postMessage({ type: 'momentum-edit-block', blockIndex }, win.location.origin);
			return;
		}

		// On live page — open inline edit dialog
		const page = this.page();
		const pageId = page?.['id'];
		if (!pageId) return;

		const currentBlocks = this.blocks();
		const block = currentBlocks[blockIndex];
		if (!block) return;

		const blockType = typeof block['blockType'] === 'string' ? block['blockType'] : undefined;
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Narrow union field type from defineCollection
		const blocksField = Pages.fields.find((f) => f.name === 'content') as BlocksField | undefined;
		const blockConfig = blocksField?.blocks.find((b) => b.slug === blockType);
		if (!blockConfig) return;

		const ref = this.dialog.open<InlineBlockEditDialog, InlineBlockEditData, boolean>(
			InlineBlockEditDialog,
			{
				data: {
					blockConfig,
					pageId: String(pageId),
					allBlocks: currentBlocks,
					blockIndex,
				},
				width: '32rem',
			},
		);

		ref.afterClosed.subscribe((saved) => {
			if (saved) {
				this.refreshTrigger.update((v) => v + 1);
			}
		});
	}

	/** Detect if the current page is running inside a preview iframe. */
	private isInPreviewIframe(win: Window): boolean {
		try {
			return win.parent !== win;
		} catch {
			return false;
		}
	}

	private setupPreviewListener(): void {
		const win = this.doc.defaultView;
		if (!win) return;

		const handler = (event: MessageEvent): void => {
			if (event.origin !== win.location.origin) return;
			if (event.data?.type !== 'momentum-preview-update') return;

			const data = event.data.data;
			if (data && Array.isArray(data['content'])) {
				this.previewOverride.set(data['content']);
			}
		};

		win.addEventListener('message', handler);
		this.destroyRef.onDestroy(() => {
			win.removeEventListener('message', handler);
		});
	}
}
