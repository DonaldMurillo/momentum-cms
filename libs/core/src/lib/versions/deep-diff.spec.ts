import { describe, it, expect } from 'vitest';
import { deepDiff, wordDiff } from './deep-diff';
import type { Field } from '../fields/field.types';

// ============================================
// Helper to build field configs for tests
// ============================================

function textField(name: string, label?: string): Field {
	return { name, type: 'text', label } as Field;
}

function numberField(name: string, label?: string): Field {
	return { name, type: 'number', label } as Field;
}

function checkboxField(name: string): Field {
	return { name, type: 'checkbox' } as Field;
}

function dateField(name: string): Field {
	return { name, type: 'date' } as Field;
}

function selectField(name: string, options: string[]): Field {
	return {
		name,
		type: 'select',
		options: options.map((o) => ({ label: o, value: o })),
	} as Field;
}

function emailField(name: string): Field {
	return { name, type: 'email' } as Field;
}

function richTextField(name: string): Field {
	return { name, type: 'richText' } as Field;
}

function jsonField(name: string): Field {
	return { name, type: 'json' } as Field;
}

function groupField(name: string, fields: Field[], label?: string): Field {
	return { name, type: 'group', fields, label } as Field;
}

function arrayField(name: string, fields: Field[]): Field {
	return { name, type: 'array', fields } as Field;
}

function slugField(name: string): Field {
	return { name, type: 'slug', from: 'title' } as Field;
}

function pointField(name: string): Field {
	return { name, type: 'point' } as Field;
}

// ============================================
// deepDiff — Primitive fields
// ============================================

