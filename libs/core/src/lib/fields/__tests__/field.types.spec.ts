import { describe, it, expect } from 'vitest';
import { ReferentialIntegrityError } from '../field.types';

// ============================================
// ReferentialIntegrityError Tests
// ============================================

describe('ReferentialIntegrityError', () => {
	it('should be an instance of Error', () => {
		const error = new ReferentialIntegrityError('users', 'fk_posts_author');
		expect(error).toBeInstanceOf(Error);
	});

	it('should have the correct name', () => {
		const error = new ReferentialIntegrityError('users', 'fk_posts_author');
		expect(error.name).toBe('ReferentialIntegrityError');
	});

	it('should store table and constraint properties', () => {
		const error = new ReferentialIntegrityError('users', 'fk_posts_author');
		expect(error.table).toBe('users');
		expect(error.constraint).toBe('fk_posts_author');
	});

	it('should produce a descriptive message', () => {
		const error = new ReferentialIntegrityError('users', 'fk_posts_author');
		expect(error.message).toBe(
			'Cannot delete from "users": referenced by foreign key constraint "fk_posts_author"',
		);
	});

	it('should have a stack trace', () => {
		const error = new ReferentialIntegrityError('orders', 'fk_line_items');
		expect(error.stack).toBeDefined();
		expect(error.stack).toContain('ReferentialIntegrityError');
	});
});
