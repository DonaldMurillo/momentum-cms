/**
 * Tests for field-level access control.
 *
 * Covers `hasFieldAccessControl`, `filterReadableFields`,
 * `filterCreatableFields`, and `filterUpdatableFields`.
 */
import { describe, it, expect } from 'vitest';
import type { Field, RequestContext } from '@momentumcms/core';
import {
	hasFieldAccessControl,
	filterReadableFields,
	filterCreatableFields,
	filterUpdatableFields,
} from './field-access';

// ============================================
// Helpers
// ============================================

const mockReq: RequestContext = { user: undefined };

/**
 * Build a deeply-nested group field structure.
 * Returns an array of fields whose nesting depth equals `levels`.
 * The innermost level contains `inner` fields.
 */
function nestGroupFields(levels: number, inner: Field[]): Field[] {
	if (levels <= 0) return inner;
	return [{ name: `group${levels}`, type: 'group', fields: nestGroupFields(levels - 1, inner) }];
}

/**
 * Build a deeply-nested array field structure.
 */
function nestArrayFields(levels: number, inner: Field[]): Field[] {
	if (levels <= 0) return inner;
	return [{ name: `arr${levels}`, type: 'array', fields: nestArrayFields(levels - 1, inner) }];
}

/**
 * Build a deeply-nested data object matching the nestGroupFields structure.
 * `levels` group wrappers around a final `{ [innerName]: innerValue }` leaf.
 */
function buildNestedGroupData(
	levels: number,
	innerName: string,
	innerValue: unknown,
): Record<string, unknown> {
	if (levels <= 0) return { [innerName]: innerValue };
	return { [`group${levels}`]: buildNestedGroupData(levels - 1, innerName, innerValue) };
}

/**
 * Build a deeply-nested data object matching the nestArrayFields structure.
 * Array fields contain arrays of rows, so each level wraps in `[{ ... }]`.
 */
function buildNestedArrayData(
	levels: number,
	innerName: string,
	innerValue: unknown,
): Record<string, unknown> {
	if (levels <= 0) return { [innerName]: innerValue };
	return { [`arr${levels}`]: [buildNestedArrayData(levels - 1, innerName, innerValue)] };
}

// ============================================
// hasFieldAccessControl
// ============================================

