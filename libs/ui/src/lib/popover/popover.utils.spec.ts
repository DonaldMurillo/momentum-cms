import { describe, it, expect } from 'vitest';
import { getPopoverPositions } from './popover.utils';

describe('getPopoverPositions', () => {
	describe('bottom side', () => {
		it('should place primary position below with center alignment', () => {
			const positions = getPopoverPositions('bottom', 'center', 4);
			expect(positions[0]).toEqual({
				originX: 'center',
				originY: 'bottom',
				overlayX: 'center',
				overlayY: 'top',
				offsetY: 4,
			});
		});

		it('should add fallback position above', () => {
			const positions = getPopoverPositions('bottom', 'center', 4);
			expect(positions[1]).toEqual({
				originX: 'center',
				originY: 'top',
				overlayX: 'center',
				overlayY: 'bottom',
				offsetY: -4,
			});
		});

		it('should align start correctly', () => {
			const positions = getPopoverPositions('bottom', 'start', 8);
			expect(positions[0].originX).toBe('start');
			expect(positions[0].overlayX).toBe('start');
			expect(positions[0].offsetY).toBe(8);
		});

		it('should align end correctly', () => {
			const positions = getPopoverPositions('bottom', 'end', 8);
			expect(positions[0].originX).toBe('end');
			expect(positions[0].overlayX).toBe('end');
		});
	});

	describe('top side', () => {
		it('should place primary position above with center alignment', () => {
			const positions = getPopoverPositions('top', 'center', 4);
			expect(positions[0]).toEqual({
				originX: 'center',
				originY: 'top',
				overlayX: 'center',
				overlayY: 'bottom',
				offsetY: -4,
			});
		});

		it('should add fallback position below', () => {
			const positions = getPopoverPositions('top', 'center', 4);
			expect(positions[1]).toEqual({
				originX: 'center',
				originY: 'bottom',
				overlayX: 'center',
				overlayY: 'top',
				offsetY: 4,
			});
		});
	});

	describe('left side', () => {
		it('should place primary position to the left with center alignment', () => {
			const positions = getPopoverPositions('left', 'center', 4);
			expect(positions[0]).toEqual({
				originX: 'start',
				originY: 'center',
				overlayX: 'end',
				overlayY: 'center',
				offsetX: -4,
			});
		});

		it('should map start align to top for left side', () => {
			const positions = getPopoverPositions('left', 'start', 4);
			expect(positions[0].originY).toBe('top');
			expect(positions[0].overlayY).toBe('top');
		});

		it('should map end align to bottom for left side', () => {
			const positions = getPopoverPositions('left', 'end', 4);
			expect(positions[0].originY).toBe('bottom');
			expect(positions[0].overlayY).toBe('bottom');
		});

		it('should add fallback position on right', () => {
			const positions = getPopoverPositions('left', 'center', 4);
			expect(positions[1].originX).toBe('end');
			expect(positions[1].overlayX).toBe('start');
			expect(positions[1].offsetX).toBe(4);
		});
	});

	describe('right side', () => {
		it('should place primary position to the right with center alignment', () => {
			const positions = getPopoverPositions('right', 'center', 4);
			expect(positions[0]).toEqual({
				originX: 'end',
				originY: 'center',
				overlayX: 'start',
				overlayY: 'center',
				offsetX: 4,
			});
		});

		it('should map start align to top for right side', () => {
			const positions = getPopoverPositions('right', 'start', 4);
			expect(positions[0].originY).toBe('top');
			expect(positions[0].overlayY).toBe('top');
		});

		it('should map end align to bottom for right side', () => {
			const positions = getPopoverPositions('right', 'end', 4);
			expect(positions[0].originY).toBe('bottom');
			expect(positions[0].overlayY).toBe('bottom');
		});

		it('should add fallback position on left', () => {
			const positions = getPopoverPositions('right', 'center', 4);
			expect(positions[1].originX).toBe('start');
			expect(positions[1].overlayX).toBe('end');
			expect(positions[1].offsetX).toBe(-4);
		});
	});

	it('should apply zero offset correctly', () => {
		const positions = getPopoverPositions('bottom', 'center', 0);
		expect(positions[0].offsetY).toBe(0);
		expect(positions[1].offsetY).toBe(-0);
	});

	it('should always return exactly 2 positions', () => {
		expect(getPopoverPositions('top', 'center', 4)).toHaveLength(2);
		expect(getPopoverPositions('bottom', 'start', 4)).toHaveLength(2);
		expect(getPopoverPositions('left', 'end', 4)).toHaveLength(2);
		expect(getPopoverPositions('right', 'center', 4)).toHaveLength(2);
	});
});
