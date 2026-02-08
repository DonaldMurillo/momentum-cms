import {
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	effect,
	ElementRef,
	input,
	signal,
	viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { inject } from '@angular/core';
import { Button } from '@momentum-cms/ui';

/** Device size preset for the preview iframe. */
export type DeviceSize = 'desktop' | 'tablet' | 'mobile';

/**
 * Live Preview Widget
 *
 * Displays an iframe that shows a live preview of the document being edited.
 * Sends form data to the iframe via postMessage on each change.
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
			>
				↻ Refresh
			</button>
		</div>

		<!-- Preview iframe container -->
		<div class="flex-1 overflow-auto bg-muted/30 flex justify-center p-4">
			@if (safePreviewUrl(); as url) {
				<iframe
					#previewFrame
					[src]="url"
					[style.width]="iframeWidth()"
					class="h-full bg-white border border-border rounded-md shadow-sm transition-[width] duration-300"
					sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
					title="Live document preview"
					data-testid="preview-iframe"
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
	private readonly sanitizer = inject(DomSanitizer);
	private readonly destroyRef = inject(DestroyRef);

	/** Preview configuration from collection admin config */
	readonly preview = input.required<boolean | ((doc: Record<string, unknown>) => string)>();

	/** Current document data from the form */
	readonly documentData = input.required<Record<string, unknown>>();

	/** Collection slug */
	readonly collectionSlug = input.required<string>();

	/** Document ID (undefined for create mode) */
	readonly entityId = input<string | undefined>(undefined);

	/** Current device size */
	readonly deviceSize = signal<DeviceSize>('desktop');

	/** Refresh counter to force iframe reload */
	private readonly refreshCounter = signal(0);

	/** Reference to the iframe element */
	readonly previewFrame = viewChild<ElementRef<HTMLIFrameElement>>('previewFrame');

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

		if (previewConfig === true && id) {
			return `/api/${slug}/${id}/preview`;
		}

		return null;
	});

	/** Sanitized preview URL for iframe binding */
	readonly safePreviewUrl = computed((): SafeResourceUrl | null => {
		const url = this.previewUrl();
		if (!url) return null;
		return this.sanitizer.bypassSecurityTrustResourceUrl(url);
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

	/** Debounce timer for postMessage updates */
	private debounceTimer: number | undefined = undefined;

	constructor() {
		// Send form data to iframe via postMessage whenever data changes
		effect(() => {
			const data = this.documentData();
			const frame = this.previewFrame();
			if (!frame?.nativeElement?.contentWindow) return;

			// Debounce to avoid thrashing
			if (this.debounceTimer) {
				clearTimeout(this.debounceTimer);
			}

			this.debounceTimer = this.document.defaultView?.setTimeout(() => {
				const iframeWindow = frame.nativeElement.contentWindow;
				if (iframeWindow) {
					const targetOrigin = this.document.defaultView?.location?.origin ?? '';
					iframeWindow.postMessage({ type: 'momentum-preview-update', data }, targetOrigin);
				}
			}, 300);
		});

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
