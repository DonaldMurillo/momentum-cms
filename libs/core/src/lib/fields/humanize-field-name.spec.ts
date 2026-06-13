import { describe, it, expect } from 'vitest';
import { humanizeFieldName } from './humanize-field-name';

describe('humanizeFieldName', () => {
	it('should return empty string for empty input', () => {
		expect(humanizeFieldName('')).toBe('');
	});

	it('should capitalize a single lowercase character', () => {
		expect(humanizeFieldName('a')).toBe('A');
	});

	it('should preserve a single uppercase character', () => {
		expect(humanizeFieldName('A')).toBe('A');
	});

	it('should split camelCase', () => {
		expect(humanizeFieldName('firstName')).toBe('First Name');
	});

	it('should split PascalCase', () => {
		expect(humanizeFieldName('FirstName')).toBe('First Name');
	});

	it('should preserve all-caps acronym without splitting', () => {
		expect(humanizeFieldName('XML')).toBe('XML');
	});

	it('should split acronym followed by word', () => {
		expect(humanizeFieldName('XMLParser')).toBe('XML Parser');
	});

	it('should split word followed by acronym', () => {
		expect(humanizeFieldName('parseHTML')).toBe('Parse HTML');
	});

	it('should handle consecutive underscores without double spaces', () => {
		expect(humanizeFieldName('hello__world')).toBe('Hello World');
	});

	it('should handle consecutive hyphens without double spaces', () => {
		expect(humanizeFieldName('hello--world')).toBe('Hello World');
	});

	it('should handle mixed separators (underscore + hyphen)', () => {
		expect(humanizeFieldName('firstName_last-name')).toBe('First Name Last Name');
	});

	it('should capitalize words that already have spaces', () => {
		expect(humanizeFieldName('first name')).toBe('First Name');
	});

	it('should handle SCREAMING_SNAKE_CASE', () => {
		expect(humanizeFieldName('MY_FIELD')).toBe('MY FIELD');
	});

	it('should not split on number boundaries (no special handling)', () => {
		// Function does not insert spaces around numbers
		expect(humanizeFieldName('field2Name')).toBe('Field2Name');
	});

	it('should trim leading/trailing separators', () => {
		expect(humanizeFieldName('_fieldName')).toBe('Field Name');
		expect(humanizeFieldName('fieldName_')).toBe('Field Name');
	});

	it('should return empty string for pure separator', () => {
		expect(humanizeFieldName('_')).toBe('');
		expect(humanizeFieldName('-')).toBe('');
	});

	it('should handle numeric-only input', () => {
		expect(humanizeFieldName('123')).toBe('123');
	});

	it('should handle createdAt', () => {
		expect(humanizeFieldName('createdAt')).toBe('Created At');
	});

	it('should handle SEOTitle (acronym boundary)', () => {
		expect(humanizeFieldName('SEOTitle')).toBe('SEO Title');
	});
});
