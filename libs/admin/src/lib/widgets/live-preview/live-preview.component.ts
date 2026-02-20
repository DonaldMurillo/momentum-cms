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
 * - `preview: true` (server-rendered HTML): iframe loads API endpoint with scripts enabled
 *   for postMessage live updates.
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

	/** Debounce timer for postMessage updates */
	private debounceTimer: number | undefined = undefined;

	constructor() {
		// Set iframe src/sandbox/width via nativeElement when the iframe is available.
		// The iframe is static in the template (no bindings) to avoid NG0910.
		// Angular manages the element lifecycle via @if(previewUrl()).
		effect(() => {
			const iframeRef = this.previewIframe();
			if (!iframeRef) return;

			const iframe = iframeRef.nativeElement;
			const url = this.previewUrl();
			if (!url) return;

			iframe.setAttribute('sandbox', this.sandboxValue());
			iframe.src = url;
			iframe.style.width = this.iframeWidth();
		});

		// Send form data to iframe via postMessage whenever data changes.
		// Only effective for server-rendered previews (preview: true) where
		// allow-scripts is enabled. URL-based previews have scripts disabled
		// so the postMessage is a no-op (which is fine).
		effect(() => {
			const data = this.documentData();
			const iframeRef = this.previewIframe();
			if (!iframeRef?.nativeElement.contentWindow) return;

			// Debounce to avoid thrashing
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

		// Clean up debounce timer on destroy
		this.destroyRef.onDestroy(() => {
			if (this.debounceTimer) {
				clearTimeout(this.debounceTimer);
				this.debounceTimer = undefined;
			}
		});
	}

	/** Force iframe to reload */
	refreshPreview(): void {
		this.refreshCounter.update((c) => c + 1);
	}
}
