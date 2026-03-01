import { describe, it, expect } from 'vitest';
import { validateFocalPoint } from '../../lib/collections/media.collection';

const args = { data: {}, req: {} };

describe('validateFocalPoint', () => {
	// --- Valid cases ---

	it('should accept null (field is optional)', () => {
		expect(validateFocalPoint(null, args)).toBe(true);
	});

	it('should accept undefined (field is optional)', () => {
		expect(validateFocalPoint(undefined, args)).toBe(true);
	});

	it('should accept valid center point', () => {
		expect(validateFocalPoint({ x: 0.5, y: 0.5 }, args)).toBe(true);
	});

	it('should accept minimum corner (0, 0)', () => {
		expect(validateFocalPoint({ x: 0, y: 0 }, args)).toBe(true);
	});

	it('should accept maximum corner (1, 1)', () => {
		expect(validateFocalPoint({ x: 1, y: 1 }, args)).toBe(true);
	});

	it('should accept arbitrary valid floats', () => {
		expect(validateFocalPoint({ x: 0.123, y: 0.987 }, args)).toBe(true);
	});

	// --- Invalid: wrong type/shape ---

	it('should reject an array', () => {
		expect(typeof validateFocalPoint([0.5, 0.5], args)).toBe('string');
	});

	it('should reject a plain string', () => {
		expect(typeof validateFocalPoint('0.5,0.5', args)).toBe('string');
	});

	it('should reject a number', () => {
		expect(typeof validateFocalPoint(42, args)).toBe('string');
	});

	it('should reject an empty object', () => {
		expect(typeof validateFocalPoint({}, args)).toBe('string');
	});

	it('should reject an object with only x', () => {
		expect(typeof validateFocalPoint({ x: 0.5 }, args)).toBe('string');
	});

	it('should reject an object with only y', () => {
		expect(typeof validateFocalPoint({ y: 0.5 }, args)).toBe('string');
	});

	// --- Invalid: non-finite numbers ---

	it('should reject NaN for x', () => {
		expect(typeof validateFocalPoint({ x: NaN, y: 0.5 }, args)).toBe('string');
	});

	it('should reject NaN for y', () => {
		expect(typeof validateFocalPoint({ x: 0.5, y: NaN }, args)).toBe('string');
	});

	it('should reject Infinity for x', () => {
		expect(typeof validateFocalPoint({ x: Infinity, y: 0.5 }, args)).toBe('string');
	});

	// --- Invalid: out of range ---

	it('should reject x below 0', () => {
		expect(typeof validateFocalPoint({ x: -0.1, y: 0.5 }, args)).toBe('string');
	});

	it('should reject x above 1', () => {
		expect(typeof validateFocalPoint({ x: 1.1, y: 0.5 }, args)).toBe('string');
	});

	it('should reject y below 0', () => {
		expect(typeof validateFocalPoint({ x: 0.5, y: -0.01 }, args)).toBe('string');
	});

	it('should reject y above 1', () => {
		expect(typeof validateFocalPoint({ x: 0.5, y: 1.001 }, args)).toBe('string');
	});
});
