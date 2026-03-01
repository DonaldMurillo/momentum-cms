import { describe, it, expect } from 'vitest';
import {
	normalizeFocalPoint,
	clampFocalPoint,
	focalPointToCssPosition,
} from '../focal-point-utils';

describe('normalizeFocalPoint', () => {
	it('should convert click at center to (0.5, 0.5)', () => {
		const result = normalizeFocalPoint({ x: 100, y: 50 }, { width: 200, height: 100 });
		expect(result).toEqual({ x: 0.5, y: 0.5 });
	});

	it('should convert click at top-left to (0, 0)', () => {
		const result = normalizeFocalPoint({ x: 0, y: 0 }, { width: 200, height: 100 });
		expect(result).toEqual({ x: 0, y: 0 });
	});

	it('should convert click at bottom-right to (1, 1)', () => {
		const result = normalizeFocalPoint({ x: 200, y: 100 }, { width: 200, height: 100 });
		expect(result).toEqual({ x: 1, y: 1 });
	});

	it('should handle non-integer click positions', () => {
		const result = normalizeFocalPoint({ x: 50, y: 25 }, { width: 200, height: 100 });
		expect(result).toEqual({ x: 0.25, y: 0.25 });
	});

	it('should clamp values exceeding boundaries', () => {
		const result = normalizeFocalPoint({ x: 250, y: -10 }, { width: 200, height: 100 });
		expect(result.x).toBe(1);
		expect(result.y).toBe(0);
	});
});

describe('clampFocalPoint', () => {
	it('should return same point when within range', () => {
		expect(clampFocalPoint({ x: 0.5, y: 0.5 })).toEqual({ x: 0.5, y: 0.5 });
	});

	it('should clamp x below 0', () => {
		expect(clampFocalPoint({ x: -0.1, y: 0.5 })).toEqual({ x: 0, y: 0.5 });
	});

	it('should clamp x above 1', () => {
		expect(clampFocalPoint({ x: 1.5, y: 0.5 })).toEqual({ x: 1, y: 0.5 });
	});

	it('should clamp y below 0', () => {
		expect(clampFocalPoint({ x: 0.5, y: -0.3 })).toEqual({ x: 0.5, y: 0 });
	});

	it('should clamp y above 1', () => {
		expect(clampFocalPoint({ x: 0.5, y: 2 })).toEqual({ x: 0.5, y: 1 });
	});

	it('should clamp both axes simultaneously', () => {
		expect(clampFocalPoint({ x: -1, y: 5 })).toEqual({ x: 0, y: 1 });
	});
});

describe('focalPointToCssPosition', () => {
	it('should convert center focal point to 50% 50%', () => {
		expect(focalPointToCssPosition({ x: 0.5, y: 0.5 })).toBe('50% 50%');
	});

	it('should convert top-left to 0% 0%', () => {
		expect(focalPointToCssPosition({ x: 0, y: 0 })).toBe('0% 0%');
	});

	it('should convert bottom-right to 100% 100%', () => {
		expect(focalPointToCssPosition({ x: 1, y: 1 })).toBe('100% 100%');
	});

	it('should convert arbitrary focal point', () => {
		expect(focalPointToCssPosition({ x: 0.25, y: 0.75 })).toBe('25% 75%');
	});

	it('should handle default focal point when none provided', () => {
		expect(focalPointToCssPosition()).toBe('50% 50%');
	});
});