describe('hasFieldAccessControl', () => {
	it('should return false when no fields have access control', () => {
		const fields: Field[] = [
			{ name: 'title', type: 'text' },
			{ name: 'content', type: 'textarea' },
		];
		expect(hasFieldAccessControl(fields)).toBe(false);
	});

	it('should return true when a field has access control', () => {
		const fields: Field[] = [
			{ name: 'title', type: 'text' },
			{ name: 'secret', type: 'text', access: { read: () => false } },
		];
		expect(hasFieldAccessControl(fields)).toBe(true);
	});

	it('should return true when access is an empty object (treated as defined)', () => {
		const fields: Field[] = [{ name: 'title', type: 'text', access: {} }];
		// Code smell: `access !== undefined` treats `access: {}` as truthy
		expect(hasFieldAccessControl(fields)).toBe(true);
	});

	it('should return true when access has only create', () => {
		const fields: Field[] = [{ name: 'title', type: 'text', access: { create: () => true } }];
		expect(hasFieldAccessControl(fields)).toBe(true);
	});

	// --- Recursion through field types ---

	it('should recurse into group fields', () => {
		const fields: Field[] = [
			{
				name: 'meta',
				type: 'group',
				fields: [{ name: 'secret', type: 'text', access: { read: () => false } }],
			},
		];
		expect(hasFieldAccessControl(fields)).toBe(true);
	});

	it('should return false for group fields without access control', () => {
		const fields: Field[] = [
			{
				name: 'meta',
				type: 'group',
				fields: [{ name: 'label', type: 'text' }],
			},
		];
		expect(hasFieldAccessControl(fields)).toBe(false);
	});

	it('should recurse into array fields', () => {
		const fields: Field[] = [
			{
				name: 'items',
				type: 'array',
				fields: [{ name: 'value', type: 'text', access: { read: () => true } }],
			},
		];
		expect(hasFieldAccessControl(fields)).toBe(true);
	});

	it('should recurse into blocks fields', () => {
		const fields: Field[] = [
			{
				name: 'content',
				type: 'blocks',
				blocks: [
					{
						slug: 'text',
						fields: [{ name: 'body', type: 'text', access: { read: () => false } }],
					},
				],
			},
		];
		expect(hasFieldAccessControl(fields)).toBe(true);
	});

	it('should return false for blocks fields without access control', () => {
		const fields: Field[] = [
			{
				name: 'content',
				type: 'blocks',
				blocks: [{ slug: 'text', fields: [{ name: 'body', type: 'text' }] }],
			},
		];
		expect(hasFieldAccessControl(fields)).toBe(false);
	});

	it('should recurse into tabs fields', () => {
		const fields: Field[] = [
			{
				name: 'tabs',
				type: 'tabs',
				tabs: [
					{
						label: 'Secrets',
						fields: [{ name: 'hidden', type: 'text', access: { read: () => false } }],
					},
				],
			},
		];
		expect(hasFieldAccessControl(fields)).toBe(true);
	});

	it('should recurse into collapsible fields', () => {
		const fields: Field[] = [
			{
				name: 'section',
				type: 'collapsible',
				fields: [{ name: 'data', type: 'text', access: { create: () => false } }],
			},
		];
		expect(hasFieldAccessControl(fields)).toBe(true);
	});

	it('should recurse into row fields', () => {
		const fields: Field[] = [
			{
				name: 'row',
				type: 'row',
				fields: [{ name: 'col', type: 'text', access: { update: () => false } }],
			},
		];
		expect(hasFieldAccessControl(fields)).toBe(true);
	});

	// --- Depth overflow (SECURITY) ---

	it('should return false on depth overflow when no access control exists', () => {
		// MAX_FIELD_ACCESS_DEPTH is 10; build 12 levels of nesting with NO access control
		// Returns false because no real access control was found before the depth limit
		const fields = nestGroupFields(12, [{ name: 'deep', type: 'text' }]);
		expect(hasFieldAccessControl(fields)).toBe(false);
	});

	it('should return false at exactly depth 10 (within limit)', () => {
		// 10 levels of nesting → depth counter reaches 10 which is NOT > 10
		const fields = nestGroupFields(10, [{ name: 'deep', type: 'text' }]);
		expect(hasFieldAccessControl(fields)).toBe(false);
	});

	it('should return false at depth 11 when no access control exists', () => {
		// 11 levels with no access control → depth overflow, but no access control found
		const fields = nestGroupFields(11, [{ name: 'deep', type: 'text' }]);
		expect(hasFieldAccessControl(fields)).toBe(false);
	});

	it('should return true on depth overflow when access control exists at a shallow level', () => {
		// Access control at the TOP level (outside the deep nesting)
		// → found before recursion hits depth overflow
		const deepFields = nestGroupFields(12, [{ name: 'deep', type: 'text' }]);
		const fields: Field[] = [
			...deepFields,
			{ name: 'guarded', type: 'text', access: { read: () => true } },
		];
		expect(hasFieldAccessControl(fields)).toBe(true);
	});
});

// ============================================
// filterReadableFields
// ============================================

