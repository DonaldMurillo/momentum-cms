import { describe, it, expect } from 'vitest';
import { hasFieldHooks, runFieldHooks } from './field-hooks';
import type { Field, RequestContext } from '@momentumcms/core';

const mockReq = {} as RequestContext;

// ============================================
// hasFieldHooks
// ============================================

describe('hasFieldHooks', () => {
	it('should return false when no fields have hooks', () => {
		const fields: Field[] = [
			{ name: 'title', type: 'text' },
			{ name: 'content', type: 'textarea' },
		];
		expect(hasFieldHooks(fields)).toBe(false);
	});

	it('should return true when a field has hooks', () => {
		const fields: Field[] = [
			{
				name: 'title',
				type: 'text',
				hooks: {
					beforeValidate: [() => undefined],
				},
			},
		];
		expect(hasFieldHooks(fields)).toBe(true);
	});

	it('should detect hooks in nested group fields', () => {
		const fields: Field[] = [
			{
				name: 'meta',
				type: 'group',
				fields: [
					{
						name: 'slug',
						type: 'text',
						hooks: { beforeChange: [({ value }) => value] },
					},
				],
			},
		];
		expect(hasFieldHooks(fields)).toBe(true);
	});

	it('should detect hooks in nested array fields', () => {
		const fields: Field[] = [
			{
				name: 'items',
				type: 'array',
				fields: [
					{
						name: 'label',
						type: 'text',
						hooks: { afterRead: [({ value }) => value] },
					},
				],
			},
		];
		expect(hasFieldHooks(fields)).toBe(true);
	});

	it('should detect hooks in nested block fields', () => {
		const fields: Field[] = [
			{
				name: 'content',
				type: 'blocks',
				blocks: [
					{
						slug: 'text-block',
						fields: [
							{
								name: 'body',
								type: 'textarea',
								hooks: { beforeValidate: [({ value }) => value] },
							},
						],
					},
				],
			},
		];
		expect(hasFieldHooks(fields)).toBe(true);
	});

	it('should detect hooks in tab fields', () => {
		const fields: Field[] = [
			{
				type: 'tabs',
				tabs: [
					{
						name: 'seo',
						fields: [
							{
								name: 'metaTitle',
								type: 'text',
								hooks: { beforeChange: [({ value }) => value] },
							},
						],
					},
				],
			},
		];
		expect(hasFieldHooks(fields)).toBe(true);
	});

	it('should detect hooks in collapsible fields', () => {
		const fields: Field[] = [
			{
				type: 'collapsible',
				label: 'Advanced',
				fields: [
					{
						name: 'secret',
						type: 'text',
						hooks: { afterChange: [({ value }) => value] },
					},
				],
			},
		];
		expect(hasFieldHooks(fields)).toBe(true);
	});

	it('should detect hooks in row fields', () => {
		const fields: Field[] = [
			{
				type: 'row',
				fields: [
					{
						name: 'firstName',
						type: 'text',
						hooks: { beforeValidate: [({ value }) => value] },
					},
				],
			},
		];
		expect(hasFieldHooks(fields)).toBe(true);
	});

	it('should return false for empty blocks array', () => {
		const fields: Field[] = [
			{
				name: 'content',
				type: 'blocks',
				blocks: [],
			},
		];
		expect(hasFieldHooks(fields)).toBe(false);
	});

	it('should not detect hooks in unnamed tabs', () => {
		const fields: Field[] = [
			{
				type: 'tabs',
				tabs: [
					{
						label: 'General',
						fields: [{ name: 'title', type: 'text' }],
					},
				],
			},
		];
		expect(hasFieldHooks(fields)).toBe(false);
	});

	it('should return false for deeply nested fields without stack overflow (depth guard)', () => {
		// Create a deeply nested group chain: 12 levels, no hooks
		function nestGroups(levels: number, inner: Field[]): Field[] {
			if (levels <= 0) return inner;
			return [{ name: `g${levels}`, type: 'group', fields: nestGroups(levels - 1, inner) }];
		}

		// 12 levels of group nesting — exceeds MAX_FIELD_HOOK_DEPTH (10)
		const fields = nestGroups(12, [{ name: 'deep', type: 'text' }]);

		// Should return false safely without stack overflow
		expect(hasFieldHooks(fields)).toBe(false);
	});

	it('should return false for deeply nested fields with hooks beyond depth limit', () => {
		// Even if there IS a hook at depth 12, the depth guard prevents reaching it
		function nestGroupsWithHook(levels: number): Field[] {
			if (levels <= 0) {
				return [
					{
						name: 'deep',
						type: 'text',
						hooks: { beforeValidate: [() => undefined] },
					},
				];
			}
			return [{ name: `g${levels}`, type: 'group', fields: nestGroupsWithHook(levels - 1) }];
		}

		// Hook exists at depth 12, but depth guard stops at 10
		const fields = nestGroupsWithHook(12);

		// Should return false because the depth guard prevents reaching the hook
		expect(hasFieldHooks(fields)).toBe(false);
	});

	it('should detect hooks within the depth limit', () => {
		// Hook at depth 5 — within the limit
		function nestGroups(levels: number, inner: Field[]): Field[] {
			if (levels <= 0) return inner;
			return [{ name: `g${levels}`, type: 'group', fields: nestGroups(levels - 1, inner) }];
		}

		const fields = nestGroups(5, [
			{
				name: 'deep',
				type: 'text',
				hooks: { beforeValidate: [() => undefined] },
			},
		]);

		expect(hasFieldHooks(fields)).toBe(true);
	});
});

