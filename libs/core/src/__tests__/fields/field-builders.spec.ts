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
} from '../../lib/fields';

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
