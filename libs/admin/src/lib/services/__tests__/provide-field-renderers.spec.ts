import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, Type } from '@angular/core';
import { FieldRendererRegistry } from '../field-renderer-registry.service';
import { provideMomentumFieldRenderers, provideFieldRenderer } from '../provide-field-renderers';

/** All built-in field types that must be registered by provideMomentumFieldRenderers() */
const BUILT_IN_FIELD_TYPES = [
	'text',
	'textarea',
	'email',
	'slug',
	'number',
	'select',
	'checkbox',
	'date',
	'upload',
	'richText',
	'group',
	'array',
	'blocks',
	'blocks-visual',
	'relationship',
	'tabs',
	'collapsible',
	'row',
] as const;

@Component({ selector: 'mcms-test-custom', template: '' })
class StubCustomComponent {}

describe('provideMomentumFieldRenderers', () => {
	let registry: FieldRendererRegistry;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideMomentumFieldRenderers()],
		});
		registry = TestBed.inject(FieldRendererRegistry);
	});

	it('should register all built-in field types', () => {
		for (const fieldType of BUILT_IN_FIELD_TYPES) {
			expect(registry.has(fieldType)).toBe(true);
		}
	});

	it('should register lazy loaders that return promises', () => {
		for (const fieldType of BUILT_IN_FIELD_TYPES) {
			const loader = registry.get(fieldType);
			expect(loader).toBeDefined();
			expect(typeof loader).toBe('function');
		}
	});

	it('should share the same loader for text, textarea, email, and slug', () => {
		const textLoader = registry.get('text');
		expect(registry.get('textarea')).toBe(textLoader);
		expect(registry.get('email')).toBe(textLoader);
		expect(registry.get('slug')).toBe(textLoader);
	});

	it('should use distinct loaders for different field types', () => {
		const textLoader = registry.get('text');
		const numberLoader = registry.get('number');
		const selectLoader = registry.get('select');

		expect(textLoader).not.toBe(numberLoader);
		expect(numberLoader).not.toBe(selectLoader);
	});
});

describe('provideFieldRenderer', () => {
	it('should register a custom field type', () => {
		TestBed.configureTestingModule({
			providers: [
				provideMomentumFieldRenderers(),
				provideFieldRenderer('color', () => Promise.resolve(StubCustomComponent)),
			],
		});
		const registry = TestBed.inject(FieldRendererRegistry);

		expect(registry.has('color')).toBe(true);
	});

	it('should allow custom type to override a built-in type', async () => {
		TestBed.configureTestingModule({
			providers: [
				provideMomentumFieldRenderers(),
				provideFieldRenderer('text', () => Promise.resolve(StubCustomComponent)),
			],
		});
		const registry = TestBed.inject(FieldRendererRegistry);

		const loader = registry.get('text');
		expect(loader).toBeDefined();

		const component = await loader?.();
		expect(component).toBe(StubCustomComponent);
	});

	it('should resolve custom loader to the actual component type', async () => {
		TestBed.configureTestingModule({
			providers: [
				provideFieldRenderer('custom', () => Promise.resolve(StubCustomComponent as Type<unknown>)),
			],
		});
		const registry = TestBed.inject(FieldRendererRegistry);

		const loader = registry.get('custom');
		expect(loader).toBeDefined();

		const resolved = await loader?.();
		expect(resolved).toBe(StubCustomComponent);
	});
});
