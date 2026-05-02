import { describe, it, expect } from 'vitest';
import { normalizeApiKeyRole } from '../lib/api-keys';

describe('normalizeApiKeyRole', () => {
	it('should return the role when it is a valid string', () => {
		expect(normalizeApiKeyRole('admin')).toBe('admin');
		expect(normalizeApiKeyRole('editor')).toBe('editor');
		expect(normalizeApiKeyRole('user')).toBe('user');
	});

	it('should fall back to "user" when role is undefined', () => {
		expect(normalizeApiKeyRole(undefined)).toBe('user');
	});

	it('should fall back to "user" when role is null', () => {
		expect(normalizeApiKeyRole(null)).toBe('user');
	});

	it('should fall back to "user" when role is a non-string value', () => {
		expect(normalizeApiKeyRole(123)).toBe('user');
		expect(normalizeApiKeyRole({})).toBe('user');
		expect(normalizeApiKeyRole([])).toBe('user');
	});

	it('should fall back to "user" when role is an empty string', () => {
		expect(normalizeApiKeyRole('')).toBe('user');
	});
});
