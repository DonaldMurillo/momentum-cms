import { describe, it, expect } from 'vitest';
import {
	defineCollection,
	defineGlobal,
	getSoftDeleteField,
	isUploadCollection,
	getUploadFieldMapping,
} from './define-collection';
import type { CollectionConfig, GlobalConfig } from './collection.types';

const minimalCollection: CollectionConfig = {
	slug: 'posts',
	fields: [{ name: 'title', type: 'text' }],
};

const minimalGlobal: GlobalConfig = {
	slug: 'settings',
	fields: [{ name: 'siteName', type: 'text' }],
};

describe('defineCollection', () => {
	it('should return a valid collection config', () => {
		const result = defineCollection(minimalCollection);
		expect(result.slug).toBe('posts');
		expect(result.fields).toHaveLength(1);
	});

	it('should enable timestamps by default', () => {
		const result = defineCollection(minimalCollection);
		expect(result.timestamps).toBe(true);
	});

	it('should throw for empty slug', () => {
		expect(() => defineCollection({ slug: '', fields: [{ name: 'title', type: 'text' }] })).toThrow(
			'must have a slug',
		);
	});

	it('should throw for empty fields array', () => {
		expect(() => defineCollection({ slug: 'posts', fields: [] })).toThrow('at least one field');
	});

	it('should throw for undefined fields', () => {
		expect(() => defineCollection({ slug: 'posts', fields: undefined as unknown as [] })).toThrow(
			'at least one field',
		);
	});

	it('should throw for uppercase slug', () => {
		expect(() =>
			defineCollection({ slug: 'MyCollection', fields: [{ name: 'title', type: 'text' }] }),
		).toThrow('kebab-case');
	});

	it('should throw for slug starting with number', () => {
		expect(() =>
			defineCollection({ slug: '1posts', fields: [{ name: 'title', type: 'text' }] }),
		).toThrow('kebab-case');
	});

	it('should throw for slug with spaces', () => {
		expect(() =>
			defineCollection({ slug: 'my posts', fields: [{ name: 'title', type: 'text' }] }),
		).toThrow('kebab-case');
	});

	it('should throw for slug with underscores', () => {
		expect(() =>
			defineCollection({ slug: 'my_posts', fields: [{ name: 'title', type: 'text' }] }),
		).toThrow('kebab-case');
	});

	it('should accept valid kebab-case slug', () => {
		const result = defineCollection({
			slug: 'my-posts',
			fields: [{ name: 'title', type: 'text' }],
		});
		expect(result.slug).toBe('my-posts');
	});

	it('should accept slug with numbers (not starting)', () => {
		const result = defineCollection({ slug: 'posts-2', fields: [{ name: 'title', type: 'text' }] });
		expect(result.slug).toBe('posts-2');
	});

	it('should accept single-letter slug', () => {
		const result = defineCollection({ slug: 'a', fields: [{ name: 'title', type: 'text' }] });
		expect(result.slug).toBe('a');
	});
});

describe('defineGlobal', () => {
	it('should return a valid global config', () => {
		const result = defineGlobal(minimalGlobal);
		expect(result.slug).toBe('settings');
	});

	it('should throw for empty slug', () => {
		expect(() => defineGlobal({ slug: '', fields: [{ name: 'title', type: 'text' }] })).toThrow(
			'must have a slug',
		);
	});

	it('should throw for empty fields array', () => {
		expect(() => defineGlobal({ slug: 'settings', fields: [] })).toThrow('at least one field');
	});

	it('should throw for uppercase slug', () => {
		expect(() =>
			defineGlobal({ slug: 'MySettings', fields: [{ name: 'title', type: 'text' }] }),
		).toThrow('kebab-case');
	});

	it('should throw for slug starting with number', () => {
		expect(() =>
			defineGlobal({ slug: '1settings', fields: [{ name: 'title', type: 'text' }] }),
		).toThrow('kebab-case');
	});
});

describe('getSoftDeleteField', () => {
	it('should return null when softDelete is not set', () => {
		expect(getSoftDeleteField(minimalCollection)).toBeNull();
	});

	it('should return "deletedAt" when softDelete is true', () => {
		expect(getSoftDeleteField({ ...minimalCollection, softDelete: true })).toBe('deletedAt');
	});

	it('should return custom field when softDelete is an object with field', () => {
		expect(getSoftDeleteField({ ...minimalCollection, softDelete: { field: 'customField' } })).toBe(
			'customField',
		);
	});

	it('should return "deletedAt" when softDelete is an object without field', () => {
		expect(getSoftDeleteField({ ...minimalCollection, softDelete: {} })).toBe('deletedAt');
	});

	it('should throw for invalid field name starting with number', () => {
		expect(() =>
			getSoftDeleteField({ ...minimalCollection, softDelete: { field: '123bad' } }),
		).toThrow('valid identifier');
	});

	it('should throw for field name with hyphens', () => {
		expect(() =>
			getSoftDeleteField({ ...minimalCollection, softDelete: { field: 'bad-field' } }),
		).toThrow('valid identifier');
	});

	it('should accept underscore-prefixed field', () => {
		expect(getSoftDeleteField({ ...minimalCollection, softDelete: { field: '_deleted' } })).toBe(
			'_deleted',
		);
	});
});

describe('isUploadCollection', () => {
	it('should return false for non-upload collection', () => {
		expect(isUploadCollection(minimalCollection)).toBe(false);
	});

	it('should return true for upload collection', () => {
		expect(isUploadCollection({ ...minimalCollection, upload: true })).toBe(true);
	});

	it('should return true for upload collection with options', () => {
		expect(isUploadCollection({ ...minimalCollection, upload: { maxFileSize: 1024 } })).toBe(true);
	});
});

describe('getUploadFieldMapping', () => {
	it('should return null for non-upload collection', () => {
		expect(getUploadFieldMapping(minimalCollection)).toBeNull();
	});

	it('should return default field names when no custom fields specified', () => {
		const result = getUploadFieldMapping({ ...minimalCollection, upload: true });
		expect(result).toEqual({
			filename: 'filename',
			mimeType: 'mimeType',
			filesize: 'filesize',
			path: 'path',
			url: 'url',
		});
	});

	it('should return custom field names when specified', () => {
		const result = getUploadFieldMapping({
			...minimalCollection,
			upload: {
				filenameField: 'name',
				mimeTypeField: 'type',
				filesizeField: 'size',
				pathField: 'filePath',
				urlField: 'fileUrl',
			},
		});
		expect(result).toEqual({
			filename: 'name',
			mimeType: 'type',
			filesize: 'size',
			path: 'filePath',
			url: 'fileUrl',
		});
	});
});
