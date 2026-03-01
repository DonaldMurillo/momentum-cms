import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { FormFieldRegistry } from './form-field-registry.service';

@Component({ selector: 'mcms-test-field', template: '' })
class TestFieldComponent {}

describe('FormFieldRegistry', () => {
	let registry: FormFieldRegistry;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		registry = TestBed.inject(FormFieldRegistry);
	});

	it('should be created', () => {
		expect(registry).toBeTruthy();
	});

	it('should register and retrieve a field renderer', () => {
		const loader = () => Promise.resolve(TestFieldComponent);
		registry.register('custom', loader);
		expect(registry.get('custom')).toBe(loader);
	});

	it('should report has() correctly', () => {
		expect(registry.has('text')).toBe(false);
		registry.register('text', () => Promise.resolve(TestFieldComponent));
		expect(registry.has('text')).toBe(true);
	});

	it('should return undefined for unregistered type', () => {
		expect(registry.get('nonexistent')).toBeUndefined();
	});

	it('should allow overriding an existing registration', () => {
		const loader1 = () => Promise.resolve(TestFieldComponent);
		const loader2 = () => Promise.resolve(TestFieldComponent);
		registry.register('text', loader1);
		registry.register('text', loader2);
		expect(registry.get('text')).toBe(loader2);
	});

	it('should resolve the loader to a component', async () => {
		registry.register('test', () => Promise.resolve(TestFieldComponent));
		const loader = registry.get('test');
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test asserts loader exists
		const component = await loader!();
		expect(component).toBe(TestFieldComponent);
	});
});
