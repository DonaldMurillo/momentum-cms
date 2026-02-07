import { describe, it, expect } from 'vitest';
import { humanizeFieldName } from '../../lib/fields/humanize-field-name';

describe('humanizeFieldName', () => {
	it('converts camelCase to Title Case', () => {
		expect(humanizeFieldName('firstName')).toBe('First Name');
		expect(humanizeFieldName('createdAt')).toBe('Created At');
		expect(humanizeFieldName('isPublished')).toBe('Is Published');
	});

	it('converts PascalCase to Title Case', () => {
		expect(humanizeFieldName('FirstName')).toBe('First Name');
		expect(humanizeFieldName('CreatedAt')).toBe('Created At');
	});

	it('converts snake_case to Title Case', () => {
		expect(humanizeFieldName('first_name')).toBe('First Name');
		expect(humanizeFieldName('created_at')).toBe('Created At');
	});

	it('converts kebab-case to Title Case', () => {
		expect(humanizeFieldName('first-name')).toBe('First Name');
		expect(humanizeFieldName('created-at')).toBe('Created At');
	});

	it('handles consecutive uppercase letters (acronyms)', () => {
		expect(humanizeFieldName('SEOTitle')).toBe('SEO Title');
		expect(humanizeFieldName('HTMLParser')).toBe('HTML Parser');
		expect(humanizeFieldName('apiURL')).toBe('Api URL');
	});

	it('handles single words', () => {
		expect(humanizeFieldName('title')).toBe('Title');
		expect(humanizeFieldName('name')).toBe('Name');
		expect(humanizeFieldName('id')).toBe('Id');
	});

	it('returns empty string for empty input', () => {
		expect(humanizeFieldName('')).toBe('');
	});

	it('handles mixed separators', () => {
		expect(humanizeFieldName('my_field-name')).toBe('My Field Name');
	});
});
