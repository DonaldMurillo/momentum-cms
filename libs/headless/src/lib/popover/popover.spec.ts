import { getPopoverPositions } from './popover.utils';

describe('Popover Utils', () => {
	it('should return positions for bottom side', () => {
		const positions = getPopoverPositions('bottom', 'center', 4);
		expect(positions.length).toBe(2);
		expect(positions[0].originY).toBe('bottom');
		expect(positions[0].overlayY).toBe('top');
	});

	it('should return positions for top side', () => {
		const positions = getPopoverPositions('top', 'center', 4);
		expect(positions.length).toBe(2);
		expect(positions[0].originY).toBe('top');
		expect(positions[0].overlayY).toBe('bottom');
	});

	it('should return positions for left side', () => {
		const positions = getPopoverPositions('left', 'center', 4);
		expect(positions.length).toBe(2);
		expect(positions[0].originX).toBe('start');
		expect(positions[0].overlayX).toBe('end');
	});

	it('should return positions for right side', () => {
		const positions = getPopoverPositions('right', 'center', 4);
		expect(positions.length).toBe(2);
		expect(positions[0].originX).toBe('end');
		expect(positions[0].overlayX).toBe('start');
	});

	it('should apply offset to bottom position', () => {
		const positions = getPopoverPositions('bottom', 'center', 8);
		expect(positions[0].offsetY).toBe(8);
	});

	it('should respect start alignment', () => {
		const positions = getPopoverPositions('bottom', 'start', 4);
		expect(positions[0].originX).toBe('start');
		expect(positions[0].overlayX).toBe('start');
	});

	it('should respect end alignment', () => {
		const positions = getPopoverPositions('bottom', 'end', 4);
		expect(positions[0].originX).toBe('end');
		expect(positions[0].overlayX).toBe('end');
	});
});