// ============================================
// runFieldHooks — core behavior
// ============================================

describe('runFieldHooks', () => {
	it('should pass through data unchanged when no hooks match the type', async () => {
		const fields: Field[] = [
			{
				name: 'title',
				type: 'text',
				hooks: { afterRead: [({ value }) => `${value} (read)`] },
			},
		];
		const data = { title: 'Hello' };
		const result = await runFieldHooks('beforeValidate', fields, data, mockReq, 'create');
		expect(result).toEqual({ title: 'Hello' });
	});

	it('should transform field value via hook', async () => {
		const fields: Field[] = [
			{
				name: 'title',
				type: 'text',
				hooks: {
					beforeValidate: [({ value }) => (typeof value === 'string' ? value.trim() : value)],
				},
			},
		];
		const data = { title: '  Hello  ' };
		const result = await runFieldHooks('beforeValidate', fields, data, mockReq, 'create');
		expect(result.title).toBe('Hello');
	});

	it('should run multiple hooks in sequence', async () => {
		const fields: Field[] = [
			{
				name: 'title',
				type: 'text',
				hooks: {
					beforeChange: [({ value }) => `${value}-step1`, ({ value }) => `${value}-step2`],
				},
			},
		];
		const data = { title: 'start' };
		const result = await runFieldHooks('beforeChange', fields, data, mockReq, 'create');
		expect(result.title).toBe('start-step1-step2');
	});

	it('should not mutate the original data object', async () => {
		const fields: Field[] = [
			{
				name: 'title',
				type: 'text',
				hooks: { beforeChange: [({ value }) => `${value}-modified`] },
			},
		];
		const data = { title: 'original' };
		await runFieldHooks('beforeChange', fields, data, mockReq, 'create');
		expect(data.title).toBe('original');
	});

	it('should not mutate nested objects in original data (deep clone)', async () => {
		const fields: Field[] = [
			{
				name: 'meta',
				type: 'group',
				fields: [
					{
						name: 'slug',
						type: 'text',
						hooks: {
							beforeChange: [
								({ value }) => (typeof value === 'string' ? value.toUpperCase() : value),
							],
						},
					},
				],
			},
		];
		const data = { meta: { slug: 'original', extra: 'keep' } };
		const result = await runFieldHooks('beforeChange', fields, data, mockReq, 'create');

		// Result should have the transformed value
		expect(result.meta.slug).toBe('ORIGINAL');
		expect(result.meta.extra).toBe('keep');

		// Original data must be completely untouched (deep clone)
		expect(data.meta.slug).toBe('original');
		expect(data.meta.extra).toBe('keep');
	});

	it('should allow hooks to inject new fields when hook returns a value', async () => {
		const fields: Field[] = [
			{
				name: 'title',
				type: 'text',
				hooks: { beforeValidate: [() => 'injected'] },
			},
		];
		// data does NOT contain 'title' key
		const data = { content: 'Hello' };
		const result = await runFieldHooks('beforeValidate', fields, data, mockReq, 'create');
		// Hook returns 'injected' (non-undefined), so the guard `fieldExistsInData || value !== undefined`
		// evaluates to `false || true` → field IS set.
		// This is intentional: hooks can provide default values for missing fields.
		expect(result.title).toBe('injected');
		expect(result.content).toBe('Hello');
	});

	it('should not inject field when key is absent and hook returns undefined', async () => {
		const fields: Field[] = [
			{
				name: 'title',
				type: 'text',
				hooks: { beforeValidate: [() => undefined] },
			},
		];
		// data does NOT contain 'title' key
		const data = { content: 'Hello' };
		const result = await runFieldHooks('beforeValidate', fields, data, mockReq, 'create');
		// Hook returns undefined, and field doesn't exist in data.
		// Guard: `false || (undefined !== undefined)` → `false || false` → field NOT set.
		expect(result).not.toHaveProperty('title');
		expect(result).toEqual({ content: 'Hello' });
	});
});

