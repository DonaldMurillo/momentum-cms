import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { ParseQueryPipe } from './parse-query.pipe';

describe('ParseQueryPipe', () => {
	const pipe = new ParseQueryPipe();

	it('should parse limit and page as numbers', () => {
		const result = pipe.transform({ limit: '10', page: '2' }, {} as never);
		expect(result.limit).toBe(10);
		expect(result.page).toBe(2);
	});

	it('should pass through sort as string', () => {
		const result = pipe.transform({ sort: '-createdAt' }, {} as never);
		expect(result.sort).toBe('-createdAt');
	});

	it('should parse depth as number', () => {
		const result = pipe.transform({ depth: '3' }, {} as never);
		expect(result.depth).toBe(3);
	});

	it('should parse where JSON string', () => {
		const where = JSON.stringify({ title: { equals: 'hello' } });
		const result = pipe.transform({ where }, {} as never);
		expect(result.where).toEqual({ title: { equals: 'hello' } });
	});

	it('should handle missing params gracefully', () => {
		const result = pipe.transform({}, {} as never);
		expect(result.limit).toBeUndefined();
		expect(result.page).toBeUndefined();
		expect(result.sort).toBeUndefined();
		expect(result.where).toBeUndefined();
	});

	it('should handle invalid limit gracefully', () => {
		const result = pipe.transform({ limit: 'abc' }, {} as never);
		expect(result.limit).toBeUndefined();
	});

	it('should handle invalid where JSON gracefully', () => {
		const result = pipe.transform({ where: 'not-json' }, {} as never);
		expect(result.where).toBeUndefined();
	});

	it('should parse withDeleted and onlyDeleted as booleans', () => {
		const result = pipe.transform({ withDeleted: 'true', onlyDeleted: 'false' }, {} as never);
		expect(result.withDeleted).toBe(true);
		expect(result.onlyDeleted).toBe(false);
	});
});