describe('filterReadableFields', () => {
	it('should pass through all fields when no access control is defined', async () => {
		const fields: Field[] = [
			{ name: 'title', type: 'text' },
			{ name: 'content', type: 'textarea' },
		];
		const doc = { title: 'Hello', content: 'World' };
		const result = await filterReadableFields(fields, doc, mockReq);
		expect(result).toEqual({ title: 'Hello', content: 'World' });
	});

	it('should strip fields where access.read returns false', async () => {
		const fields: Field[] = [
			{ name: 'title', type: 'text' },
			{ name: 'secret', type: 'text', access: { read: () => false } },
		];
		const doc = { title: 'Hello', secret: 'classified' };
		const result = await filterReadableFields(fields, doc, mockReq);
		expect(result).toEqual({ title: 'Hello' });
		expect('secret' in result).toBe(false);
	});

	it('should keep fields where access.read returns true', async () => {
		const fields: Field[] = [
			{ name: 'title', type: 'text', access: { read: () => true } },
			{ name: 'content', type: 'textarea' },
		];
		const doc = { title: 'Hello', content: 'World' };
		const result = await filterReadableFields(fields, doc, mockReq);
		expect(result).toEqual({ title: 'Hello', content: 'World' });
	});

	it('should support async access.read functions', async () => {
		const fields: Field[] = [
			{ name: 'title', type: 'text' },
			{ name: 'secret', type: 'text', access: { read: async () => false } },
		];
		const doc = { title: 'Hello', secret: 'classified' };
		const result = await filterReadableFields(fields, doc, mockReq);
		expect(result).toEqual({ title: 'Hello' });
	});

	it('should not strip fields when access is empty object (no read key)', async () => {
		const fields: Field[] = [{ name: 'title', type: 'text', access: {} }];
		const doc = { title: 'Hello' };
		const result = await filterReadableFields(fields, doc, mockReq);
		expect(result).toEqual({ title: 'Hello' });
	});

	// --- Recursion into group ---

	it('should recurse into group fields', async () => {
		const fields: Field[] = [
			{
				name: 'meta',
				type: 'group',
				fields: [
					{ name: 'label', type: 'text' },
					{ name: 'secret', type: 'text', access: { read: () => false } },
				],
			},
		];
		const doc = { meta: { label: 'public', secret: 'hidden' } };
		const result = await filterReadableFields(fields, doc, mockReq);
		expect(result).toEqual({ meta: { label: 'public' } });
	});

	it('should handle missing group data gracefully', async () => {
		const fields: Field[] = [
			{
				name: 'meta',
				type: 'group',
				fields: [{ name: 'label', type: 'text' }],
			},
		];
		const doc = {}; // no meta key
		const result = await filterReadableFields(fields, doc, mockReq);
		expect(result).toEqual({});
	});

	// --- Recursion into array ---

	it('should recurse into array fields and filter each row independently', async () => {
		const fields: Field[] = [
			{
				name: 'items',
				type: 'array',
				fields: [
					{ name: 'label', type: 'text' },
					{ name: 'secret', type: 'text', access: { read: () => false } },
				],
			},
		];
		const doc = {
			items: [
				{ label: 'a', secret: 's1' },
				{ label: 'b', secret: 's2' },
			],
		};
		const result = await filterReadableFields(fields, doc, mockReq);
		expect(result).toEqual({
			items: [{ label: 'a' }, { label: 'b' }],
		});
	});

	it('should handle empty array', async () => {
		const fields: Field[] = [
			{
				name: 'items',
				type: 'array',
				fields: [{ name: 'label', type: 'text' }],
			},
		];
		const doc = { items: [] };
		const result = await filterReadableFields(fields, doc, mockReq);
		expect(result).toEqual({ items: [] });
	});

	// --- Recursion into blocks ---

	it('should recurse into blocks fields with matching blockType', async () => {
		const fields: Field[] = [
			{
				name: 'content',
				type: 'blocks',
				blocks: [
					{
						slug: 'text',
						fields: [
							{ name: 'body', type: 'text' },
							{ name: 'hidden', type: 'text', access: { read: () => false } },
						],
					},
				],
			},
		];
		const doc = {
			content: [{ blockType: 'text', body: 'visible', hidden: 'secret' }],
		};
		const result = await filterReadableFields(fields, doc, mockReq);
		expect(result).toEqual({
			content: [{ blockType: 'text', body: 'visible' }],
		});
	});

	it('should pass through block rows with missing blockType unchanged', async () => {
		const fields: Field[] = [
			{
				name: 'content',
				type: 'blocks',
				blocks: [{ slug: 'text', fields: [{ name: 'body', type: 'text' }] }],
			},
		];
		const doc = {
			content: [{ body: 'no blockType' }],
		};
		const result = await filterReadableFields(fields, doc, mockReq);
		expect(result).toEqual({ content: [{ body: 'no blockType' }] });
	});

	it('should pass through block rows with unknown blockType unchanged', async () => {
		const fields: Field[] = [
			{
				name: 'content',
				type: 'blocks',
				blocks: [{ slug: 'text', fields: [{ name: 'body', type: 'text' }] }],
			},
		];
		const doc = {
			content: [{ blockType: 'unknown', body: 'mystery' }],
		};
		const result = await filterReadableFields(fields, doc, mockReq);
		expect(result).toEqual({ content: [{ blockType: 'unknown', body: 'mystery' }] });
	});

	// --- Depth overflow (SECURITY) ---

	it('should throw ValidationError on depth overflow instead of silently stripping fields', async () => {
		// With 12 levels of nesting, the guard fires at depth 11 when recursing
		// into group2's fields. Previously this silently returned {}, now it throws.
		const fields = nestGroupFields(12, [{ name: 'deep', type: 'text' }]);
		const doc = buildNestedGroupData(12, 'deep', 'value');
		await expect(filterReadableFields(fields, doc, mockReq)).rejects.toThrow(
			'Field nesting depth exceeds maximum of 10 levels',
		);
	});

	it('should still filter normally at exactly depth 10', async () => {
		const inner: Field[] = [
			{ name: 'visible', type: 'text' },
			{ name: 'hidden', type: 'text', access: { read: () => false } },
		];
		// 9 levels of group nesting + the top-level call = depth 9 for the innermost fields
		// Each group recursion adds 1, so with 9 levels, the deepest _depth is 9 (< 10)
		const fields = nestGroupFields(9, inner);
		const doc = {
			group9: {
				group8: {
					group7: {
						group6: {
							group5: {
								group4: { group3: { group2: { group1: { visible: 'yes', hidden: 'secret' } } } },
							},
						},
					},
				},
			},
		};
		const result = await filterReadableFields(fields, doc, mockReq);
		// Navigate to innermost level: group9.group8...group1
		let deepest: unknown = result;
		for (let i = 9; i >= 1; i--) deepest = (deepest as Record<string, unknown>)?.[`group${i}`];
		// At depth 9, the inner fields should still be filtered normally:
		// 'visible' survives, 'hidden' is stripped
		expect(deepest).toEqual({ visible: 'yes' });
	});
});

