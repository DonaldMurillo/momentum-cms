import {
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	effect,
	ElementRef,
	input,
	output,
	signal,
	untracked,
	viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import { Button } from '@momentumcms/ui';

/** Device size preset for the preview iframe. */
export type DeviceSize = 'desktop' | 'tablet' | 'mobile';

/**
 * Live Preview Widget
 *
 * Displays an iframe that shows a live preview of the document being edited.
 *
 * Two modes based on preview config type:
 * - `preview: true` (server-rendered HTML): initial GET loads from database, then
 *   subsequent form changes are POSTed to the same endpoint with the current form data
 *   for realtime preview updates (no page reload needed).
 * - `preview: string/function` (URL-based): iframe loads the page URL with scripts DISABLED.
 *   This prevents loading a second Angular app instance (with Vite HMR, SSR hydration, etc.)
 *   which causes tab crashes in dev mode. The SSR-rendered HTML displays correctly without JS.
 *   Use the Refresh button to see form changes reflected in the preview.
 *
 * The iframe is declared statically in the template (no dynamic bindings) to avoid NG0910.
 * Its src/sandbox attributes are set via nativeElement in an effect().
 */
@Component({
	selector: 'mcms-live-preview',
	imports: [Button],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'flex flex-col h-full border-l border-border' },
	template: `
		<!-- Preview toolbar -->
		<div class="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/50">
			<span class="text-sm font-medium text-foreground">Preview</span>
			<div class="flex-1"></div>

			<!-- Device size toggle -->
			<div
				class="flex rounded-md border border-border overflow-hidden"
				role="group"
				aria-label="Preview device size"
				data-testid="device-toggle"
			>
				<button
					class="px-2 py-1 text-xs transition-colors"
					[class]="
						deviceSize() === 'desktop'
							? 'bg-primary text-primary-foreground'
							: 'bg-background text-muted-foreground hover:bg-muted'
					"
					[attr.aria-pressed]="deviceSize() === 'desktop'"
					(click)="deviceSize.set('desktop')"
					data-testid="device-desktop"
				>
					Desktop
				</button>
				<button
					class="px-2 py-1 text-xs border-l border-border transition-colors"
					[class]="
						deviceSize() === 'tablet'
							? 'bg-primary text-primary-foreground'
							: 'bg-background text-muted-foreground hover:bg-muted'
					"
					[attr.aria-pressed]="deviceSize() === 'tablet'"
					(click)="deviceSize.set('tablet')"
					data-testid="device-tablet"
				>
					Tablet
				</button>
				<button
					class="px-2 py-1 text-xs border-l border-border transition-colors"
					[class]="
						deviceSize() === 'mobile'
							? 'bg-primary text-primary-foreground'
							: 'bg-background text-muted-foreground hover:bg-muted'
					"
					[attr.aria-pressed]="deviceSize() === 'mobile'"
					(click)="deviceSize.set('mobile')"
					data-testid="device-mobile"
				>
					Mobile
				</button>
			</div>

			<button
				mcms-button
				variant="ghost"
				size="sm"
				(click)="refreshPreview()"
				data-testid="preview-refresh"
				aria-label="Refresh preview"
			>
				↻ Refresh
			</button>
		</div>

		<!-- Preview iframe container -->
		<div class="flex-1 overflow-auto bg-muted/30 flex justify-center p-4">
			@if (previewUrl()) {
				<!-- Static iframe with no dynamic bindings (avoids NG0910).
				     src/sandbox/width are set via nativeElement in an effect(). -->
				<iframe
					#previewIframe
					title="Live document preview"
					data-testid="preview-iframe"
					class="h-full bg-white border border-border rounded-md shadow-sm transition-[width] duration-300"
				></iframe>
			} @else {
				<div class="flex items-center justify-center h-full text-muted-foreground text-sm">
					Preview not available
				</div>
			}
		</div>
	`,
})
export class LivePreviewComponent {
	private readonly document = inject(DOCUMENT);
	private readonly destroyRef = inject(DestroyRef);

	/** Preview configuration from collection admin config */
	readonly preview = input.required<
		boolean | string | ((doc: Record<string, unknown>) => string)
	>();

	/** Current document data from the form */
	readonly documentData = input.required<Record<string, unknown>>();

	/** Collection slug */
	readonly collectionSlug = input.required<string>();

	/** Document ID (undefined for create mode) */
	readonly entityId = input<string | undefined>(undefined);

	/** Emitted when the preview iframe requests editing a block */
	readonly editBlockRequest = output<number>();

	/** Current device size */
	readonly deviceSize = signal<DeviceSize>('desktop');

	/** Refresh counter to force iframe reload */
	private readonly refreshCounter = signal(0);

	/** Reference to the static iframe element (available when previewUrl is non-null) */
	private readonly previewIframe = viewChild<ElementRef<HTMLIFrameElement>>('previewIframe');

	/** Whether the initial iframe load from GET is complete */
	private initialLoadDone = false;

	/** Compute the raw preview URL */
	readonly previewUrl = computed((): string | null => {
		// Force recomputation on refresh
		this.refreshCounter();

		const previewConfig = this.preview();
		const data = this.documentData();
		const slug = this.collectionSlug();
		const id = this.entityId();

		if (typeof previewConfig === 'function') {
			try {
				return previewConfig(data);
			} catch {
				return null;
			}
		}

		// URL template string: interpolate {fieldName} placeholders with form data
		// Return null if any placeholder resolves to empty (data not yet loaded)
		if (typeof previewConfig === 'string') {
			let hasEmptyField = false;
			const url = previewConfig.replace(/\{(\w+)\}/g, (_, field: string) => {
				const val = data[field];
				if (val == null || val === '') {
					hasEmptyField = true;
					return '';
				}
				return String(val);
			});
			return hasEmptyField ? null : url;
		}

		if (previewConfig === true && id) {
			return `/api/${slug}/${id}/preview`;
		}

		return null;
	});

