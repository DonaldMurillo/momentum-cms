import { describe, it, expect } from 'vitest';
import {
	validateCollectionSlug,
	validateColumnName,
	getTableName,
	isDocumentStatus,
	getStatusFromRow,
	parseJsonToRecord,
	isRecord,
} from './db-shared';
import type { CollectionConfig } from '@momentumcms/core';

describe('db-shared utilities', () => {
	describe('validateCollectionSlug', () => {
		it('should accept valid slugs', () => {
			expect(() => validateCollectionSlug('posts')).not.toThrow();
			expect(() => validateCollectionSlug('my_collection')).not.toThrow();
			expect(() => validateCollectionSlug('Posts')).not.toThrow();
			expect(() => validateCollectionSlug('_private')).not.toThrow();
			expect(() => validateCollectionSlug('my-collection')).not.toThrow();
			expect(() => validateCollectionSlug('collection123')).not.toThrow();
		});

		it('should reject slugs starting with a number', () => {
			expect(() => validateCollectionSlug('123posts')).toThrow('Invalid collection slug');
		});

		it('should reject slugs with special characters', () => {
			expect(() => validateCollectionSlug('my collection')).toThrow('Invalid collection slug');
			expect(() => validateCollectionSlug('my.collection')).toThrow('Invalid collection slug');
			expect(() => validateCollectionSlug('drop;table')).toThrow('Invalid collection slug');
		});

		it('should reject empty string', () => {
			expect(() => validateCollectionSlug('')).toThrow('Invalid collection slug');
		});

		it('should reject SQL injection attempts', () => {
			expect(() => validateCollectionSlug('posts; DROP TABLE users')).toThrow(
				'Invalid collection slug',
			);
			expect(() => validateCollectionSlug("posts' OR '1'='1")).toThrow('Invalid collection slug');
			expect(() => validateCollectionSlug('posts"--')).toThrow('Invalid collection slug');
		});
	});

	describe('validateColumnName', () => {
		it('should accept valid column names', () => {
			expect(() => validateColumnName('title')).not.toThrow();
			expect(() => validateColumnName('_status')).not.toThrow();
			expect(() => validateColumnName('createdAt')).not.toThrow();
			expect(() => validateColumnName('field_123')).not.toThrow();
		});

		it('should reject column names with hyphens', () => {
			expect(() => validateColumnName('my-field')).toThrow('Invalid column name');
		});

		it('should reject column names starting with a number', () => {
			expect(() => validateColumnName('1field')).toThrow('Invalid column name');
		});

		it('should reject column names with spaces or special chars', () => {
			expect(() => validateColumnName('my field')).toThrow('Invalid column name');
			expect(() => validateColumnName('field;drop')).toThrow('Invalid column name');
			expect(() => validateColumnName('field"name')).toThrow('Invalid column name');
		});

		it('should reject empty string', () => {
			expect(() => validateColumnName('')).toThrow('Invalid column name');
		});
	});

	describe('getTableName', () => {
		it('should return dbName when specified', () => {
			const collection = { slug: 'posts', dbName: 'custom_posts' } as CollectionConfig;
			expect(getTableName(collection)).toBe('custom_posts');
		});

		it('should fall back to slug when dbName is not specified', () => {
			const collection = { slug: 'posts' } as CollectionConfig;
			expect(getTableName(collection)).toBe('posts');
		});

		it('should fall back to slug when dbName is undefined', () => {
			const collection = { slug: 'users', dbName: undefined } as CollectionConfig;
			expect(getTableName(collection)).toBe('users');
		});
	});

	describe('isDocumentStatus', () => {
		it('should return true for "draft"', () => {
			expect(isDocumentStatus('draft')).toBe(true);
		});

		it('should return true for "published"', () => {
			expect(isDocumentStatus('published')).toBe(true);
		});

		it('should return false for other strings', () => {
			expect(isDocumentStatus('archived')).toBe(false);
			expect(isDocumentStatus('pending')).toBe(false);
			expect(isDocumentStatus('')).toBe(false);
		});

		it('should return false for non-string values', () => {
			expect(isDocumentStatus(null)).toBe(false);
			expect(isDocumentStatus(undefined)).toBe(false);
			expect(isDocumentStatus(42)).toBe(false);
			expect(isDocumentStatus(true)).toBe(false);
			expect(isDocumentStatus({})).toBe(false);
		});
	});

	describe('getStatusFromRow', () => {
		it('should return status when _status is "draft"', () => {
			expect(getStatusFromRow({ _status: 'draft' })).toBe('draft');
		});

		it('should return status when _status is "published"', () => {
			expect(getStatusFromRow({ _status: 'published' })).toBe('published');
		});

		it('should default to "draft" when _status is missing', () => {
			expect(getStatusFromRow({})).toBe('draft');
		});

		it('should default to "draft" when _status is an invalid value', () => {
			expect(getStatusFromRow({ _status: 'archived' })).toBe('draft');
			expect(getStatusFromRow({ _status: null })).toBe('draft');
			expect(getStatusFromRow({ _status: 123 })).toBe('draft');
		});
	});

	describe('parseJsonToRecord', () => {
		it('should parse valid JSON object', () => {
			expect(parseJsonToRecord('{"key": "value"}')).toEqual({ key: 'value' });
		});

		it('should parse nested JSON', () => {
			const result = parseJsonToRecord('{"a": {"b": 1}, "c": [1, 2]}');
			expect(result).toEqual({ a: { b: 1 }, c: [1, 2] });
		});

		it('should pass through parsed arrays (typeof array is object)', () => {
			// Arrays pass the `typeof === 'object' && !== null` check, so they are returned as-is

			expect(parseJsonToRecord('[1, 2, 3]')).toEqual([1, 2, 3] as unknown as Record<
				string,
				unknown
			>);
		});

		it('should return empty object for JSON primitives', () => {
			expect(parseJsonToRecord('"hello"')).toEqual({});
			expect(parseJsonToRecord('42')).toEqual({});
			expect(parseJsonToRecord('true')).toEqual({});
			expect(parseJsonToRecord('null')).toEqual({});
		});

		it('should return empty object for invalid JSON', () => {
			expect(parseJsonToRecord('not json')).toEqual({});
			expect(parseJsonToRecord('{broken')).toEqual({});
			expect(parseJsonToRecord('')).toEqual({});
		});
	});

	describe('isRecord', () => {
		it('should return true for plain objects', () => {
			expect(isRecord({})).toBe(true);
			expect(isRecord({ key: 'value' })).toBe(true);
		});

		it('should return true for arrays (they are objects)', () => {
			expect(isRecord([])).toBe(true);
		});

		it('should return false for null', () => {
			expect(isRecord(null)).toBe(false);
		});

		it('should return false for primitives', () => {
			expect(isRecord(undefined)).toBe(false);
			expect(isRecord('string')).toBe(false);
			expect(isRecord(42)).toBe(false);
			expect(isRecord(true)).toBe(false);
		});
	});
});
