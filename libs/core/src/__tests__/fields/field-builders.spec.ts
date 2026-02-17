import { describe, it, expect } from 'vitest';
import {
	text,
	textarea,
	richText,
	number,
	date,
	checkbox,
	select,
	radio,
	email,
	password,
	upload,
	relationship,
	array,
	group,
	blocks,
	json,
	point,
	slug,
	tabs,
	collapsible,
	row,
} from '../../lib/fields';
import { isLayoutField, isNamedTab, flattenDataFields, LAYOUT_FIELD_TYPES } from '../../lib/fields';
import type { TabConfig, GroupField } from '../../lib/fields';

describe('Field Builders', () => {
	describe('text()', () => {
		it('should create a text field with name and type', () => {
			const field = text('title');
			expect(field).toEqual({ name: 'title', type: 'text' });
		});

		it('should include required option when specified', () => {
			const field = text('title', { required: true });
			expect(field.required).toBe(true);
		});

		it('should include minLength and maxLength options', () => {
			const field = text('title', { minLength: 5, maxLength: 100 });
			expect(field.minLength).toBe(5);
			expect(field.maxLength).toBe(100);
		});

		it('should include label and description', () => {
			const field = text('title', { label: 'Post Title', description: 'Enter the title' });
			expect(field.label).toBe('Post Title');
			expect(field.description).toBe('Enter the title');
		});
	});

	describe('textarea()', () => {
		it('should create a textarea field with name and type', () => {
			const field = textarea('content');
			expect(field).toEqual({ name: 'content', type: 'textarea' });
		});

		it('should include rows option', () => {
			const field = textarea('content', { rows: 10 });
			expect(field.rows).toBe(10);
		});
	});

	describe('richText()', () => {
		it('should create a richText field with name and type', () => {
			const field = richText('body');
			expect(field).toEqual({ name: 'body', type: 'richText' });
		});

		it('should include required option', () => {
			const field = richText('body', { required: true });
			expect(field.required).toBe(true);
		});
	});

	describe('number()', () => {
		it('should create a number field with name and type', () => {
			const field = number('price');
			expect(field).toEqual({ name: 'price', type: 'number' });
		});

		it('should include min, max, and step options', () => {
			const field = number('price', { min: 0, max: 1000, step: 0.01 });
			expect(field.min).toBe(0);
			expect(field.max).toBe(1000);
			expect(field.step).toBe(0.01);
		});
	});

	describe('date()', () => {
		it('should create a date field with name and type', () => {
			const field = date('publishedAt');
			expect(field).toEqual({ name: 'publishedAt', type: 'date' });
		});
	});

	describe('checkbox()', () => {
		it('should create a checkbox field with name and type', () => {
			const field = checkbox('isPublished');
			expect(field.name).toBe('isPublished');
			expect(field.type).toBe('checkbox');
		});

		it('should have false as default defaultValue', () => {
			const field = checkbox('isPublished');
			expect(field.defaultValue).toBe(false);
		});

		it('should allow custom defaultValue', () => {
			const field = checkbox('isPublished', { defaultValue: true });
			expect(field.defaultValue).toBe(true);
		});
	});

	describe('select()', () => {
		it('should create a select field with options', () => {
			const field = select('status', {
				options: [
					{ label: 'Draft', value: 'draft' },
					{ label: 'Published', value: 'published' },
				],
			});
			expect(field.type).toBe('select');
			expect(field.options).toHaveLength(2);
		});

		it('should support hasMany option for multi-select', () => {
			const field = select('tags', {
				options: [{ label: 'Tech', value: 'tech' }],
				hasMany: true,
			});
			expect(field.hasMany).toBe(true);
		});
	});

	describe('radio()', () => {
		it('should create a radio field with options', () => {
			const field = radio('priority', {
				options: [
					{ label: 'Low', value: 'low' },
					{ label: 'High', value: 'high' },
				],
			});
			expect(field.type).toBe('radio');
			expect(field.options).toHaveLength(2);
		});
	});

	describe('email()', () => {
		it('should create an email field with name and type', () => {
			const field = email('userEmail');
			expect(field).toEqual({ name: 'userEmail', type: 'email' });
		});
	});

	describe('password()', () => {
		it('should create a password field with name and type', () => {
			const field = password('userPassword');
			expect(field).toEqual({ name: 'userPassword', type: 'password' });
		});

		it('should include minLength option', () => {
			const field = password('userPassword', { minLength: 8 });
			expect(field.minLength).toBe(8);
		});
	});

	describe('upload()', () => {
		it('should create an upload field with relationTo', () => {
			const field = upload('featuredImage', { relationTo: 'media' });
			expect(field.type).toBe('upload');
			expect(field.relationTo).toBe('media');
		});
	});

	describe('relationship()', () => {
		it('should accept lazy collection reference', () => {
			const mockCollection = { slug: 'users', fields: [] };
			const field = relationship('author', { collection: () => mockCollection });

			expect(field.type).toBe('relationship');
			expect(field.collection()).toBe(mockCollection);
		});

		it('should support hasMany for multi-relationship', () => {
			const mockCollection = { slug: 'categories', fields: [] };
			const field = relationship('categories', {
				collection: () => mockCollection,
				hasMany: true,
			});
			expect(field.hasMany).toBe(true);
		});
	});

	describe('array()', () => {
		it('should create an array field with nested fields', () => {
			const field = array('items', {
				fields: [text('name'), number('quantity')],
			});
			expect(field.type).toBe('array');
			expect(field.fields).toHaveLength(2);
		});

		it('should support minRows and maxRows', () => {
			const field = array('items', {
				fields: [text('name')],
				minRows: 1,
				maxRows: 10,
			});
			expect(field.minRows).toBe(1);
			expect(field.maxRows).toBe(10);
		});
	});

	describe('group()', () => {
		it('should create a group field with nested fields', () => {
			const field = group('address', {
				fields: [text('street'), text('city'), text('zipCode')],
			});
			expect(field.type).toBe('group');
			expect(field.fields).toHaveLength(3);
		});
	});

	describe('blocks()', () => {
		it('should create a blocks field with block definitions', () => {
			const field = blocks('content', {
				blocks: [
					{
						slug: 'text-block',
						fields: [richText('text')],
					},
					{
						slug: 'image-block',
						fields: [upload('image', { relationTo: 'media' })],
					},
				],
			});
			expect(field.type).toBe('blocks');
			expect(field.blocks).toHaveLength(2);
		});

		it('should support minRows and maxRows', () => {
			const field = blocks('content', {
				blocks: [{ slug: 'text-block', fields: [text('text')] }],
				minRows: 1,
				maxRows: 20,
			});
			expect(field.minRows).toBe(1);
			expect(field.maxRows).toBe(20);
		});
	});

	describe('json()', () => {
		it('should create a json field with name and type', () => {
			const field = json('metadata');
			expect(field).toEqual({ name: 'metadata', type: 'json' });
		});
	});

	describe('point()', () => {
		it('should create a point field for geolocation', () => {
			const field = point('location');
			expect(field).toEqual({ name: 'location', type: 'point' });
		});
	});

	describe('slug()', () => {
		it('should create a slug field with from option', () => {
			const field = slug('slug', { from: 'title' });
			expect(field.type).toBe('slug');
			expect(field.from).toBe('title');
		});
	});

	describe('tabs()', () => {
		it('should create a tabs field with tab definitions', () => {
			const field = tabs('settings', {
				tabs: [
					{ label: 'General', fields: [text('title')] },
					{ label: 'SEO', fields: [text('metaTitle'), textarea('metaDescription')] },
				],
			});
			expect(field.type).toBe('tabs');
			expect(field.name).toBe('settings');
			expect(field.tabs).toHaveLength(2);
			expect(field.tabs[0].label).toBe('General');
			expect(field.tabs[0].fields).toHaveLength(1);
			expect(field.tabs[1].label).toBe('SEO');
			expect(field.tabs[1].fields).toHaveLength(2);
		});

		it('should support label and description', () => {
			const field = tabs('config', {
				tabs: [{ label: 'Tab1', fields: [] }],
				label: 'Configuration',
				description: 'Organize settings into tabs',
			});
			expect(field.label).toBe('Configuration');
			expect(field.description).toBe('Organize settings into tabs');
		});

		it('should create tabs with unnamed tabs (no name property)', () => {
			const field = tabs('settings', {
				tabs: [{ label: 'General', fields: [text('title')] }],
			});
			expect(field.tabs[0].name).toBeUndefined();
		});

		it('should create tabs with named tabs (with name property)', () => {
			const field = tabs('settings', {
				tabs: [
					{ name: 'seo', label: 'SEO', fields: [text('metaTitle')] },
					{ label: 'General', fields: [text('title')] },
				],
			});
			expect(field.tabs[0].name).toBe('seo');
			expect(field.tabs[1].name).toBeUndefined();
		});

		it('should support mixed named and unnamed tabs', () => {
			const field = tabs('content', {
				tabs: [
					{ label: 'General', fields: [text('title')] },
					{ name: 'seo', label: 'SEO', fields: [text('metaTitle')] },
					{ name: 'social', label: 'Social', fields: [text('ogImage')] },
					{ label: 'Advanced', fields: [checkbox('debug')] },
				],
			});
			expect(field.tabs).toHaveLength(4);
			expect(field.tabs[0].name).toBeUndefined();
			expect(field.tabs[1].name).toBe('seo');
			expect(field.tabs[2].name).toBe('social');
			expect(field.tabs[3].name).toBeUndefined();
		});
	});

	describe('isNamedTab()', () => {
		it('should return true for a TabConfig with a name', () => {
			const tab: TabConfig = { name: 'seo', label: 'SEO', fields: [text('title')] };
			expect(isNamedTab(tab)).toBe(true);
		});

		it('should return false for a TabConfig without a name', () => {
			const tab: TabConfig = { label: 'General', fields: [text('title')] };
			expect(isNamedTab(tab)).toBe(false);
		});

		it('should return false for an empty string name', () => {
			const tab: TabConfig = { name: '', label: 'Empty', fields: [] };
			expect(isNamedTab(tab)).toBe(false);
		});
	});

	describe('collapsible()', () => {
		it('should create a collapsible field with child fields', () => {
			const field = collapsible('advanced', {
				fields: [text('apiKey'), checkbox('debug')],
			});
			expect(field.type).toBe('collapsible');
			expect(field.name).toBe('advanced');
			expect(field.fields).toHaveLength(2);
		});

		it('should support defaultOpen option', () => {
			const field = collapsible('settings', {
				fields: [text('title')],
				defaultOpen: true,
			});
			expect(field.defaultOpen).toBe(true);
		});

		it('should default defaultOpen to undefined (falsy)', () => {
			const field = collapsible('settings', {
				fields: [text('title')],
			});
			expect(field.defaultOpen).toBeUndefined();
		});
	});

	describe('row()', () => {
		it('should create a row field with child fields', () => {
			const field = row('nameRow', {
				fields: [text('firstName'), text('lastName')],
			});
			expect(field.type).toBe('row');
			expect(field.name).toBe('nameRow');
			expect(field.fields).toHaveLength(2);
		});

		it('should support label', () => {
			const field = row('details', {
				fields: [text('city'), text('state')],
				label: 'Location Details',
			});
			expect(field.label).toBe('Location Details');
		});
	});

	describe('LAYOUT_FIELD_TYPES', () => {
		it('should contain tabs, collapsible, and row', () => {
			expect(LAYOUT_FIELD_TYPES.has('tabs')).toBe(true);
			expect(LAYOUT_FIELD_TYPES.has('collapsible')).toBe(true);
			expect(LAYOUT_FIELD_TYPES.has('row')).toBe(true);
		});

		it('should not contain data field types', () => {
			expect(LAYOUT_FIELD_TYPES.has('text')).toBe(false);
			expect(LAYOUT_FIELD_TYPES.has('number')).toBe(false);
			expect(LAYOUT_FIELD_TYPES.has('group')).toBe(false);
			expect(LAYOUT_FIELD_TYPES.has('array')).toBe(false);
		});
	});

	describe('isLayoutField()', () => {
		it('should return true for tabs fields', () => {
			const field = tabs('t', { tabs: [{ label: 'Tab', fields: [] }] });
			expect(isLayoutField(field)).toBe(true);
		});

		it('should return true for collapsible fields', () => {
			const field = collapsible('c', { fields: [] });
			expect(isLayoutField(field)).toBe(true);
		});

		it('should return true for row fields', () => {
			const field = row('r', { fields: [] });
			expect(isLayoutField(field)).toBe(true);
		});

		it('should return false for data fields', () => {
			expect(isLayoutField(text('t'))).toBe(false);
			expect(isLayoutField(number('n'))).toBe(false);
			expect(isLayoutField(group('g', { fields: [] }))).toBe(false);
			expect(isLayoutField(array('a', { fields: [] }))).toBe(false);
			expect(isLayoutField(checkbox('c'))).toBe(false);
		});
	});

	describe('flattenDataFields()', () => {
		it('should return data fields as-is', () => {
			const fields = [text('title'), number('price'), checkbox('active')];
			const result = flattenDataFields(fields);
			expect(result).toHaveLength(3);
			expect(result.map((f) => f.name)).toEqual(['title', 'price', 'active']);
		});

		it('should flatten tab fields into their child data fields', () => {
			const fields = [
				text('name'),
				tabs('settings', {
					tabs: [
						{ label: 'SEO', fields: [text('metaTitle'), textarea('metaDescription')] },
						{ label: 'Social', fields: [text('ogImage')] },
					],
				}),
			];
			const result = flattenDataFields(fields);
			expect(result).toHaveLength(4);
			expect(result.map((f) => f.name)).toEqual([
				'name',
				'metaTitle',
				'metaDescription',
				'ogImage',
			]);
		});

		it('should flatten collapsible fields into their child data fields', () => {
			const fields = [
				text('title'),
				collapsible('advanced', {
					fields: [text('apiKey'), checkbox('debug')],
				}),
			];
			const result = flattenDataFields(fields);
			expect(result).toHaveLength(3);
			expect(result.map((f) => f.name)).toEqual(['title', 'apiKey', 'debug']);
		});

		it('should flatten row fields into their child data fields', () => {
			const fields = [
				row('nameRow', {
					fields: [text('firstName'), text('lastName')],
				}),
				text('email'),
			];
			const result = flattenDataFields(fields);
			expect(result).toHaveLength(3);
			expect(result.map((f) => f.name)).toEqual(['firstName', 'lastName', 'email']);
		});

		it('should handle nested layout fields recursively', () => {
			const fields = [
				tabs('outer', {
					tabs: [
						{
							label: 'Tab1',
							fields: [
								text('topField'),
								collapsible('inner', {
									fields: [
										row('innerRow', {
											fields: [text('a'), text('b')],
										}),
										number('c'),
									],
								}),
							],
						},
					],
				}),
			];
			const result = flattenDataFields(fields);
			expect(result).toHaveLength(4);
			expect(result.map((f) => f.name)).toEqual(['topField', 'a', 'b', 'c']);
		});

		it('should preserve group and array fields (they store data)', () => {
			const fields = [
				group('seo', { fields: [text('title')] }),
				array('features', { fields: [text('label')] }),
				collapsible('wrapper', {
					fields: [group('nested', { fields: [text('x')] })],
				}),
			];
			const result = flattenDataFields(fields);
			expect(result).toHaveLength(3);
			expect(result[0].type).toBe('group');
			expect(result[1].type).toBe('array');
			expect(result[2].type).toBe('group');
		});

		it('should return empty array for empty input', () => {
			expect(flattenDataFields([])).toEqual([]);
		});

		it('should treat named tabs as data fields (synthetic group)', () => {
			const fields = [
				text('title'),
				tabs('content', {
					tabs: [
						{
							name: 'seo',
							label: 'SEO',
							fields: [text('metaTitle'), textarea('metaDescription')],
						},
					],
				}),
			];
			const result = flattenDataFields(fields);
			expect(result).toHaveLength(2);
			expect(result[0].name).toBe('title');
			expect(result[1].name).toBe('seo');
			expect(result[1].type).toBe('group');
			expect((result[1] as GroupField).fields).toHaveLength(2);
		});

		it('should handle mixed named and unnamed tabs', () => {
			const fields = [
				tabs('settings', {
					tabs: [
						{ label: 'General', fields: [text('title'), text('subtitle')] },
						{ name: 'seo', label: 'SEO', fields: [text('metaTitle')] },
						{ label: 'Advanced', fields: [checkbox('debug')] },
					],
				}),
			];
			const result = flattenDataFields(fields);
			// unnamed 'title' + unnamed 'subtitle' + named 'seo' group + unnamed 'debug'
			expect(result).toHaveLength(4);
			expect(result.map((f) => f.name)).toEqual(['title', 'subtitle', 'seo', 'debug']);
			expect(result[2].type).toBe('group');
		});

		it('should preserve label and description on synthetic group from named tab', () => {
			const fields = [
				tabs('content', {
					tabs: [
						{
							name: 'seo',
							label: 'SEO Settings',
							description: 'Search engine optimization',
							fields: [text('metaTitle')],
						},
					],
				}),
			];
			const result = flattenDataFields(fields);
			expect(result[0].label).toBe('SEO Settings');
			expect(result[0].description).toBe('Search engine optimization');
		});

		it('should preserve nested layout fields inside named tabs', () => {
			const fields = [
				tabs('content', {
					tabs: [
						{
							name: 'seo',
							label: 'SEO',
							fields: [
								text('metaTitle'),
								row('social', { fields: [text('ogTitle'), text('ogImage')] }),
							],
						},
					],
				}),
			];
			const result = flattenDataFields(fields);
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('seo');
			expect(result[0].type).toBe('group');
			// The group's fields should be the original tab fields (preserved as-is)
			expect((result[0] as GroupField).fields).toHaveLength(2);
		});
	});

	describe('Field Admin Configuration', () => {
		it('should support admin config options', () => {
			const field = text('title', {
				admin: {
					position: 'sidebar',
					width: 'half',
					readOnly: true,
					hidden: false,
					placeholder: 'Enter title...',
				},
			});
			expect(field.admin).toBeDefined();
			expect(field.admin?.position).toBe('sidebar');
			expect(field.admin?.width).toBe('half');
			expect(field.admin?.readOnly).toBe(true);
		});
	});

	describe('Field Access Control', () => {
		it('should support access control functions', () => {
			const accessFn = vi.fn(() => true);
			const field = text('title', {
				access: {
					create: accessFn,
					read: accessFn,
					update: accessFn,
				},
			});
			expect(field.access).toBeDefined();
			expect(typeof field.access?.create).toBe('function');
		});
	});
});