describe('deepDiff', () => {
	describe('primitive fields', () => {
		const fields: Field[] = [
			textField('title', 'Title'),
			numberField('views', 'Views'),
			checkboxField('published'),
			dateField('publishedAt'),
			selectField('category', ['tech', 'news']),
			emailField('email'),
			slugField('slug'),
			pointField('location'),
		];

		it('detects changed text field', () => {
			const result = deepDiff({ title: 'Old Title' }, { title: 'New Title' }, fields);
			const titleDiff = result.find((d) => d.field === 'title');
			expect(titleDiff).toBeDefined();
			expect(titleDiff?.changeType).toBe('changed');
			expect(titleDiff?.oldValue).toBe('Old Title');
			expect(titleDiff?.newValue).toBe('New Title');
			expect(titleDiff?.fieldType).toBe('text');
			expect(titleDiff?.label).toBe('Title');
		});

		it('detects unchanged fields as unchanged', () => {
			const result = deepDiff({ title: 'Same' }, { title: 'Same' }, fields);
			const titleDiff = result.find((d) => d.field === 'title');
			expect(titleDiff).toBeDefined();
			expect(titleDiff?.changeType).toBe('unchanged');
		});

		it('detects added field (undefined → value)', () => {
			const result = deepDiff({}, { title: 'New' }, fields);
			const titleDiff = result.find((d) => d.field === 'title');
			expect(titleDiff).toBeDefined();
			expect(titleDiff?.changeType).toBe('added');
			expect(titleDiff?.oldValue).toBeUndefined();
			expect(titleDiff?.newValue).toBe('New');
		});

		it('detects removed field (value → undefined)', () => {
			const result = deepDiff({ title: 'Old' }, {}, fields);
			const titleDiff = result.find((d) => d.field === 'title');
			expect(titleDiff).toBeDefined();
			expect(titleDiff?.changeType).toBe('removed');
			expect(titleDiff?.oldValue).toBe('Old');
			expect(titleDiff?.newValue).toBeUndefined();
		});

		it('detects changed number field', () => {
			const result = deepDiff({ views: 10 }, { views: 42 }, fields);
			const diff = result.find((d) => d.field === 'views');
			expect(diff).toBeDefined();
			expect(diff?.changeType).toBe('changed');
			expect(diff?.fieldType).toBe('number');
			expect(diff?.label).toBe('Views');
		});

		it('detects changed checkbox field', () => {
			const result = deepDiff({ published: false }, { published: true }, fields);
			const diff = result.find((d) => d.field === 'published');
			expect(diff?.changeType).toBe('changed');
			expect(diff?.fieldType).toBe('checkbox');
		});

		it('detects changed date field', () => {
			const result = deepDiff({ publishedAt: '2025-01-01' }, { publishedAt: '2025-06-15' }, fields);
			const diff = result.find((d) => d.field === 'publishedAt');
			expect(diff?.changeType).toBe('changed');
			expect(diff?.fieldType).toBe('date');
		});

		it('detects changed select field', () => {
			const result = deepDiff({ category: 'tech' }, { category: 'news' }, fields);
			const diff = result.find((d) => d.field === 'category');
			expect(diff?.changeType).toBe('changed');
			expect(diff?.fieldType).toBe('select');
		});

		it('detects changed email field', () => {
			const result = deepDiff({ email: 'old@test.com' }, { email: 'new@test.com' }, fields);
			const diff = result.find((d) => d.field === 'email');
			expect(diff?.changeType).toBe('changed');
			expect(diff?.fieldType).toBe('email');
		});

		it('includes textDiff segments for changed text fields', () => {
			const result = deepDiff({ title: 'Hello World' }, { title: 'Hello Angular World' }, fields);
			const titleDiff = result.find((d) => d.field === 'title');
			expect(titleDiff?.textDiff).toBeDefined();
			expect(titleDiff?.textDiff?.length).toBeGreaterThan(0);
		});

		it('returns all fields when both objects have data', () => {
			const result = deepDiff({ title: 'Same', views: 5 }, { title: 'Same', views: 5 }, fields);
			// Should have entries for both fields
			expect(result.find((d) => d.field === 'title')).toBeDefined();
			expect(result.find((d) => d.field === 'views')).toBeDefined();
		});
	});

	// ============================================
	// Group fields (nested)
	// ============================================

	describe('group fields', () => {
		const fields: Field[] = [
			groupField(
				'seo',
				[textField('title', 'SEO Title'), textField('description', 'SEO Description')],
				'SEO',
			),
		];

		it('detects changes in nested group fields', () => {
			const result = deepDiff(
				{ seo: { title: 'Old SEO', description: 'Old desc' } },
				{ seo: { title: 'New SEO', description: 'Old desc' } },
				fields,
			);
			const seoDiff = result.find((d) => d.field === 'seo');
			expect(seoDiff).toBeDefined();
			expect(seoDiff?.changeType).toBe('changed');
			expect(seoDiff?.fieldType).toBe('group');
			expect(seoDiff?.children).toBeDefined();
			expect(seoDiff?.children?.length).toBeGreaterThan(0);

			const titleChild = seoDiff?.children?.find((c) => c.field === 'title');
			expect(titleChild).toBeDefined();
			expect(titleChild?.changeType).toBe('changed');
			expect(titleChild?.oldValue).toBe('Old SEO');
			expect(titleChild?.newValue).toBe('New SEO');
		});

		it('marks group as unchanged when all children unchanged', () => {
			const result = deepDiff(
				{ seo: { title: 'Same', description: 'Same' } },
				{ seo: { title: 'Same', description: 'Same' } },
				fields,
			);
			const seoDiff = result.find((d) => d.field === 'seo');
			expect(seoDiff?.changeType).toBe('unchanged');
		});

		it('detects added group (undefined → object)', () => {
			const result = deepDiff({}, { seo: { title: 'New' } }, fields);
			const seoDiff = result.find((d) => d.field === 'seo');
			expect(seoDiff?.changeType).toBe('added');
		});

		it('detects removed group (object → undefined)', () => {
			const result = deepDiff({ seo: { title: 'Old' } }, {}, fields);
			const seoDiff = result.find((d) => d.field === 'seo');
			expect(seoDiff?.changeType).toBe('removed');
		});
	});

	// ============================================
	// Array fields
	// ============================================

	describe('array fields', () => {
		const fields: Field[] = [arrayField('tags', [textField('label', 'Label')])];

		it('detects added array items', () => {
			const result = deepDiff(
				{ tags: [{ id: '1', label: 'a' }] },
				{
					tags: [
						{ id: '1', label: 'a' },
						{ id: '2', label: 'b' },
					],
				},
				fields,
			);
			const tagsDiff = result.find((d) => d.field === 'tags');
			expect(tagsDiff).toBeDefined();
			expect(tagsDiff?.changeType).toBe('changed');
			expect(tagsDiff?.fieldType).toBe('array');
			expect(tagsDiff?.arrayChanges).toBeDefined();

			const added = tagsDiff?.arrayChanges?.find((c) => c.changeType === 'added');
			expect(added).toBeDefined();
		});

		it('detects removed array items', () => {
			const result = deepDiff(
				{
					tags: [
						{ id: '1', label: 'a' },
						{ id: '2', label: 'b' },
					],
				},
				{ tags: [{ id: '1', label: 'a' }] },
				fields,
			);
			const tagsDiff = result.find((d) => d.field === 'tags');
			expect(tagsDiff?.arrayChanges).toBeDefined();

			const removed = tagsDiff?.arrayChanges?.find((c) => c.changeType === 'removed');
			expect(removed).toBeDefined();
		});

		it('detects changed array items with sub-field diffs', () => {
			const result = deepDiff(
				{ tags: [{ id: '1', label: 'old' }] },
				{ tags: [{ id: '1', label: 'new' }] },
				fields,
			);
			const tagsDiff = result.find((d) => d.field === 'tags');
			expect(tagsDiff?.arrayChanges).toBeDefined();

			const changed = tagsDiff?.arrayChanges?.find((c) => c.changeType === 'changed');
			expect(changed).toBeDefined();
			expect(changed?.children).toBeDefined();
			expect(changed?.children?.find((c) => c.field === 'label')).toBeDefined();
		});

		it('matches array items by id when present', () => {
			const result = deepDiff(
				{
					tags: [
						{ id: '1', label: 'a' },
						{ id: '2', label: 'b' },
					],
				},
				{
					tags: [
						{ id: '2', label: 'b' },
						{ id: '1', label: 'a' },
					],
				},
				fields,
			);
			const tagsDiff = result.find((d) => d.field === 'tags');
			// Items reordered but same data — should detect moves not changes
			const changes = tagsDiff?.arrayChanges ?? [];
			const actualChanges = changes.filter((c) => c.changeType === 'changed');
			// No field-level changes expected since data is the same
			expect(actualChanges.length).toBe(0);
		});

		it('marks array as unchanged when items are identical', () => {
			const result = deepDiff(
				{ tags: [{ id: '1', label: 'a' }] },
				{ tags: [{ id: '1', label: 'a' }] },
				fields,
			);
			const tagsDiff = result.find((d) => d.field === 'tags');
			expect(tagsDiff?.changeType).toBe('unchanged');
		});

		it('detects empty array to populated array', () => {
			const result = deepDiff({ tags: [] }, { tags: [{ id: '1', label: 'a' }] }, fields);
			const tagsDiff = result.find((d) => d.field === 'tags');
			expect(tagsDiff?.changeType).toBe('changed');
			expect(tagsDiff?.arrayChanges?.length).toBe(1);
			expect(tagsDiff?.arrayChanges?.[0].changeType).toBe('added');
		});
	});

	// ============================================
	// Rich text fields
	// ============================================

	describe('rich text fields', () => {
		const fields: Field[] = [richTextField('content')];

		it('detects changed rich text and marks fieldType', () => {
			const result = deepDiff(
				{ content: '<p>Old paragraph</p>' },
				{ content: '<p>New paragraph</p>' },
				fields,
			);
			const diff = result.find((d) => d.field === 'content');
			expect(diff?.changeType).toBe('changed');
			expect(diff?.fieldType).toBe('richText');
			expect(diff?.oldValue).toBe('<p>Old paragraph</p>');
			expect(diff?.newValue).toBe('<p>New paragraph</p>');
		});

		it('marks unchanged rich text as unchanged', () => {
			const result = deepDiff({ content: '<p>Same</p>' }, { content: '<p>Same</p>' }, fields);
			const diff = result.find((d) => d.field === 'content');
			expect(diff?.changeType).toBe('unchanged');
		});
	});

	// ============================================
	// JSON fields
	// ============================================

	describe('json fields', () => {
		const fields: Field[] = [jsonField('metadata')];

		it('detects changed JSON field', () => {
			const result = deepDiff({ metadata: { key: 'old' } }, { metadata: { key: 'new' } }, fields);
			const diff = result.find((d) => d.field === 'metadata');
			expect(diff?.changeType).toBe('changed');
			expect(diff?.fieldType).toBe('json');
		});

		it('marks identical JSON as unchanged', () => {
			const result = deepDiff({ metadata: { key: 'same' } }, { metadata: { key: 'same' } }, fields);
			const diff = result.find((d) => d.field === 'metadata');
			expect(diff?.changeType).toBe('unchanged');
		});
	});

	// ============================================
	// No fields config (fallback mode)
	// ============================================

	describe('without field config (fallback)', () => {
		it('compares all keys using JSON.stringify fallback', () => {
			const result = deepDiff({ title: 'Old', count: 1 }, { title: 'New', count: 1 });
			expect(result.length).toBeGreaterThanOrEqual(1);
			const titleDiff = result.find((d) => d.field === 'title');
			expect(titleDiff).toBeDefined();
			expect(titleDiff?.changeType).toBe('changed');
			// Without field config, fieldType should be undefined
			expect(titleDiff?.fieldType).toBeUndefined();
		});

		it('detects added keys', () => {
			const result = deepDiff({}, { title: 'New' });
			const diff = result.find((d) => d.field === 'title');
			expect(diff?.changeType).toBe('added');
		});

		it('detects removed keys', () => {
			const result = deepDiff({ title: 'Old' }, {});
			const diff = result.find((d) => d.field === 'title');
			expect(diff?.changeType).toBe('removed');
		});

		it('handles nested objects with deep comparison', () => {
			const result = deepDiff({ meta: { a: 1, b: 2 } }, { meta: { a: 1, b: 3 } });
			const diff = result.find((d) => d.field === 'meta');
			expect(diff?.changeType).toBe('changed');
		});

		it('returns empty array for identical objects', () => {
			const result = deepDiff({ a: 1, b: 'x' }, { a: 1, b: 'x' });
			const changes = result.filter((d) => d.changeType !== 'unchanged');
			expect(changes).toHaveLength(0);
		});
	});

	// ============================================
	// Layout fields (tabs, collapsible, row)
	// ============================================

	describe('layout fields', () => {
		it('flattens through collapsible layout fields', () => {
			const fields: Field[] = [
				{
					name: 'wrapper',
					type: 'collapsible',
					fields: [textField('title', 'Title')],
				} as Field,
			];
			const result = deepDiff({ title: 'Old' }, { title: 'New' }, fields);
			const titleDiff = result.find((d) => d.field === 'title');
			expect(titleDiff).toBeDefined();
			expect(titleDiff?.changeType).toBe('changed');
		});

		it('flattens through row layout fields', () => {
			const fields: Field[] = [
				{
					name: 'row1',
					type: 'row',
					fields: [textField('firstName'), textField('lastName')],
				} as Field,
			];
			const result = deepDiff(
				{ firstName: 'John', lastName: 'Doe' },
				{ firstName: 'Jane', lastName: 'Doe' },
				fields,
			);
			const firstNameDiff = result.find((d) => d.field === 'firstName');
			expect(firstNameDiff?.changeType).toBe('changed');
		});
	});

	// ============================================
	// diffExclude (sensitive fields)
	// ============================================

	describe('diffExclude', () => {
		it('excludes fields with diffExclude: true from results', () => {
			const fields: Field[] = [
				textField('title'),
				{ name: 'secret', type: 'password', diffExclude: true } as Field,
			];
			const result = deepDiff(
				{ title: 'Same', secret: 'hash123' },
				{ title: 'Same', secret: 'hash456' },
				fields,
			);
			const secretDiff = result.find((d) => d.field === 'secret');
			expect(secretDiff).toBeUndefined();
			// Title should still be present
			expect(result.find((d) => d.field === 'title')).toBeDefined();
		});

		it('excludes diffExclude fields even when they are added', () => {
			const fields: Field[] = [{ name: 'apiKey', type: 'text', diffExclude: true } as Field];
			const result = deepDiff({}, { apiKey: 'secret-key' }, fields);
			expect(result.find((d) => d.field === 'apiKey')).toBeUndefined();
		});

		it('excludes diffExclude fields even when they are removed', () => {
			const fields: Field[] = [{ name: 'token', type: 'text', diffExclude: true } as Field];
			const result = deepDiff({ token: 'old-token' }, {}, fields);
			expect(result.find((d) => d.field === 'token')).toBeUndefined();
		});

		it('does not affect fields without diffExclude', () => {
			const fields: Field[] = [
				textField('title'),
				{ name: 'password', type: 'password', diffExclude: true } as Field,
			];
			const result = deepDiff(
				{ title: 'Old', password: 'hash1' },
				{ title: 'New', password: 'hash2' },
				fields,
			);
			expect(result).toHaveLength(1);
			expect(result[0].field).toBe('title');
			expect(result[0].changeType).toBe('changed');
		});

		it('excludes nested diffExclude fields inside groups', () => {
			const fields: Field[] = [
				groupField('settings', [
					textField('name'),
					{ name: 'internalKey', type: 'text', diffExclude: true } as Field,
				]),
			];
			const result = deepDiff(
				{ settings: { name: 'Same', internalKey: 'old' } },
				{ settings: { name: 'Same', internalKey: 'new' } },
				fields,
			);
			const settingsDiff = result.find((d) => d.field === 'settings');
			// Group should be unchanged because the only changed field is excluded
			expect(settingsDiff?.changeType).toBe('unchanged');
			// Children should not contain the excluded field
			const internalKeyChild = settingsDiff?.children?.find((c) => c.field === 'internalKey');
			expect(internalKeyChild).toBeUndefined();
		});
	});

	// ============================================
	// Extra keys not in field config
	// ============================================

	describe('extra keys not in field config', () => {
		it('includes diffs for keys present in data but not in fields config', () => {
			const fields: Field[] = [textField('title')];
			const result = deepDiff(
				{ title: 'Same', extraKey: 'old' },
				{ title: 'Same', extraKey: 'new' },
				fields,
			);
			const extraDiff = result.find((d) => d.field === 'extraKey');
			expect(extraDiff).toBeDefined();
			expect(extraDiff?.changeType).toBe('changed');
			// Extra keys have no fieldType
			expect(extraDiff?.fieldType).toBeUndefined();
		});
	});
});

