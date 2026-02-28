import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	ElementRef,
	inject,
	Injector,
	input,
	output,
	signal,
	untracked,
	type WritableSignal,
} from '@angular/core';
import { FormRoot, submit } from '@angular/forms/signals';
import type { FieldTree } from '@angular/forms/signals';
import type { FormSchema, FormFieldConfig } from '../types/form-schema.types';
import type { FormSubmitEvent } from '../types/form-events.types';
import { evaluateConditions } from '../schema/condition-evaluator';
import { createFormFromSchema } from '../schema/schema-to-signal-form';
import { FormFieldHostComponent } from './field-renderers/form-field-host.component';

/**
 * Standalone form builder component.
 *
 * Takes a `FormSchema` JSON and renders a complete form with validation,
 * conditional visibility, and submission handling.
 *
 * @example
 * ```html
 * <mcms-form-builder
 *   [schema]="contactFormSchema"
 *   (formSubmit)="handleSubmit($event)"
 * />
 * ```
 */
@Component({
	selector: 'mcms-form-builder',
	imports: [FormRoot, FormFieldHostComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		@if (formTree()) {
			<form [formRoot]="formTree()!" (submit)="onSubmit($event)">
				@if (schema().title) {
					<h2 class="text-xl font-semibold mb-2">{{ schema().title }}</h2>
				}
				@if (schema().description) {
					<p class="text-sm text-muted-foreground mb-4">{{ schema().description }}</p>
				}

				<div class="space-y-4">
					@for (field of visibleFields(); track field.name) {
						<div [class]="getWidthClass(field)">
							<mcms-form-field-host [field]="field" [formNode]="getFormNode(field.name)" />
						</div>
					}
				</div>

				@if (showHoneypot()) {
					<div class="absolute -left-[9999px]" aria-hidden="true" tabindex="-1">
						<input type="text" name="_hp_field" autocomplete="off" tabindex="-1" />
					</div>
				}

				@if (submitted() && submitSuccess()) {
					<div class="mt-4 rounded-md bg-green-50 p-4 text-sm text-green-700" role="status">
						{{ successMessage() }}
					</div>
				}

				@if (submitted() && !submitSuccess() && submitError()) {
					<div class="mt-4 rounded-md bg-destructive/10 p-4 text-sm text-destructive" role="alert">
						{{ submitError() }}
					</div>
				}

				<div class="mt-6">
					<button
						type="submit"
						class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
						[disabled]="submitting() || (submitted() && submitSuccess())"
					>
						@if (submitting()) {
							Submitting...
						} @else {
							{{ submitLabel() }}
						}
					</button>
				</div>
			</form>
		}
	`,
})
export class FormBuilderComponent {
	private readonly injector = inject(Injector);
	private readonly elementRef = inject(ElementRef);

	/** The form schema that drives rendering. */
	readonly schema = input.required<FormSchema>();

	/** Whether to show the honeypot field (anti-spam). */
	readonly showHoneypot = input(false);

	/** Emitted when the form is submitted with valid data. */
	readonly formSubmit = output<FormSubmitEvent>();

	/** Signal forms tree. */
	readonly formTree = signal<FieldTree<Record<string, unknown>> | null>(null);

	/** Reference to the model signal from createFormFromSchema. */
	private readonly _modelRef = signal<WritableSignal<Record<string, unknown>> | null>(null);

	/** Form model values (reads through the model ref). */
	readonly formModel = computed(() => this._modelRef()?.() ?? {});

	/** Submission state. */
	readonly submitting = signal(false);
	readonly submitted = signal(false);
	readonly submitSuccess = signal(false);
	readonly submitError = signal<string | null>(null);

	/** Submit button label from settings. */
	readonly submitLabel = computed(() => this.schema().settings?.submitLabel ?? 'Submit');

	/** Success message from settings. */
	readonly successMessage = computed(
		() => this.schema().settings?.successMessage ?? 'Thank you for your submission!',
	);

	/** Fields visible based on conditions. */
	readonly visibleFields = computed(() => {
		const fields = this.schema().fields;
		const model = this.formModel();
		return fields.filter((field) => {
			if (!field.conditions || field.conditions.length === 0) return true;
			return evaluateConditions(field.conditions, model);
		});
	});

	constructor() {
		// Rebuild form tree whenever schema changes
		effect(() => {
			const schema = this.schema();
			if (!schema) return;

			untracked(() => {
				const { model, formTree } = createFormFromSchema(schema, {
					injector: this.injector,
				});
				this._modelRef.set(model);
				this.formTree.set(formTree);
				// Reset submission state when schema changes
				this.submitted.set(false);
				this.submitSuccess.set(false);
				this.submitError.set(null);
			});
		});
	}

	/** Get a FieldTree node for a top-level field by name. */
	getFormNode(fieldName: string): unknown {
		const tree = this.formTree();
		if (!tree) return null;
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- FieldTree is a proxy object with dynamic keys
		return (tree as unknown as Record<string, unknown>)[fieldName] ?? null;
	}

	/** Get Tailwind width class from field config. */
	getWidthClass(field: FormFieldConfig): string {
		switch (field.width) {
			case 'half':
				return 'w-full md:w-1/2';
			case 'third':
				return 'w-full md:w-1/3';
			default:
				return 'w-full';
		}
	}

	/** Handle form submission. */
	async onSubmit(event: Event): Promise<void> {
		event.preventDefault();
		const tree = this.formTree();
		if (!tree || this.submitting()) return;

		this.submitting.set(true);
		this.submitError.set(null);

		const valid = await submit(tree, {
			action: async () => {
				// Form is valid — collect values and include honeypot if enabled
				const values: Record<string, unknown> = { ...this.formModel() };
				if (this.showHoneypot()) {
					/* eslint-disable @typescript-eslint/consistent-type-assertions -- ElementRef.nativeElement is typed as unknown */
					const hpInput = (
						this.elementRef.nativeElement as HTMLElement
					).querySelector<HTMLInputElement>('input[name="_hp_field"]');
					/* eslint-enable @typescript-eslint/consistent-type-assertions */
					if (hpInput) {
						values['_hp_field'] = hpInput.value;
					}
				}

				this.formSubmit.emit({
					values,
					formId: this.schema().id,
				});
				this.submitted.set(true);
				this.submitSuccess.set(true);
			},
		});

		if (!valid) {
			this.submitted.set(true);
			this.submitSuccess.set(false);
			this.submitError.set('Please fix the errors above.');
		}

		this.submitting.set(false);
	}
}
