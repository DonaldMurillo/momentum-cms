import { describe, it, expect } from 'vitest';
import { calculatePreviewCrop } from '../canvas-preview-utils';

describe('calculatePreviewCrop', () => {
	it('should calculate center crop for square source to landscape target', () => {
		const result = calculatePreviewCrop({ width: 100, height: 100 }, { width: 50, height: 25 });
		// Need to crop vertically: scale = max(50/100, 25/100) = 0.5
		// cropW = 50/0.5 = 100, cropH = 25/0.5 = 50
		expect(result).toEqual({ x: 0, y: 25, width: 100, height: 50 });
	});

	it('should calculate center crop for landscape source to square target', () => {
		const result = calculatePreviewCrop({ width: 200, height: 100 }, { width: 100, height: 100 });
		// scale = max(100/200, 100/100) = 1.0
		// cropW = 100/1 = 100, cropH = 100/1 = 100
		expect(result).toEqual({ x: 50, y: 0, width: 100, height: 100 });
	});

	it('should use focal point to offset crop region', () => {
		const result = calculatePreviewCrop(
			{ width: 100, height: 100 },
			{ width: 50, height: 25 },
			{ x: 0.8, y: 0.2 },
		);
		// scale = 0.5, cropW = 100, cropH = 50
		// focalY = 0.2 * 100 = 20, centerY = 20 - 25 = -5, clamped to 0
		expect(result.y).toBe(0);
		expect(result.width).toBe(100);
		expect(result.height).toBe(50);
	});

	it('should clamp crop region to source boundaries', () => {
		const result = calculatePreviewCrop(
			{ width: 100, height: 100 },
			{ width: 50, height: 25 },
			{ x: 0.5, y: 1.0 },
		);
		// focalY = 100, cropH = 50, centerY = 100 - 25 = 75, clamped to 50
		expect(result.y).toBe(50);
		expect(result.height).toBe(50);
	});

	it('should return full source when source matches target aspect ratio', () => {
		const result = calculatePreviewCrop({ width: 200, height: 100 }, { width: 100, height: 50 });
		// Same aspect ratio: scale = 0.5, cropW = 200, cropH = 100
		expect(result).toEqual({ x: 0, y: 0, width: 200, height: 100 });
	});

	it('should handle portrait source to landscape target', () => {
		const result = calculatePreviewCrop({ width: 50, height: 200 }, { width: 100, height: 50 });
		// scale = max(100/50, 50/200) = 2.0
		// cropW = 100/2 = 50, cropH = 50/2 = 25
		expect(result.width).toBe(50);
		expect(result.height).toBe(25);
		expect(result.x).toBe(0);
	});
});
