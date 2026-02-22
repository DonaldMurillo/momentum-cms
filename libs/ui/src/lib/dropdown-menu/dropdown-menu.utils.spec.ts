import { describe, it, expect } from 'vitest';
import { getDropdownPositions } from './dropdown-menu.utils';

describe('getDropdownPositions', () => {
	describe('bottom side', () => {
		it('should place primary position below with center alignment', () => {
			const positions = getDropdownPositions('bottom', 'center', 4);
			expect(positions[0]).toEqual({
				originX: 'center',
				originY: 'bottom',
				overlayX: 'center',
				overlayY: 'top',
				offsetY: 4,
			});
		});

		it('should add fallback position above for bottom side', () => {
			const positions = getDropdownPositions('bottom', 'center', 4);
			expect(positions).toHaveLength(2);
			expect(positions[1]).toEqual({
				originX: 'center',
				originY: 'top',
				overlayX: 'center',
				overlayY: 'bottom',
				offsetY: -4,
			});
		});

		it('should align start correctly', () => {
			const positions = getDropdownPositions('bottom', 'start', 8);
			expect(positions[0].originX).toBe('start');
			expect(positions[0].overlayX).toBe('start');
			expect(positions[0].offsetY).toBe(8);
		});

		it('should align end correctly', () => {
			const positions = getDropdownPositions('bottom', 'end', 8);
			expect(positions[0].originX).toBe('end');
			expect(positions[0].overlayX).toBe('end');
		});
	});

	describe('top side', () => {
		it('should place primary position above with center alignment', () => {
			const positions = getDropdownPositions('top', 'center', 4);
			expect(positions[0]).toEqual({
				originX: 'center',
				originY: 'top',
				overlayX: 'center',
				overlayY: 'bottom',
				offsetY: -4,
			});
		});

		it('should add fallback position below for top side', () => {
			const positions = getDropdownPositions('top', 'center', 4);
			expect(positions).toHaveLength(2);
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
			const positions = getDropdownPositions('left', 'center', 4);
			expect(positions[0]).toEqual({
				originX: 'start',
				originY: 'center',
				overlayX: 'end',
				overlayY: 'center',
				offsetX: -4,
			});
		});

		it('should map start align to top for left side', () => {
			const positions = getDropdownPositions('left', 'start', 4);
			expect(positions[0].originY).toBe('top');
			expect(positions[0].overlayY).toBe('top');
		});

		it('should map end align to bottom for left side', () => {
			const positions = getDropdownPositions('left', 'end', 4);
			expect(positions[0].originY).toBe('bottom');
			expect(positions[0].overlayY).toBe('bottom');
		});

		it('should not add fallback for left side', () => {
			const positions = getDropdownPositions('left', 'center', 4);
			expect(positions).toHaveLength(1);
		});
	});

	describe('right side', () => {
		it('should place primary position to the right with center alignment', () => {
			const positions = getDropdownPositions('right', 'center', 4);
			expect(positions[0]).toEqual({
				originX: 'end',
				originY: 'center',
				overlayX: 'start',
				overlayY: 'center',
				offsetX: 4,
			});
		});

		it('should map start align to top for right side', () => {
			const positions = getDropdownPositions('right', 'start', 4);
			expect(positions[0].originY).toBe('top');
			expect(positions[0].overlayY).toBe('top');
		});

		it('should map end align to bottom for right side', () => {
			const positions = getDropdownPositions('right', 'end', 4);
			expect(positions[0].originY).toBe('bottom');
			expect(positions[0].overlayY).toBe('bottom');
		});

		it('should not add fallback for right side', () => {
			const positions = getDropdownPositions('right', 'center', 4);
			expect(positions).toHaveLength(1);
		});
	});

	it('should apply zero offset correctly', () => {
		const positions = getDropdownPositions('bottom', 'center', 0);
		expect(positions[0].offsetY).toBe(0);
	});
});