// ============================================
// runFieldHooks — PATCH semantics edge case
// ============================================

describe('runFieldHooks — PATCH semantics (undefined value with key present)', () => {
	const fields: Field[] = [
		{
			name: 'title',
			type: 'text',
			hooks: {
				beforeValidate: [
					// Hook that returns undefined (no-op hook)
					() => undefined,
				],
			},
		},
	];

	it('should preserve key when data has { title: undefined } and hook returns undefined', async () => {
		const data = { title: undefined };
		const result = await runFieldHooks('beforeValidate', fields, data, mockReq, 'update');

		// The key exists in the data, so fieldExistsInData = true.
		// The hook returns undefined, so value stays undefined.
		// The guard `if (fieldExistsInData || value !== undefined)` evaluates to true
		// because fieldExistsInData is true.
		// Result: processedData.title = undefined (key preserved).
		expect('title' in result).toBe(true);
		expect(result.title).toBeUndefined();
	});

	it('should update key when hook returns a new value despite original being undefined', async () => {
		const fieldsWithTransform: Field[] = [
			{
				name: 'title',
				type: 'text',
				hooks: {
					beforeValidate: [
						// Hook that provides a default value
						({ value }) => (value === undefined ? 'default-title' : value),
					],
				},
			},
		];
		const data = { title: undefined };
		const result = await runFieldHooks(
			'beforeValidate',
			fieldsWithTransform,
			data,
			mockReq,
			'update',
		);

		expect(result.title).toBe('default-title');
	});

	it('should NOT inject key when key is absent from data and hook returns undefined', async () => {
		// data does not have 'title' key at all
		const data = { content: 'test' };
		const result = await runFieldHooks('beforeValidate', fields, data, mockReq, 'update');

		expect('title' in result).toBe(false);
		expect(result).toEqual({ content: 'test' });
	});
});

// ============================================
// runFieldHooks — named tabs
// ============================================

describe('runFieldHooks — named tabs', () => {
	it('should recurse into named tab data', async () => {
		const fields: Field[] = [
			{
				type: 'tabs',
				tabs: [
					{
						name: 'seo',
						fields: [
							{
								name: 'metaTitle',
								type: 'text',
								hooks: {
									beforeValidate: [
										({ value }) => (typeof value === 'string' ? value.trim() : value),
									],
								},
							},
						],
					},
				],
			},
		];

		const data = { seo: { metaTitle: '  Hello  ' } };
		const result = await runFieldHooks('beforeValidate', fields, data, mockReq, 'create');
		expect(result.seo.metaTitle).toBe('Hello');
	});

	it('should skip named tab hooks when tab data is null', async () => {
		const fields: Field[] = [
			{
				type: 'tabs',
				tabs: [
					{
						name: 'seo',
						fields: [
							{
								name: 'metaTitle',
								type: 'text',
								hooks: {
									beforeValidate: [() => 'should-not-run'],
								},
							},
						],
					},
				],
			},
		];

		const data = { seo: null };
		const result = await runFieldHooks('beforeValidate', fields, data, mockReq, 'create');
		expect(result.seo).toBeNull();
	});

	it('should skip named tab hooks when tab data is undefined', async () => {
		const fields: Field[] = [
			{
				type: 'tabs',
				tabs: [
					{
						name: 'seo',
						fields: [
							{
								name: 'metaTitle',
								type: 'text',
								hooks: {
									beforeValidate: [() => 'should-not-run'],
								},
							},
						],
					},
				],
			},
		];

		const data = {};
		const result = await runFieldHooks('beforeValidate', fields, data, mockReq, 'create');
		expect(result).toEqual({});
	});
});

// ============================================
// runFieldHooks — group recursion
// ============================================

