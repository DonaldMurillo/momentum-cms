import {
	ChangeDetectionStrategy,
	Component,
	computed,
	ElementRef,
	input,
	output,
	viewChild,
} from '@angular/core';
import { normalizeFocalPoint, focalPointToCssPosition } from './focal-point-utils';
import { calculatePreviewCrop } from './canvas-preview-utils';
import type { ImageSizeConfig } from '@momentumcms/core';

/**
 * Focal Point Picker Component
 *
 * Displays an image with an interactive crosshair overlay.
 * Click anywhere on the image to set the focal point.
 * Optionally shows crop preview outlines for configured image sizes.
 *
 * @example
 * ```html
 * <mcms-focal-point-picker
 *   [imageUrl]="mediaUrl"
 *   [focalPoint]="{ x: 0.5, y: 0.5 }"
 *   [imageSizes]="configuredSizes"
 *   [naturalWidth]="800"
 *   [naturalHeight]="600"
 *   (focalPointChange)="onFocalPointChange($event)"
 * />
 * ```
 */
@Component({
	selector: 'mcms-focal-point-picker',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		<div class="space-y-3">
			<div class="relative inline-block overflow-hidden rounded-lg border border-mcms-border">
				<!-- Image -->
				<img
					#imageEl
					[src]="imageUrl()"
					[alt]="alt() || 'Image with focal point selector'"
					class="block max-h-96 max-w-full"
					[style.object-position]="cssPosition()"
				/>

				<!-- Clickable overlay -->
				<div
					class="absolute inset-0 cursor-crosshair"
					role="button"
					tabindex="0"
					[attr.aria-label]="'Set focal point. Current position: ' + positionLabel()"
					(click)="onClick($event)"
					(keydown.enter)="onResetCenter()"
					(keydown.space)="onResetCenter()"
					(keydown.ArrowLeft)="onNudge(-0.05, 0, $event)"
					(keydown.ArrowRight)="onNudge(0.05, 0, $event)"
					(keydown.ArrowUp)="onNudge(0, -0.05, $event)"
					(keydown.ArrowDown)="onNudge(0, 0.05, $event)"
				>
					<!-- Crosshair lines -->
					<div
						class="pointer-events-none absolute h-px w-full bg-white/70"
						[style.top.%]="focalPointY()"
					></div>
					<div
						class="pointer-events-none absolute w-px h-full bg-white/70"
						[style.left.%]="focalPointX()"
					></div>

					<!-- Focal point dot -->
					<div
						class="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-mcms-primary shadow-md"
						[style.left.%]="focalPointX()"
						[style.top.%]="focalPointY()"
						aria-hidden="true"
					></div>

					<!-- Crop preview outlines -->
					@for (preview of cropPreviews(); track preview.name) {
						<div
							class="pointer-events-none absolute border border-dashed border-yellow-400/60"
							[style.left.%]="preview.leftPct"
							[style.top.%]="preview.topPct"
							[style.width.%]="preview.widthPct"
							[style.height.%]="preview.heightPct"
							[attr.aria-label]="'Crop preview for ' + preview.name"
						>
							<span class="absolute -top-5 left-0 text-xs text-yellow-400 drop-shadow-sm">
								{{ preview.name }}
							</span>
						</div>
					}
				</div>
			</div>

			<!-- Coordinates display -->
			<p class="text-xs text-mcms-muted-foreground" aria-live="polite">
				Focal point: {{ positionLabel() }}
				<button
					class="ml-2 underline hover:text-mcms-foreground"
					type="button"
					(click)="onResetCenter()"
					aria-label="Reset focal point to center"
				>
					Reset to center
				</button>
			</p>
		</div>
	`,
})
export class FocalPointPickerComponent {
	private readonly imageElRef = viewChild<ElementRef<HTMLImageElement>>('imageEl');

	/** URL of the image to display */
	readonly imageUrl = input.required<string>();

	/** Current focal point (0-1 normalized) */
	readonly focalPoint = input<{ x: number; y: number }>({ x: 0.5, y: 0.5 });

	/** Alt text for the image */
	readonly alt = input<string>('');

	/** Natural width of the source image (for crop preview calculations) */
	readonly naturalWidth = input<number>(0);

	/** Natural height of the source image (for crop preview calculations) */
	readonly naturalHeight = input<number>(0);

	/** Configured image sizes for crop preview outlines */
	readonly imageSizes = input<ImageSizeConfig[]>([]);

	/** Emitted when the focal point changes */
	readonly focalPointChange = output<{ x: number; y: number }>();

	/** Focal point X as percentage */
	readonly focalPointX = computed(() => Math.round(this.focalPoint().x * 100));

	/** Focal point Y as percentage */
	readonly focalPointY = computed(() => Math.round(this.focalPoint().y * 100));

	/** CSS object-position string */
	readonly cssPosition = computed(() => focalPointToCssPosition(this.focalPoint()));

	/** Human-readable position label */
	readonly positionLabel = computed(() => {
		const fp = this.focalPoint();
		return `${Math.round(fp.x * 100)}% x ${Math.round(fp.y * 100)}%`;
	});

	/** Crop preview data for each configured size */
	readonly cropPreviews = computed(() => {
		const w = this.naturalWidth();
		const h = this.naturalHeight();
		const fp = this.focalPoint();
		const sizes = this.imageSizes();

		if (!w || !h || sizes.length === 0) return [];

		return sizes
			.filter((s) => s.width && s.height && s.fit === 'cover')
			.map((s) => {
				const crop = calculatePreviewCrop(
					{ width: w, height: h },
					{ width: s.width ?? 0, height: s.height ?? 0 },
					fp,
				);
				return {
					name: s.name,
					leftPct: (crop.x / w) * 100,
					topPct: (crop.y / h) * 100,
					widthPct: (crop.width / w) * 100,
					heightPct: (crop.height / h) * 100,
				};
			});
	});

	/**
	 * Handle click on the image overlay.
	 */
	onClick(event: MouseEvent): void {
		const el = this.imageElRef();
		if (!el) return;

		const rect = el.nativeElement.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return;

		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		const fp = normalizeFocalPoint({ x, y }, { width: rect.width, height: rect.height });
		this.focalPointChange.emit(fp);
	}

	/**
	 * Reset focal point to center.
	 */
	onResetCenter(): void {
		this.focalPointChange.emit({ x: 0.5, y: 0.5 });
	}

	/**
	 * Nudge focal point by a small amount (keyboard navigation).
	 */
	onNudge(dx: number, dy: number, event: Event): void {
		event.preventDefault();
		const fp = this.focalPoint();
		const newFp = {
			x: Math.max(0, Math.min(1, fp.x + dx)),
			y: Math.max(0, Math.min(1, fp.y + dy)),
		};
		this.focalPointChange.emit(newFp);
	}
}
