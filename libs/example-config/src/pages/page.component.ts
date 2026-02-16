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
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { injectMomentumAPI, MomentumAuthService, type FindResult } from '@momentumcms/admin';
import { BlockRendererComponent, BlockAdminModeService, DialogService } from '@momentumcms/ui';
import type { BlocksField } from '@momentumcms/core';
import {
	InlineBlockEditDialog,
	type InlineBlockEditData,
} from './inline-block-edit-dialog.component';
import { Pages } from '../collections/index';

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

	/** Client-side refresh override (for inline editing). */
	private readonly refreshedState = signal<PageState | null>(null);

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
	 * Page state resolved by the route resolver (SSR-safe).
	 * The router awaits the resolver before rendering, so data is always
	 * available on first render — no loading state needed for SSR.
	 */
	private readonly resolvedPage = toSignal(
		this.route.data.pipe(
			map((data): PageState => {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- route resolver provides FindResult
				const result = data['pageData'] as FindResult<Record<string, unknown>> | undefined;
				if (!result) return { page: null, loading: false, error: true };
				return {
					page: result.docs[0] ?? null,
					loading: false,
					error: !result.docs[0],
				};
			}),
		),
	);

	/** Combined state: client-side refresh overrides resolved data */
	private readonly state = computed(
		() =>
			this.refreshedState() ?? this.resolvedPage() ?? { page: null, loading: true, error: false },
	);

	/** Expose individual state fields as signals */
	readonly page = computed(() => this.state().page);
	readonly loading = computed(() => this.state().loading);
	readonly error = computed(() => this.state().error);

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
				this.refreshPageData();
			}
		});
	}

	/** Re-fetch page data from the API (client-side, after inline edit save). */
	private refreshPageData(): void {
		const slug = this.slug();
		if (!slug) return;
		this.api
			.collection('pages')
			.find({
				where: { slug: { equals: slug } },
				limit: 1,
			})
			.then((result: FindResult<Record<string, unknown>>) => {
				this.refreshedState.set({
					page: result.docs[0] ?? null,
					loading: false,
					error: !result.docs[0],
				});
			})
			.catch(() => {
				this.refreshedState.set({ page: null, loading: false, error: true });
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