describe('runFieldHooks — group fields', () => {
	it('should recurse into group fields', async () => {
		const fields: Field[] = [
			{
				name: 'meta',
				type: 'group',
				fields: [
					{
						name: 'slug',
						type: 'text',
						hooks: {
							beforeChange: [
								({ value }) => (typeof value === 'string' ? value.toLowerCase() : value),
							],
						},
					},
				],
			},
		];

		const data = { meta: { slug: 'HELLO-WORLD' } };
		const result = await runFieldHooks('beforeChange', fields, data, mockReq, 'create');
		expect(result.meta.slug).toBe('hello-world');
	});

	it('should skip group when value is null', async () => {
		const fields: Field[] = [
			{
				name: 'meta',
				type: 'group',
				fields: [
					{
						name: 'slug',
						type: 'text',
						hooks: { beforeChange: [() => 'should-not-run'] },
					},
				],
			},
		];

		const data = { meta: null };
		const result = await runFieldHooks('beforeChange', fields, data, mockReq, 'create');
		expect(result.meta).toBeNull();
	});
});

// ============================================
// runFieldHooks — array recursion
// ============================================

describe('runFieldHooks — array fields', () => {
	it('should recurse into array rows', async () => {
		const fields: Field[] = [
			{
				name: 'items',
				type: 'array',
				fields: [
					{
						name: 'label',
						type: 'text',
						hooks: {
							beforeValidate: [({ value }) => (typeof value === 'string' ? value.trim() : value)],
						},
					},
				],
			},
		];

		const data = { items: [{ label: '  a  ' }, { label: '  b  ' }] };
		const result = await runFieldHooks('beforeValidate', fields, data, mockReq, 'create');
		expect(result.items[0].label).toBe('a');
		expect(result.items[1].label).toBe('b');
	});

	it('should handle empty array', async () => {
		const fields: Field[] = [
			{
				name: 'items',
				type: 'array',
				fields: [
					{
						name: 'label',
						type: 'text',
						hooks: { beforeValidate: [() => 'should-not-run'] },
					},
				],
			},
		];

		const data = { items: [] };
		const result = await runFieldHooks('beforeValidate', fields, data, mockReq, 'create');
		expect(result.items).toEqual([]);
	});
});

// ============================================
// runFieldHooks — blocks recursion
// ============================================

describe('runFieldHooks — blocks fields', () => {
	const fields: Field[] = [
		{
			name: 'content',
			type: 'blocks',
			blocks: [
				{
					slug: 'text-block',
					fields: [
						{
							name: 'body',
							type: 'textarea',
							hooks: {
								beforeChange: [({ value }) => (typeof value === 'string' ? value.trim() : value)],
							},
						},
					],
				},
			],
		},
	];

	it('should recurse into blocks with matching blockType', async () => {
		const data = {
			content: [
				{ blockType: 'text-block', body: '  Hello  ' },
				{ blockType: 'text-block', body: '  World  ' },
			],
		};
		const result = await runFieldHooks('beforeChange', fields, data, mockReq, 'create');
		expect(result.content[0].body).toBe('Hello');
		expect(result.content[1].body).toBe('World');
	});

	it('should pass through blocks with unknown blockType unchanged', async () => {
		const data = {
			content: [{ blockType: 'unknown-block', body: '  Hello  ' }],
		};
		const result = await runFieldHooks('beforeChange', fields, data, mockReq, 'create');
		expect(result.content[0].body).toBe('  Hello  ');
	});

	it('should pass through blocks with undefined blockType unchanged', async () => {
		const data = {
			content: [{ body: '  Hello  ' }], // no blockType
		};
		const result = await runFieldHooks('beforeChange', fields, data, mockReq, 'create');
		expect(result.content[0].body).toBe('  Hello  ');
	});

	it('should pass through blocks with empty string blockType unchanged', async () => {
		const data = {
			content: [{ blockType: '', body: '  Hello  ' }],
		};
		const result = await runFieldHooks('beforeChange', fields, data, mockReq, 'create');
		expect(result.content[0].body).toBe('  Hello  ');
	});
});

// ============================================
// runFieldHooks — depth guard
// ============================================