// ============================================
// filterCreatableFields
// ============================================

describe('filterCreatableFields', () => {
	it('should strip fields where access.create returns false', async () => {
		const fields: Field[] = [
			{ name: 'title', type: 'text' },
			{ name: 'adminOnly', type: 'text', access: { create: () => false } },
		];
		const data = { title: 'Hello', adminOnly: 'should be removed' };
		const result = await filterCreatableFields(fields, data, mockReq);
		expect(result).toEqual({ title: 'Hello' });
	});

	it('should keep fields where access.create returns true', async () => {
		const fields: Field[] = [{ name: 'title', type: 'text', access: { create: () => true } }];
		const data = { title: 'Hello' };
		const result = await filterCreatableFields(fields, data, mockReq);
		expect(result).toEqual({ title: 'Hello' });
	});

	it('should pass through fields without access control', async () => {
		const fields: Field[] = [{ name: 'title', type: 'text' }];
		const data = { title: 'Hello' };
		const result = await filterCreatableFields(fields, data, mockReq);
		expect(result).toEqual({ title: 'Hello' });
	});

	it('should support async access.create functions', async () => {
		const fields: Field[] = [
			{ name: 'title', type: 'text' },
			{ name: 'restricted', type: 'text', access: { create: async () => false } },
		];
		const data = { title: 'Hello', restricted: 'value' };
		const result = await filterCreatableFields(fields, data, mockReq);
		expect(result).toEqual({ title: 'Hello' });
	});
});

// ============================================
// filterUpdatableFields
// ============================================

describe('filterUpdatableFields', () => {
	it('should strip fields where access.update returns false', async () => {
		const fields: Field[] = [
			{ name: 'title', type: 'text' },
			{ name: 'immutable', type: 'text', access: { update: () => false } },
		];
		const data = { title: 'Updated', immutable: 'should be removed' };
		const result = await filterUpdatableFields(fields, data, mockReq);
		expect(result).toEqual({ title: 'Updated' });
	});

	it('should keep fields where access.update returns true', async () => {
		const fields: Field[] = [{ name: 'title', type: 'text', access: { update: () => true } }];
		const data = { title: 'Updated' };
		const result = await filterUpdatableFields(fields, data, mockReq);
		expect(result).toEqual({ title: 'Updated' });
	});

	it('should pass through fields without access control', async () => {
		const fields: Field[] = [{ name: 'title', type: 'text' }];
		const data = { title: 'Updated' };
		const result = await filterUpdatableFields(fields, data, mockReq);
		expect(result).toEqual({ title: 'Updated' });
	});
});

// ============================================
// Depth overflow — writable path
// ============================================

describe('filterWritableFields depth overflow', () => {
	it('should throw ValidationError on depth overflow for create', async () => {
		const fields = nestGroupFields(12, [{ name: 'deep', type: 'text' }]);
		const data = buildNestedGroupData(12, 'deep', 'value');
		await expect(filterCreatableFields(fields, data, mockReq)).rejects.toThrow(
			'Field nesting depth exceeds maximum of 10 levels',
		);
	});

	it('should throw ValidationError on depth overflow for update', async () => {
		const fields = nestGroupFields(12, [{ name: 'deep', type: 'text' }]);
		const data = buildNestedGroupData(12, 'deep', 'value');
		await expect(filterUpdatableFields(fields, data, mockReq)).rejects.toThrow(
			'Field nesting depth exceeds maximum of 10 levels',
		);
	});

	it('should throw ValidationError on depth overflow with array nesting', async () => {
		const fields = nestArrayFields(12, [{ name: 'deep', type: 'text' }]);
		const data = buildNestedArrayData(12, 'deep', 'value');
		await expect(filterCreatableFields(fields, data, mockReq)).rejects.toThrow(
			'Field nesting depth exceeds maximum of 10 levels',
		);
	});
});

