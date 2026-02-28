import { isPlatformBrowser } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	input,
	PLATFORM_ID,
	signal,
} from '@angular/core';
import { FormBuilderComponent } from '@momentumcms/form-builder';
import type { FormSchema } from '@momentumcms/form-builder';

/**
 * Form block component for rendering dynamic forms on pages.
 *
 * References a form via a relationship field (`form`) that stores the
 * form document ID. The schema is fetched from `/api/forms/:id/schema`
 * at render time so the block definition stays lightweight and the admin
 * shows a proper dropdown selector instead of a freeform text field.
 */
@Component({
	selector: 'app-form-block',
	imports: [FormBuilderComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block',
		'[attr.data-testid]': '"block-form"',
	},
	template: `
		@if (formSchema()) {
			<section class="py-8 px-4 md:py-12 md:px-8">
				<div class="mx-auto max-w-2xl">
					<mcms-form-builder
						[schema]="formSchema()!"
						[showHoneypot]="showHoneypot()"
						(formSubmit)="onSubmit($event)"
					/>
				</div>
			</section>
		} @else if (loading()) {
			<section class="py-8 px-4 md:py-12 md:px-8">
				<div class="mx-auto max-w-2xl text-muted-foreground">Loading form…</div>
			</section>
		} @else if (error()) {
			<section class="py-8 px-4 md:py-12 md:px-8">
				<div class="mx-auto max-w-2xl text-destructive">{{ error() }}</div>
			</section>
		}
	`,
})
export class FormBlockComponent {
	private readonly platformId = inject(PLATFORM_ID);

	readonly data = input.required<Record<string, unknown>>();

	/** The form ID from the relationship field, or legacy formSlug fallback. */
	readonly formRef = computed(() => {
		const ref = this.data()['form'] ?? this.data()['formSlug'] ?? this.data()['slug'];
		return typeof ref === 'string' ? ref : '';
	});

	readonly showHoneypot = computed((): boolean => !!this.data()['showHoneypot']);

	readonly formSchema = signal<FormSchema | null>(null);
	readonly formSlug = signal<string>('');
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);

	constructor() {
		effect(() => {
			const ref = this.formRef();
			if (!ref || !isPlatformBrowser(this.platformId)) return;

			this.loading.set(true);
			this.error.set(null);

			fetch(`/api/forms/${encodeURIComponent(ref)}/schema`)
				.then((res) => {
					if (!res.ok) throw new Error(`Form not found`);
					return res.json();
				})
				.then((response: { schema: FormSchema; slug: string }) => {
					this.formSchema.set(response.schema);
					this.formSlug.set(response.slug);
					this.loading.set(false);
				})
				.catch((err: Error) => {
					this.error.set(err.message);
					this.loading.set(false);
				});
		});
	}

	onSubmit(event: { values: Record<string, unknown>; formId: string }): void {
		if (!isPlatformBrowser(this.platformId)) return;
		const slug = this.formSlug();
		if (slug) {
			fetch(`/api/forms/${encodeURIComponent(slug)}/submit`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(event.values),
			}).catch(() => {
				// Submission already handled by the form builder's success message
			});
		}
	}
}
