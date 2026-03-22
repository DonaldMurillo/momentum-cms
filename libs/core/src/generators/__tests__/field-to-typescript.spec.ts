import { describe, it, expect } from 'vitest';
import { slugToPascalCase, fieldTypeToTS } from '../field-to-typescript';
import type { Field } from '../../lib/fields/field.types';

// ============================================
// slugToPascalCase Tests
// ============================================

describe('slugToPascalCase', () => {
	it('should convert simple slug to PascalCase', () => {
		expect(slugToPascalCase('posts')).toBe('Posts');
	});

	it('should convert kebab-case to PascalCase', () => {
		expect(slugToPascalCase('auth-user')).toBe('AuthUser');
	});

	it('should convert multi-part slug to PascalCase', () => {
		expect(slugToPascalCase('hook-test-items')).toBe('HookTestItems');
	});

	it('should handle single character segments', () => {
		expect(slugToPascalCase('a-b-c')).toBe('ABC');
	});

	it('should handle empty string', () => {
		expect(slugToPascalCase('')).toBe('');
	});
});

// ============================================
// fieldTypeToTS Tests
// ============================================

describe('fieldTypeToTS', () => {
	it('should return unknown[] for blocks field type', () => {
		const field = { name: 'content', type: 'blocks' } as Field;
		expect(fieldTypeToTS(field)).toBe('unknown[]');
	});
});