// ============================================
// Interaction: hasFieldAccessControl + filterReadableFields
// ============================================

describe('security chain: hasFieldAccessControl + filterReadableFields', () => {
	it('depth overflow with no access control: hasFieldAccessControl returns false, caller skips filter', () => {
		const fields = nestGroupFields(12, [{ name: 'deep', type: 'text' }]);

		// No access control → hasFieldAccessControl returns false
		// Callers like processAfterReadHooks will skip the filter path entirely
		expect(hasFieldAccessControl(fields)).toBe(false);
	});

	it('depth overflow with access control: hasFieldAccessControl returns true, filter throws', async () => {
		// Access control at the TOP level → found before recursion hits depth overflow
		const deepFields = nestGroupFields(12, [{ name: 'deep', type: 'text' }]);
		const fields: Field[] = [
			...deepFields,
			{ name: 'guarded', type: 'text', access: { read: () => true } },
		];

		// hasFieldAccessControl finds real access control and returns true
		expect(hasFieldAccessControl(fields)).toBe(true);

		// The filter path is entered, and it throws on depth overflow
		const doc = buildNestedGroupData(12, 'deep', 'leaked');
		await expect(filterReadableFields(fields, doc, mockReq)).rejects.toThrow(
			'Field nesting depth exceeds maximum of 10 levels',
		);
	});

	it('no access control: hasFieldAccessControl returns false, no filtering needed', async () => {
		const fields: Field[] = [{ name: 'title', type: 'text' }];
		expect(hasFieldAccessControl(fields)).toBe(false);
		// Caller would skip filterReadableFields entirely
	});

	it('access control present: hasFieldAccessControl returns true, filter strips denied fields', async () => {
		const fields: Field[] = [
			{ name: 'title', type: 'text' },
			{ name: 'secret', type: 'text', access: { read: () => false } },
		];
		expect(hasFieldAccessControl(fields)).toBe(true);

		const doc = { title: 'Hello', secret: 'classified' };
		const result = await filterReadableFields(fields, doc, mockReq);
		expect(result).toEqual({ title: 'Hello' });
	});
});

// ============================================
// Edge case: access.read receives correct args
// ============================================

describe('filterReadableFields access function args', () => {
	it('should pass req and doc to access.read', async () => {
		const receivedArgs: Array<{ req: unknown; doc: unknown }> = [];
		const fields: Field[] = [
			{
				name: 'title',
				type: 'text',
				access: {
					read: (args) => {
						receivedArgs.push({ req: args.req, doc: args.doc });
						return true;
					},
				},
			},
		];
		const doc = { title: 'Hello' };
		const userReq: RequestContext = { user: { id: 'u1' } };
		await filterReadableFields(fields, doc, userReq);

		expect(receivedArgs).toHaveLength(1);
		expect(receivedArgs[0]?.req).toBe(userReq);
		expect(receivedArgs[0]?.doc).toEqual(doc);
	});
});

// ============================================
// Edge case: writable access omits doc (known code smell)
// ============================================

describe('filterCreatableFields/UpdatableFields access function args', () => {
	it('should pass req and data to access.create (doc is undefined — known smell)', async () => {
		const receivedArgs: Array<{ req: unknown; data: unknown; doc: unknown }> = [];
		const fields: Field[] = [
			{
				name: 'title',
				type: 'text',
				access: {
					create: (args) => {
						receivedArgs.push({ req: args.req, data: args.data, doc: args.doc });
						return true;
					},
				},
			},
		];
		const data = { title: 'New' };
		await filterCreatableFields(fields, data, mockReq);

		expect(receivedArgs).toHaveLength(1);
		expect(receivedArgs[0]?.req).toBe(mockReq);
		expect(receivedArgs[0]?.data).toEqual(data);
		// Known code smell: doc is always undefined for writable operations
		expect(receivedArgs[0]?.doc).toBeUndefined();
	});
});
