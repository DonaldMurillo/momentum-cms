import { describe, it, expect } from 'vitest';
import type { CollectionConfig, BlockConfig, Field } from '@momentumcms/core';
import {
	isRecord,
	getFieldNodeState,
	getSubNode,
	getFieldDefaultValue,
	normalizeBlockDefaults,
	getTitleField,
	getValueAtPath,
	createInitialFormData,
} from '../entity-form.types';
import {
	createMockField,
	createMockFieldNodeState,
} from '../field-renderers/__tests__/test-helpers';

describe('entity-form.types', () => {
	// ── isRecord ──────────────────────────────────────────────────────────

	describe('isRecord', () => {
		it('should return true for plain objects', () => {
			expect(isRecord({})).toBe(true);
			expect(isRecord({ a: 1 })).toBe(true);
			expect(isRecord({ nested: { deep: true } })).toBe(true);
		});

		it('should return false for null', () => {
			expect(isRecord(null)).toBe(false);
		});

		it('should return false for arrays', () => {
			expect(isRecord([])).toBe(false);
			expect(isRecord([1, 2, 3])).toBe(false);
		});

		it('should return false for primitives', () => {
			expect(isRecord(undefined)).toBe(false);
			expect(isRecord(42)).toBe(false);
			expect(isRecord('string')).toBe(false);
			expect(isRecord(true)).toBe(false);
		});
	});

	// ── getFieldNodeState ─────────────────────────────────────────────────

	describe('getFieldNodeState', () => {
		it('should return null for null', () => {
			expect(getFieldNodeState(null)).toBeNull();
		});

		it('should return null for non-function', () => {
			expect(getFieldNodeState('not a function')).toBeNull();
			expect(getFieldNodeState(42)).toBeNull();
			expect(getFieldNodeState({ key: 'value' })).toBeNull();
		});

		it('should call the function and return result', () => {
			const { state, node } = createMockFieldNodeState('hello');
			const result = getFieldNodeState(node);
			expect(result).toBe(state);
		});
	});

	// ── getSubNode ────────────────────────────────────────────────────────

	describe('getSubNode', () => {
		it('should return null for null parent', () => {
			expect(getSubNode(null, 'key')).toBeNull();
			expect(getSubNode(undefined, 'key')).toBeNull();
		});

		it('should return sub-node by string key', () => {
			const parent = { title: 'Hello', content: 'World' };
			expect(getSubNode(parent, 'title')).toBe('Hello');
			expect(getSubNode(parent, 'content')).toBe('World');
		});

		it('should return sub-node by numeric key', () => {
			const parent = { '0': 'first', '1': 'second' };
			expect(getSubNode(parent, 0)).toBe('first');
			expect(getSubNode(parent, 1)).toBe('second');
		});

		it('should return null for missing key', () => {
			const parent = { title: 'Hello' };
			expect(getSubNode(parent, 'missing')).toBeNull();
		});
	});

	// ── getFieldDefaultValue ──────────────────────────────────────────────

	describe('getFieldDefaultValue', () => {
		it('should return defaultValue when set', () => {
			const field = createMockField('text', { name: 'title', defaultValue: 'My Default' });
			expect(getFieldDefaultValue(field)).toBe('My Default');
		});

		it('should return empty string for text', () => {
			const field = createMockField('text', { name: 'title' });
			expect(getFieldDefaultValue(field)).toBe('');
		});

		it('should return empty string for textarea', () => {
			const field = createMockField('textarea', { name: 'body' });
			expect(getFieldDefaultValue(field)).toBe('');
		});

		it('should return empty string for email', () => {
			const field = createMockField('email', { name: 'email' });
			expect(getFieldDefaultValue(field)).toBe('');
		});

		it('should return null for number', () => {
			const field = createMockField('number', { name: 'count' });
			expect(getFieldDefaultValue(field)).toBeNull();
		});

		it('should return false for checkbox', () => {
			const field = createMockField('checkbox', { name: 'published' });
			expect(getFieldDefaultValue(field)).toBe(false);
		});

		it('should return null for select', () => {
			const field = createMockField('select', { name: 'status' });
			expect(getFieldDefaultValue(field)).toBeNull();
		});

		it('should return null for date', () => {
			const field = createMockField('date', { name: 'createdAt' });
			expect(getFieldDefaultValue(field)).toBeNull();
		});

		it('should return empty array for array', () => {
			const field = createMockField('array', { name: 'items' });
			expect(getFieldDefaultValue(field)).toEqual([]);
		});

		it('should return null for relationship', () => {
			const field = createMockField('relationship', { name: 'author' });
			expect(getFieldDefaultValue(field)).toBeNull();
		});

		it('should return empty object for json', () => {
			const field = createMockField('json', { name: 'metadata' });
			expect(getFieldDefaultValue(field)).toEqual({});
		});

		it('should return group defaults recursively', () => {
			const field = createMockField('group', {
				name: 'address',
				fields: [
					createMockField('text', { name: 'street' }),
					createMockField('number', { name: 'zip' }),
					createMockField('checkbox', { name: 'primary' }),
				],
			} as Partial<Field>);

			expect(getFieldDefaultValue(field)).toEqual({
				street: '',
				zip: null,
				primary: false,
			});
		});

		it('should return null for unknown type', () => {
			const field = createMockField('unknownType' as string, { name: 'mystery' });
			expect(getFieldDefaultValue(field)).toBeNull();
		});
	});

	// ── normalizeBlockDefaults ────────────────────────────────────────────

	describe('normalizeBlockDefaults', () => {
		function createBlockDefMap(
			...entries: Array<{ slug: string; fields: ReturnType<typeof createMockField>[] }>
		): Map<string, BlockConfig> {
			const map = new Map<string, BlockConfig>();
			for (const entry of entries) {
				map.set(entry.slug, {
					slug: entry.slug,
					fields: entry.fields,
				} as BlockConfig);
			}
			return map;
		}

		it('should not change blocks with all fields', () => {
			const blockDefMap = createBlockDefMap({
				slug: 'hero',
				fields: [createMockField('text', { name: 'heading' })],
			});

			const items = [{ blockType: 'hero', heading: 'Welcome' }];
			const result = normalizeBlockDefaults(items, blockDefMap);

			expect(result.changed).toBe(false);
			expect(result.normalized).toEqual([{ blockType: 'hero', heading: 'Welcome' }]);
		});

		it('should add missing fields with defaults', () => {
			const blockDefMap = createBlockDefMap({
				slug: 'hero',
				fields: [
					createMockField('text', { name: 'heading' }),
					createMockField('checkbox', { name: 'fullWidth' }),
				],
			});

			const items = [{ blockType: 'hero', heading: 'Welcome' }];
			const result = normalizeBlockDefaults(items, blockDefMap);

			expect(result.changed).toBe(true);
			expect(result.normalized).toEqual([
				{ blockType: 'hero', heading: 'Welcome', fullWidth: false },
			]);
		});

		it('should skip non-record items', () => {
			const blockDefMap = createBlockDefMap({
				slug: 'hero',
				fields: [createMockField('text', { name: 'heading' })],
			});

			const items = ['not-an-object', 42, null];
			const result = normalizeBlockDefaults(items, blockDefMap);

			expect(result.changed).toBe(false);
			expect(result.normalized).toEqual(['not-an-object', 42, null]);
		});

		it('should skip unknown block types', () => {
			const blockDefMap = createBlockDefMap({
				slug: 'hero',
				fields: [createMockField('text', { name: 'heading' })],
			});

			const items = [{ blockType: 'unknown-block', data: 'value' }];
			const result = normalizeBlockDefaults(items, blockDefMap);

			expect(result.changed).toBe(false);
			expect(result.normalized).toEqual([{ blockType: 'unknown-block', data: 'value' }]);
		});

		it('should return changed: false when nothing changes', () => {
			const blockDefMap = createBlockDefMap({
				slug: 'cta',
				fields: [
					createMockField('text', { name: 'label' }),
					createMockField('text', { name: 'url' }),
				],
			});

			const items = [{ blockType: 'cta', label: 'Click', url: '/home' }];
			const result = normalizeBlockDefaults(items, blockDefMap);

			expect(result.changed).toBe(false);
			expect(result.normalized[0]).toBe(items[0]); // Same reference — no copy
		});
	});

	// ── getTitleField ─────────────────────────────────────────────────────

	describe('getTitleField', () => {
		it('should return useAsTitle from admin config', () => {
			const config = {
				admin: { useAsTitle: 'headline' },
				fields: [{ name: 'headline' }],
			};
			expect(getTitleField(config)).toBe('headline');
		});

		it('should fallback to title field', () => {
			const config = {
				fields: [{ name: 'slug' }, { name: 'title' }, { name: 'content' }],
			};
			expect(getTitleField(config)).toBe('title');
		});

		it('should fallback to name field', () => {
			const config = {
				fields: [{ name: 'slug' }, { name: 'name' }, { name: 'content' }],
			};
			expect(getTitleField(config)).toBe('name');
		});

		it('should fallback to id when no match', () => {
			const config = {
				fields: [{ name: 'slug' }, { name: 'content' }],
			};
			expect(getTitleField(config)).toBe('id');
		});
	});

	// ── getValueAtPath ────────────────────────────────────────────────────

	describe('getValueAtPath', () => {
		it('should get value at simple path', () => {
			const obj = { title: 'Hello' };
			expect(getValueAtPath(obj, 'title')).toBe('Hello');
		});

		it('should get value at nested path', () => {
			const obj = { address: { city: 'Berlin', zip: '10115' } };
			expect(getValueAtPath(obj, 'address.city')).toBe('Berlin');
		});

		it('should return undefined for missing path', () => {
			const obj = { title: 'Hello' };
			expect(getValueAtPath(obj, 'missing.deep.path')).toBeUndefined();
		});

		it('should return undefined for null intermediate', () => {
			const obj = { parent: null };
			expect(getValueAtPath(obj, 'parent.child')).toBeUndefined();
		});
	});

	// ── createInitialFormData ─────────────────────────────────────────────

	describe('createInitialFormData', () => {
		it('should create initial data from collection fields', () => {
			const collection = {
				slug: 'posts',
				fields: [
					createMockField('text', { name: 'title' }),
					createMockField('number', { name: 'order' }),
					createMockField('checkbox', { name: 'published' }),
				],
			} as unknown as CollectionConfig;

			const result = createInitialFormData(collection);

			expect(result).toEqual({
				title: '',
				order: null,
				published: false,
			});
		});
	});
});