	/** Computed iframe width based on device size */
	readonly iframeWidth = computed((): string => {
		switch (this.deviceSize()) {
			case 'tablet':
				return '768px';
			case 'mobile':
				return '375px';
			default:
				return '100%';
		}
	});

	/** Sandbox attribute value based on preview mode */
	private readonly sandboxValue = computed((): string => {
		const previewConfig = this.preview();
		if (previewConfig === true) {
			// Server-rendered HTML: scripts needed for postMessage live updates
			return 'allow-same-origin allow-scripts allow-popups allow-forms';
		}
		// URL-based preview: no scripts to prevent full Angular app from loading
		return 'allow-same-origin allow-popups allow-forms';
	});

	/** Debounce timer for live preview updates */
	private debounceTimer: number | undefined = undefined;

	/** AbortController for in-flight POST requests */
	private fetchAbort: AbortController | undefined = undefined;

	constructor() {
		// Effect 1: Set iframe src and sandbox when URL or sandbox config changes.
		// Uses untracked() for iframeWidth so device size toggles don't trigger a reload.
		effect(() => {
			const iframeRef = this.previewIframe();
			if (!iframeRef) return;

			const iframe = iframeRef.nativeElement;
			const url = this.previewUrl();
			if (!url) return;

			this.initialLoadDone = false;
			iframe.setAttribute('sandbox', this.sandboxValue());
			iframe.src = url;
			// Set initial width without tracking the signal
			iframe.style.width = untracked(() => this.iframeWidth());

			// Mark initial load as done once the iframe finishes loading
			const onLoad = (): void => {
				this.initialLoadDone = true;
				iframe.removeEventListener('load', onLoad);
			};
			iframe.addEventListener('load', onLoad);
		});

		// Effect 2: Update iframe width only (no reload).
		// Changing CSS width on an iframe does not trigger navigation.
		effect(() => {
			const iframeRef = this.previewIframe();
			if (!iframeRef) return;

			iframeRef.nativeElement.style.width = this.iframeWidth();
		});

		// Effect 3: Live preview updates via POST (for preview: true mode).
		// When form data changes, POST it to the preview endpoint and write the
		// response HTML directly to the iframe. This works for all collection types
		// including email templates where postMessage isn't sufficient.
		effect(() => {
			const data = this.documentData();
			const previewConfig = this.preview();

			// Only use POST-based updates for server-rendered previews (preview: true)
			if (previewConfig !== true) {
				// For URL-based previews, use postMessage as before
				const iframeRef = this.previewIframe();
				if (!iframeRef?.nativeElement.contentWindow) return;

				if (this.debounceTimer) {
					clearTimeout(this.debounceTimer);
				}
				this.debounceTimer = this.document.defaultView?.setTimeout(() => {
					const iframeWindow = iframeRef.nativeElement.contentWindow;
					if (iframeWindow) {
						const targetOrigin = this.document.defaultView?.location?.origin ?? '';
						iframeWindow.postMessage({ type: 'momentum-preview-update', data }, targetOrigin);
					}
				}, 300);
				return;
			}

			// For preview: true, POST form data to the server preview endpoint
			const url = untracked(() => this.previewUrl());
			if (!url) return;

			// Skip the first emission (initial load is handled by iframe src)
			if (!this.initialLoadDone) return;

			if (this.debounceTimer) {
				clearTimeout(this.debounceTimer);
			}

			this.debounceTimer = this.document.defaultView?.setTimeout(() => {
				this.fetchPreviewHtml(url, data);
			}, 300);
		});

		// Listen for edit block requests from preview iframe
		const win = this.document.defaultView;
		if (win) {
			const editHandler = (event: MessageEvent): void => {
				if (event.origin !== win.location.origin) return;
				if (event.data?.type !== 'momentum-edit-block') return;
				const blockIndex = event.data.blockIndex;
				if (typeof blockIndex === 'number') {
					this.editBlockRequest.emit(blockIndex);
				}
			};
			win.addEventListener('message', editHandler);
			this.destroyRef.onDestroy(() => win.removeEventListener('message', editHandler));
		}

		// Clean up on destroy
		this.destroyRef.onDestroy(() => {
			if (this.debounceTimer) {
				clearTimeout(this.debounceTimer);
				this.debounceTimer = undefined;
			}
			this.fetchAbort?.abort();
		});
	}

	/** Force iframe to reload from server (GET) */
	refreshPreview(): void {
		this.refreshCounter.update((c) => c + 1);
	}

	/** POST form data to the preview endpoint and write the HTML response to the iframe. */
	private fetchPreviewHtml(url: string, data: Record<string, unknown>): void {
		// Cancel any in-flight request
		this.fetchAbort?.abort();
		this.fetchAbort = new AbortController();

		const win = this.document.defaultView;
		if (!win) return;

		win
			.fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ data }),
				credentials: 'include',
				signal: this.fetchAbort.signal,
			})
			.then((response) => {
				if (!response.ok) return null;
				return response.text();
			})
			.then((html) => {
				if (!html) return;
				const iframeRef = this.previewIframe();
				if (!iframeRef) return;

				const doc = iframeRef.nativeElement.contentDocument;
				if (doc) {
					doc.open();
					doc.write(html);
					doc.close();
				}
			})
			.catch((err: unknown) => {
				// Ignore abort errors (expected when a new request supersedes)
				if (err instanceof DOMException && err.name === 'AbortError') return;
				console.warn('[momentum:live-preview] Preview fetch failed:', err);
			});
	}
}