// ============================================
// wordDiff
// ============================================

describe('wordDiff', () => {
	it('returns common segments for identical text', () => {
		const result = wordDiff('hello world', 'hello world');
		expect(result).toEqual([{ type: 'common', value: 'hello world' }]);
	});

	it('detects added words', () => {
		const result = wordDiff('hello world', 'hello beautiful world');
		const added = result.filter((s) => s.type === 'added');
		expect(added.length).toBeGreaterThan(0);
		expect(added.some((s) => s.value.includes('beautiful'))).toBe(true);
	});

	it('detects removed words', () => {
		const result = wordDiff('hello beautiful world', 'hello world');
		const removed = result.filter((s) => s.type === 'removed');
		expect(removed.length).toBeGreaterThan(0);
		expect(removed.some((s) => s.value.includes('beautiful'))).toBe(true);
	});

	it('handles completely different text', () => {
		const result = wordDiff('foo bar', 'baz qux');
		const removed = result.filter((s) => s.type === 'removed');
		const added = result.filter((s) => s.type === 'added');
		expect(removed.length).toBeGreaterThan(0);
		expect(added.length).toBeGreaterThan(0);
	});

	it('handles empty old text', () => {
		const result = wordDiff('', 'hello');
		expect(result).toEqual([{ type: 'added', value: 'hello' }]);
	});

	it('handles empty new text', () => {
		const result = wordDiff('hello', '');
		expect(result).toEqual([{ type: 'removed', value: 'hello' }]);
	});

	it('handles both empty', () => {
		const result = wordDiff('', '');
		expect(result).toEqual([]);
	});

	it('falls back to full add/remove for very large texts exceeding word limit', () => {
		// Use texts with shared prefix/suffix so LCS would produce different output than fallback
		const middle = Array.from({ length: 2500 }, (_, i) => `word${i}`).join(' ');
		const oldText = `shared_start ${middle} shared_end`;
		const newText = `shared_start ${middle.replace(/word/g, 'changed')} shared_end`;
		const result = wordDiff(oldText, newText);
		// With fallback: should be exactly 2 segments (removed + added) — no LCS common extraction
		expect(result).toHaveLength(2);
		expect(result[0].type).toBe('removed');
		expect(result[0].value).toBe(oldText);
		expect(result[1].type).toBe('added');
		expect(result[1].value).toBe(newText);
	});

	it('still uses LCS for texts within the word limit', () => {
		const result = wordDiff('hello world foo', 'hello beautiful world foo');
		const added = result.filter((s) => s.type === 'added');
		expect(added.length).toBeGreaterThan(0);
		expect(added.some((s) => s.value.includes('beautiful'))).toBe(true);
		// Should have common segments too (LCS was used)
		const common = result.filter((s) => s.type === 'common');
		expect(common.length).toBeGreaterThan(0);
	});
});
