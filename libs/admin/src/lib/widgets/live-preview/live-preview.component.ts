import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	Injector,
	input,
	type Provider,
	signal,
	Type,
	ViewEncapsulation,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import type { PreviewConfig } from '@momentumcms/core';
import { Button } from '@momentumcms/ui';

/** Device size preset for the preview container. */
export type DeviceSize = 'desktop' | 'tablet' | 'mobile';

/**
 * Live Preview Widget
 *
 * Renders a user-provided Angular component directly inside the admin panel.
 * The preview component injects `LivePreviewService` to read live form data —
 * no iframes, no postMessage, no fetch. Instant signal-based reactivity.
 *
 * When the preview config includes `providers`, a child injector is created
 * so the preview component can access additional DI tokens (e.g. block registry).
 */
@Component({
	selector: 'mcms-live-preview',
	imports: [NgComponentOutlet, Button],
	changeDetection: ChangeDetectionStrategy.OnPush,
	encapsulation: ViewEncapsulation.None,
	host: {
		class: 'flex flex-col h-full border-l border-border',
		role: 'complementary',
		'aria-label': 'Live preview panel',
	},
	styles: `
		/* Force light theme variables inside the preview container so block components render correctly in dark admin */
		.mcms-preview-light {
			--mcms-background: 0 0% 100%;
			--mcms-foreground: 222 47% 11%;
			--mcms-card: 0 0% 100%;
			--mcms-card-foreground: 222 47% 11%;
			--mcms-primary: 221 83% 53%;
			--mcms-primary-foreground: 210 40% 98%;
			--mcms-secondary: 210 40% 96%;
			--mcms-secondary-foreground: 222 47% 11%;
			--mcms-muted: 210 40% 96%;
			--mcms-muted-foreground: 215 16% 43%;
			--mcms-accent: 210 40% 96%;
			--mcms-accent-foreground: 222 47% 11%;
			--mcms-destructive: 0 84% 60%;
			--mcms-destructive-foreground: 210 40% 98%;
			--mcms-border: 214 32% 91%;
			--mcms-input: 214 32% 91%;
			--mcms-ring: 221 83% 53%;
			background: hsl(0 0% 100%);
			color: hsl(222 47% 11%);
		}
	`,
	template: `
		<!-- Preview toolbar -->
		<div
			class="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/50"
			role="toolbar"
			aria-label="Preview controls"
		>
			<span class="text-sm font-medium text-foreground">Preview</span>
			<div class="flex-1"></div>

			<!-- Device size toggle -->
			<div
				class="flex rounded-md border border-border overflow-hidden"
				role="group"
				aria-label="Preview device size"
				data-testid="device-toggle"
			>
				@for (size of deviceSizes; track size.id) {
					<button
						class="px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						[class]="
							deviceSize() === size.id
								? 'bg-primary text-primary-foreground'
								: 'bg-background text-muted-foreground hover:bg-muted'
						"
						[class.border-l]="!$first"
						[class.border-border]="!$first"
						[attr.aria-pressed]="deviceSize() === size.id"
						(click)="deviceSize.set(size.id)"
						[attr.data-testid]="'device-' + size.id"
					>
						{{ size.label }}
					</button>
				}
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

		<!-- Preview content container -->
		<div
			class="flex-1 overflow-auto bg-muted/30 flex justify-center p-4"
			role="region"
			aria-label="Live preview"
		>
			<div
				[style.width]="containerWidth()"
				class="mcms-preview-light h-full border border-border rounded-md shadow-sm transition-[width] duration-300 overflow-auto"
				data-testid="preview-content"
				aria-live="polite"
				[attr.aria-busy]="!resolvedComponent() && !loadError()"
			>
				@if (resolvedComponent()) {
					<ng-container
						[ngComponentOutlet]="resolvedComponent()"
						[ngComponentOutletInjector]="previewInjector()"
					/>
				} @else if (loadError()) {
					<div
						class="flex items-center justify-center h-full text-destructive text-sm p-4"
						role="alert"
					>
						Failed to load preview component
					</div>
				} @else {
					<div class="flex items-center justify-center h-full text-muted-foreground text-sm">
						Loading preview…
					</div>
				}
			</div>
		</div>
	`,
})
export class LivePreviewComponent {
	private readonly parentInjector = inject(Injector);

	/** Preview configuration with lazy component loader */
	readonly preview = input.required<PreviewConfig>();

	/** Device size presets for the toggle group */
	readonly deviceSizes: ReadonlyArray<{ id: DeviceSize; label: string }> = [
		{ id: 'desktop', label: 'Desktop' },
		{ id: 'tablet', label: 'Tablet' },
		{ id: 'mobile', label: 'Mobile' },
	];

	/** Current device size */
	readonly deviceSize = signal<DeviceSize>('desktop');

	/** Resolved component type after lazy loading */
	readonly resolvedComponent = signal<Type<unknown> | null>(null);

	/** Injector for the preview component (includes custom providers if configured) */
	readonly previewInjector = signal<Injector>(this.parentInjector);

	/** Error from component loading */
	readonly loadError = signal<unknown>(null);

	/** Computed container width based on device size */
	readonly containerWidth = computed((): string => {
		switch (this.deviceSize()) {
			case 'tablet':
				return '768px';
			case 'mobile':
				return '375px';
			default:
				return '100%';
		}
	});

	/** Incremented to force re-creation of the preview component */
	private readonly refreshCounter = signal(0);

	/** Generation counter to ignore stale promise resolutions */
	private loadGeneration = 0;

	constructor() {
		effect(() => {
			const config = this.preview();
			// Track refresh counter to re-trigger on refresh
			this.refreshCounter();

			this.resolvedComponent.set(null);
			this.loadError.set(null);
			this.previewInjector.set(this.parentInjector);

			const generation = ++this.loadGeneration;

			// Resolve component and optional providers in parallel
			const componentPromise = config.component();
			const providersPromise = config.providers?.() ?? Promise.resolve(undefined);

			Promise.all([componentPromise, providersPromise])
				.then(([component, providers]) => {
					if (generation !== this.loadGeneration) return;

					// Create child injector if providers were returned
					if (providers && Array.isArray(providers) && providers.length > 0) {
						this.previewInjector.set(
							Injector.create({
								// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- providers are typed as unknown[] from PreviewConfig
								providers: providers as Provider[],
								parent: this.parentInjector,
							}),
						);
					}

					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- loader resolves to unknown, safe cast to Type
					this.resolvedComponent.set(component as Type<unknown>);
				})
				.catch((err: unknown) => {
					if (generation !== this.loadGeneration) return;
					console.error('[LivePreview] Failed to load preview component:', err);
					this.loadError.set(err);
				});
		});
	}

	/** Force re-load the preview component */
	refreshPreview(): void {
		this.refreshCounter.update((c) => c + 1);
	}
}
