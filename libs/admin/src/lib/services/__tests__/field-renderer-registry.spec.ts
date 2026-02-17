import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, Type } from '@angular/core';
import { FieldRendererRegistry } from '../field-renderer-registry.service';

// Minimal stub components for testing lazy resolution
@Component({ selector: 'mcms-test-text', template: '' })
class StubTextComponent {}

@Component({ selector: 'mcms-test-number', template: '' })
class StubNumberComponent {}

describe('FieldRendererRegistry', () => {
	let registry: FieldRendererRegistry;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		registry = TestBed.inject(FieldRendererRegistry);
	});

	it('should be created as a singleton', () => {
		expect(registry).toBeTruthy();
		const second = TestBed.inject(FieldRendererRegistry);
		expect(second).toBe(registry);
	});

	it('should register and retrieve a loader by type', () => {
		const loader = (): Promise<Type<unknown>> => Promise.resolve(StubTextComponent);
		registry.register('text', loader);

		const retrieved = registry.get('text');
		expect(retrieved).toBe(loader);
	});

	it('should return undefined for unregistered types', () => {
		expect(registry.get('nonexistent')).toBeUndefined();
	});

	it('should report has() correctly', () => {
		expect(registry.has('text')).toBe(false);

		registry.register('text', () => Promise.resolve(StubTextComponent));

		expect(registry.has('text')).toBe(true);
		expect(registry.has('number')).toBe(false);
	});

	it('should allow later registrations to override earlier ones', () => {
		const firstLoader = (): Promise<Type<unknown>> => Promise.resolve(StubTextComponent);
		const secondLoader = (): Promise<Type<unknown>> => Promise.resolve(StubNumberComponent);

		registry.register('custom', firstLoader);
		expect(registry.get('custom')).toBe(firstLoader);

		registry.register('custom', secondLoader);
		expect(registry.get('custom')).toBe(secondLoader);
	});

	it('should resolve lazy loaders to the actual component type', async () => {
		registry.register('text', () => Promise.resolve(StubTextComponent));

		const loader = registry.get('text');
		expect(loader).toBeDefined();

		const component = await loader!();
		expect(component).toBe(StubTextComponent);
	});

	it('should support multiple independent field type registrations', () => {
		registry.register('text', () => Promise.resolve(StubTextComponent));
		registry.register('number', () => Promise.resolve(StubNumberComponent));

		expect(registry.has('text')).toBe(true);
		expect(registry.has('number')).toBe(true);
		expect(registry.has('select')).toBe(false);
	});
});
