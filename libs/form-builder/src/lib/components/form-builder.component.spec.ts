import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Component, input } from '@angular/core';
import { FormBuilderComponent } from './form-builder.component';
import { FormFieldRegistry } from '../services/form-field-registry.service';
import type { FormSchema } from '../types/form-schema.types';

// Minimal stub for field renderer — the form builder doesn't render fields directly,
// it delegates to form-field-host which uses NgComponentOutlet
@Component({ selector: 'mcms-test-stub', template: '' })
class StubFieldComponent {
	readonly field = input<unknown>(null);
	readonly formNode = input<unknown>(null);
}

function createSchema(overrides: Partial<FormSchema> = {}): FormSchema {
	return {
		id: 'test-form',
		title: 'Test Form',
		fields: [
			{ name: 'name', type: 'text', label: 'Name', required: true },
			{ name: 'email', type: 'email', label: 'Email' },
		],
		...overrides,
	};
}

describe('FormBuilderComponent', () => {
	let fixture: ComponentFixture<FormBuilderComponent>;
	let component: FormBuilderComponent;
	let registry: FormFieldRegistry;

	beforeEach(() => {
		TestBed.configureTestingModule({
			imports: [FormBuilderComponent],
		});

		// Register stub renderers for all field types used in tests
		registry = TestBed.inject(FormFieldRegistry);
		for (const type of [
			'text',
			'email',
			'textarea',
			'select',
			'checkbox',
			'radio',
			'number',
			'date',
			'hidden',
		]) {
			registry.register(type, () => Promise.resolve(StubFieldComponent));
		}
	});

	function createComponent(schema: FormSchema): void {
		fixture = TestBed.createComponent(FormBuilderComponent);
		fixture.componentRef.setInput('schema', schema);
		fixture.detectChanges();
		component = fixture.componentInstance;
	}

	it('should create', () => {
		createComponent(createSchema());
		expect(component).toBeTruthy();
	});

	it('should create form tree from schema', () => {
		createComponent(createSchema());
		expect(component.formTree()).not.toBeNull();
	});

	it('should render title when provided', () => {
		createComponent(createSchema({ title: 'Contact Us' }));
		const el = fixture.nativeElement as HTMLElement;
		const heading = el.querySelector('h2');
		expect(heading?.textContent).toContain('Contact Us');
	});

	it('should not render title when not provided', () => {
		createComponent(createSchema({ title: undefined }));
		const el = fixture.nativeElement as HTMLElement;
		const heading = el.querySelector('h2');
		expect(heading).toBeNull();
	});

	it('should render description when provided', () => {
		createComponent(createSchema({ description: 'Fill this out' }));
		const el = fixture.nativeElement as HTMLElement;
		const paragraph = el.querySelector('p');
		expect(paragraph?.textContent).toContain('Fill this out');
	});

	it('should use default submit label when not configured', () => {
		createComponent(createSchema());
		expect(component.submitLabel()).toBe('Submit');
	});

	it('should use custom submit label from settings', () => {
		createComponent(
			createSchema({
				settings: { submitLabel: 'Send Message' },
			}),
		);
		expect(component.submitLabel()).toBe('Send Message');
	});

	it('should use default success message', () => {
		createComponent(createSchema());
		expect(component.successMessage()).toBe('Thank you for your submission!');
	});

	it('should use custom success message from settings', () => {
		createComponent(
			createSchema({
				settings: { successMessage: 'Got it!' },
			}),
		);
		expect(component.successMessage()).toBe('Got it!');
	});

	it('should compute visible fields (no conditions = all visible)', () => {
		createComponent(createSchema());
		expect(component.visibleFields().length).toBe(2);
	});

	it('should filter fields by conditions', () => {
		createComponent(
			createSchema({
				fields: [
					{
						name: 'type',
						type: 'select',
						label: 'Type',
						options: [
							{ label: 'A', value: 'a' },
							{ label: 'B', value: 'b' },
						],
					},
					{
						name: 'details',
						type: 'text',
						label: 'Details',
						conditions: [{ field: 'type', operator: 'equals', value: 'b' }],
					},
				],
			}),
		);
		// Initial model has type='', so condition 'type equals b' is false
		const visible = component.visibleFields();
		expect(visible.length).toBe(1);
		expect(visible[0].name).toBe('type');
	});

	it('should return width class for field config', () => {
		createComponent(createSchema());
		expect(component.getWidthClass({ name: 'x', type: 'text' })).toBe('w-full');
		expect(component.getWidthClass({ name: 'x', type: 'text', width: 'half' })).toBe(
			'w-full md:w-1/2',
		);
		expect(component.getWidthClass({ name: 'x', type: 'text', width: 'third' })).toBe(
			'w-full md:w-1/3',
		);
	});

	it('should return form node for a field name', () => {
		createComponent(createSchema());
		const node = component.getFormNode('name');
		expect(node).not.toBeNull();
	});

	it('should return null for unknown field name', () => {
		createComponent(createSchema());
		const node = component.getFormNode('nonexistent');
		expect(node).toBeNull();
	});

	it('should have submitting=false initially', () => {
		createComponent(createSchema());
		expect(component.submitting()).toBe(false);
	});

	it('should have submitted=false initially', () => {
		createComponent(createSchema());
		expect(component.submitted()).toBe(false);
	});

	it('should render submit button', () => {
		createComponent(createSchema());
		const el = fixture.nativeElement as HTMLElement;
		const button = el.querySelector('button[type="submit"]');
		expect(button).not.toBeNull();
		expect(button?.textContent?.trim()).toBe('Submit');
	});

	it('should not show honeypot by default', () => {
		createComponent(createSchema());
		const el = fixture.nativeElement as HTMLElement;
		const hp = el.querySelector('input[name="_hp_field"]');
		expect(hp).toBeNull();
	});

	it('should show honeypot when enabled', () => {
		fixture = TestBed.createComponent(FormBuilderComponent);
		fixture.componentRef.setInput('schema', createSchema());
		fixture.componentRef.setInput('showHoneypot', true);
		fixture.detectChanges();
		const el = fixture.nativeElement as HTMLElement;
		const hp = el.querySelector('input[name="_hp_field"]');
		expect(hp).not.toBeNull();
	});

	it('should include honeypot value in emitted event when filled by a bot', async () => {
		fixture = TestBed.createComponent(FormBuilderComponent);
		fixture.componentRef.setInput(
			'schema',
			createSchema({
				fields: [{ name: 'name', type: 'text', label: 'Name', defaultValue: 'John' }],
			}),
		);
		fixture.componentRef.setInput('showHoneypot', true);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
		component = fixture.componentInstance;

		// Simulate a bot filling in the honeypot
		const el = fixture.nativeElement as HTMLElement;
		const hpInput = el.querySelector('input[name="_hp_field"]') as HTMLInputElement;
		expect(hpInput).not.toBeNull();
		hpInput.value = 'bot-filled-this';

		const emitted: Array<{ values: Record<string, unknown>; formId: string }> = [];
		component.formSubmit.subscribe((event: { values: Record<string, unknown>; formId: string }) => {
			emitted.push(event);
		});

		// Call onSubmit directly to avoid FormRoot intercepting the DOM event
		await component.onSubmit(new Event('submit', { cancelable: true }));
		fixture.detectChanges();

		expect(emitted).toHaveLength(1);
		expect(emitted[0].values['_hp_field']).toBe('bot-filled-this');
	});

	it('should NOT include _hp_field when honeypot is disabled', async () => {
		fixture = TestBed.createComponent(FormBuilderComponent);
		fixture.componentRef.setInput(
			'schema',
			createSchema({
				fields: [{ name: 'name', type: 'text', label: 'Name', defaultValue: 'John' }],
			}),
		);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
		component = fixture.componentInstance;

		const emitted: Array<{ values: Record<string, unknown>; formId: string }> = [];
		component.formSubmit.subscribe((event: { values: Record<string, unknown>; formId: string }) => {
			emitted.push(event);
		});

		await component.onSubmit(new Event('submit', { cancelable: true }));
		fixture.detectChanges();

		expect(emitted).toHaveLength(1);
		expect(emitted[0].values).not.toHaveProperty('_hp_field');
	});

	it('should include empty _hp_field when honeypot is enabled but not filled', async () => {
		fixture = TestBed.createComponent(FormBuilderComponent);
		fixture.componentRef.setInput(
			'schema',
			createSchema({
				fields: [{ name: 'name', type: 'text', label: 'Name', defaultValue: 'John' }],
			}),
		);
		fixture.componentRef.setInput('showHoneypot', true);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
		component = fixture.componentInstance;

		const emitted: Array<{ values: Record<string, unknown>; formId: string }> = [];
		component.formSubmit.subscribe((event: { values: Record<string, unknown>; formId: string }) => {
			emitted.push(event);
		});

		await component.onSubmit(new Event('submit', { cancelable: true }));
		fixture.detectChanges();

		expect(emitted).toHaveLength(1);
		// Empty string is falsy — server check `if (body['_hp_field'])` passes through for real users
		expect(!emitted[0].values['_hp_field']).toBe(true);
	});

	it('should rebuild form tree when schema input changes', async () => {
		const schema1 = createSchema({
			id: 'form-1',
			fields: [{ name: 'name', type: 'text', label: 'Name' }],
		});
		const schema2 = createSchema({
			id: 'form-2',
			fields: [
				{ name: 'phone', type: 'text', label: 'Phone' },
				{ name: 'address', type: 'textarea', label: 'Address' },
			],
		});

		// Render first schema
		createComponent(schema1);
		expect(component.formTree()).not.toBeNull();
		expect(component.visibleFields().length).toBe(1);
		expect(component.visibleFields()[0].name).toBe('name');

		// Change schema input
		fixture.componentRef.setInput('schema', schema2);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		// Form tree should be rebuilt with new schema
		expect(component.visibleFields().length).toBe(2);
		expect(component.visibleFields()[0].name).toBe('phone');
		expect(component.visibleFields()[1].name).toBe('address');
		// Should have form nodes for the new fields
		expect(component.getFormNode('phone')).not.toBeNull();
		expect(component.getFormNode('name')).toBeNull();
	});
});
