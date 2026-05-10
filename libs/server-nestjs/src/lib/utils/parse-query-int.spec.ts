import { describe, it, expect } from 'vitest';
import { parsePositiveInt } from './parse-query-int';

describe('parsePositiveInt', () => {
	it('returns undefined for missing/empty input', () => {
		expect(parsePositiveInt(undefined)).toBeUndefined();
		expect(parsePositiveInt('')).toBeUndefined();
	});

	it('parses positive integers from numeric strings', () => {
		expect(parsePositiveInt('1')).toBe(1);
		expect(parsePositiveInt('42')).toBe(42);
		expect(parsePositiveInt('1000')).toBe(1000);
	});

	it('rejects zero and negative values (must be strictly positive)', () => {
		expect(parsePositiveInt('0')).toBeUndefined();
		expect(parsePositiveInt('-1')).toBeUndefined();
		expect(parsePositiveInt('-100')).toBeUndefined();
	});

	it('rejects non-numeric, NaN, and Infinity-keyword inputs', () => {
		expect(parsePositiveInt('abc')).toBeUndefined();
		expect(parsePositiveInt('NaN')).toBeUndefined();
		expect(parsePositiveInt('Infinity')).toBeUndefined();
	});

	it('truncates via parseInt(_, 10) — fractional and exponent inputs keep the integer prefix', () => {
		// Documents the parseInt(_, 10) behaviour so callers know `3.7` is
		// accepted as 3 and `1e500` is accepted as 1 (parseInt stops at
		// the first non-base-10 character — `.`, `e`, etc.).
		expect(parsePositiveInt('3.7')).toBe(3);
		expect(parsePositiveInt('10.0')).toBe(10);
		expect(parsePositiveInt('1e500')).toBe(1);
	});
});
