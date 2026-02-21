import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FieldRendererRegistry } from '../field-renderer-registry.service';
import { provideMomentumFieldRenderers } from '../provide-field-renderers';

/**
 * Extended tests for provideMomentumFieldRenderers.
 *
 * These tests actually EXECUTE the lazy import loaders returned by
 * `registry.get(type)` to cover the `import().then()` expressions
 * that the basic registration tests leave uncovered.
 */

/** All field types that share the text loader */
const TEXT_LOADER_TYPES = ['text', 'textarea', 'email', 'slug'] as const;

/**
 * Each distinct loader mapped to its expected component class name.
 * These are field types that each have their own unique lazy import.
 */
const DISTINCT_LOADER_TYPES = [
	{ type: 'number', expectedName: 'NumberFieldRenderer' },
	{ type: 'select', expectedName: 'SelectFieldRenderer' },
	{ type: 'checkbox', expectedName: 'CheckboxFieldRenderer' },
	{ type: 'date', expectedName: 'DateFieldRenderer' },
	{ type: 'upload', expectedName: 'UploadFieldRenderer' },
	{ type: 'richText', expectedName: 'RichTextFieldRenderer' },
	{ type: 'group', expectedName: 'GroupFieldRenderer' },
	{ type: 'array', expectedName: 'ArrayFieldRenderer' },
	{ type: 'blocks', expectedName: 'BlocksFieldRenderer' },
	{ type: 'blocks-visual', expectedName: 'VisualBlockEditorComponent' },
	{ type: 'relationship', expectedName: 'RelationshipFieldRenderer' },
	{ type: 'tabs', expectedName: 'TabsFieldRenderer' },
	{ type: 'collapsible', expectedName: 'CollapsibleFieldRenderer' },
	{ type: 'row', expectedName: 'RowFieldRenderer' },
] as const;

describe('provideMomentumFieldRenderers lazy loaders', () => {
	let registry: FieldRendererRegistry;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideMomentumFieldRenderers()],
		});
		registry = TestBed.inject(FieldRendererRegistry);
	});

	describe('text loader group (text, textarea, email, slug)', () => {
		it('should all resolve to TextFieldRenderer', async () => {
			for (const fieldType of TEXT_LOADER_TYPES) {
				const loader = registry.get(fieldType);
				expect(loader).toBeDefined();

				const component = await loader!();
				expect(component).toBeDefined();
				expect(typeof component).toBe('function');
				// Angular compiler may prefix class names with '_'
				expect(component.name.replace(/^_/, '')).toBe('TextFieldRenderer');
			}
		});

		it('should resolve to the exact same class reference for all text-group types', async () => {
			const textComponent = await registry.get('text')!();
			const textareaComponent = await registry.get('textarea')!();
			const emailComponent = await registry.get('email')!();
			const slugComponent = await registry.get('slug')!();

			expect(textareaComponent).toBe(textComponent);
			expect(emailComponent).toBe(textComponent);
			expect(slugComponent).toBe(textComponent);
		});
	});

	describe('distinct loader types', () => {
		for (const { type, expectedName } of DISTINCT_LOADER_TYPES) {
			it(`should resolve "${type}" loader to ${expectedName}`, async () => {
				const loader = registry.get(type);
				expect(loader).toBeDefined();

				const component = await loader!();
				expect(component).toBeDefined();
				expect(typeof component).toBe('function');
				// Angular compiler may prefix class names with '_'
				expect(component.name.replace(/^_/, '')).toBe(expectedName);
			});
		}
	});

	describe('all loaders resolve to unique component classes per import', () => {
		it('should resolve each distinct loader to a different component class', async () => {
			const resolved = new Map<string, unknown>();

			for (const { type } of DISTINCT_LOADER_TYPES) {
				const loader = registry.get(type);
				expect(loader).toBeDefined();
				resolved.set(type, await loader!());
			}

			// Also add the shared text component
			resolved.set('text', await registry.get('text')!());

			// Verify that each distinct loader produces a unique class
			const components = [...resolved.values()];
			const uniqueComponents = new Set(components);
			expect(uniqueComponents.size).toBe(components.length);
		});
	});

	describe('loader return type validation', () => {
		it('should return constructor functions (classes) for every registered type', async () => {
			const allTypes = [...TEXT_LOADER_TYPES, ...DISTINCT_LOADER_TYPES.map((entry) => entry.type)];

			for (const fieldType of allTypes) {
				const loader = registry.get(fieldType);
				expect(loader).toBeDefined();

				const component = await loader!();
				expect(component).toBeDefined();
				// Angular components are classes, which are functions with a prototype
				expect(typeof component).toBe('function');
				expect(component.prototype).toBeDefined();
			}
		});
	});
});