describe('runFieldHooks — depth guard', () => {
	it('should throw ValidationError when nesting exceeds MAX_FIELD_HOOK_DEPTH (10)', async () => {
		// Create a deeply nested group chain: 12 levels deep
		// Each level has a hook that would modify the value
		function makeDeepFields(depth: number): Field[] {
			if (depth <= 0) {
				return [
					{
						name: 'leaf',
						type: 'text',
						hooks: { beforeValidate: [() => 'hook-ran'] },
					},
				];
			}
			return [
				{
					name: `level${depth}`,
					type: 'group',
					fields: makeDeepFields(depth - 1),
				},
			];
		}

		// Build 12 levels of nesting
		const fields = makeDeepFields(12);

		// Build data matching the nesting
		let data: Record<string, unknown> = { leaf: 'original' };
		for (let i = 1; i <= 12; i++) {
			data = { [`level${i}`]: data };
		}

		// At depth > 10, runFieldHooks now throws ValidationError
		// (consistent with field-access.ts filterReadableFields/filterWritableFields)
		await expect(runFieldHooks('beforeValidate', fields, data, mockReq, 'create')).rejects.toThrow(
			'Field hook nesting depth exceeds maximum of 10 levels',
		);
	});

	it('should process hooks at exactly MAX_FIELD_HOOK_DEPTH without error', async () => {
		// 10 levels of nesting — exactly at the limit, should still work
		function makeDeepFields(depth: number): Field[] {
			if (depth <= 0) {
				return [
					{
						name: 'leaf',
						type: 'text',
						hooks: { beforeValidate: [() => 'hook-ran'] },
					},
				];
			}
			return [
				{
					name: `level${depth}`,
					type: 'group',
					fields: makeDeepFields(depth - 1),
				},
			];
		}

		const fields = makeDeepFields(10);

		let data: Record<string, unknown> = { leaf: 'original' };
		for (let i = 1; i <= 10; i++) {
			data = { [`level${i}`]: data };
		}

		const result = await runFieldHooks('beforeValidate', fields, data, mockReq, 'create');

		// Navigate to the leaf — hook should have run at depth 10
		let current: Record<string, unknown> = result;
		for (let i = 10; i > 0; i--) {
			const next = current[`level${i}`];
			if (next && typeof next === 'object' && next !== null) {
				current = next as Record<string, unknown>;
			} else {
				break;
			}
		}
		expect(current['leaf']).toBe('hook-ran');
	});
});

// ============================================
// runFieldHooks — operation context
// ============================================

describe('runFieldHooks — operation context', () => {
	it('should pass operation to hooks', async () => {
		const operations: string[] = [];
		const fields: Field[] = [
			{
				name: 'title',
				type: 'text',
				hooks: {
					beforeChange: [
						({ operation }) => {
							operations.push(operation);
							return undefined;
						},
					],
				},
			},
		];

		const data = { title: 'test' };
		await runFieldHooks('beforeChange', fields, data, mockReq, 'create');
		await runFieldHooks('beforeChange', fields, data, mockReq, 'update');
		await runFieldHooks('beforeChange', fields, data, mockReq, 'read');

		expect(operations).toEqual(['create', 'update', 'read']);
	});
});

// ============================================
// runFieldHooks — collapsible / row layout fields
// ============================================

describe('runFieldHooks — collapsible and row layout fields', () => {
	it('should recurse into collapsible fields', async () => {
		const fields: Field[] = [
			{
				type: 'collapsible',
				label: 'Advanced',
				fields: [
					{
						name: 'secret',
						type: 'text',
						hooks: {
							beforeValidate: [
								({ value }) => (typeof value === 'string' ? value.toUpperCase() : value),
							],
						},
					},
				],
			},
		];

		const data = { secret: 'hidden' };
		const result = await runFieldHooks('beforeValidate', fields, data, mockReq, 'create');
		expect(result.secret).toBe('HIDDEN');
	});

	it('should recurse into row fields', async () => {
		const fields: Field[] = [
			{
				type: 'row',
				fields: [
					{
						name: 'firstName',
						type: 'text',
						hooks: {
							beforeChange: [({ value }) => (typeof value === 'string' ? value.trim() : value)],
						},
					},
					{
						name: 'lastName',
						type: 'text',
						hooks: {
							beforeChange: [({ value }) => (typeof value === 'string' ? value.trim() : value)],
						},
					},
				],
			},
		];

		const data = { firstName: '  John  ', lastName: '  Doe  ' };
		const result = await runFieldHooks('beforeChange', fields, data, mockReq, 'create');
		expect(result.firstName).toBe('John');
		expect(result.lastName).toBe('Doe');
	});
});
