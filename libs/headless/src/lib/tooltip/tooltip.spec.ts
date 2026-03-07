import { TOOLTIP_POSITION_MAP } from './tooltip.types';

describe('Tooltip Types', () => {
	it('should have position configs for all four sides', () => {
		expect(TOOLTIP_POSITION_MAP['top']).toBeDefined();
		expect(TOOLTIP_POSITION_MAP['bottom']).toBeDefined();
		expect(TOOLTIP_POSITION_MAP['left']).toBeDefined();
		expect(TOOLTIP_POSITION_MAP['right']).toBeDefined();
	});

	it('should have primary and fallback positions for each side', () => {
		expect(TOOLTIP_POSITION_MAP['top'].length).toBe(2);
		expect(TOOLTIP_POSITION_MAP['bottom'].length).toBe(2);
		expect(TOOLTIP_POSITION_MAP['left'].length).toBe(2);
		expect(TOOLTIP_POSITION_MAP['right'].length).toBe(2);
	});

	it('should position top tooltip above element', () => {
		const pos = TOOLTIP_POSITION_MAP['top'][0];
		expect(pos.originY).toBe('top');
		expect(pos.overlayY).toBe('bottom');
		expect(pos.originX).toBe('center');
		expect(pos.overlayX).toBe('center');
	});

	it('should position bottom tooltip below element', () => {
		const pos = TOOLTIP_POSITION_MAP['bottom'][0];
		expect(pos.originY).toBe('bottom');
		expect(pos.overlayY).toBe('top');
		expect(pos.originX).toBe('center');
		expect(pos.overlayX).toBe('center');
	});

	it('should position left tooltip to the left of element', () => {
		const pos = TOOLTIP_POSITION_MAP['left'][0];
		expect(pos.originX).toBe('start');
		expect(pos.overlayX).toBe('end');
	});

	it('should position right tooltip to the right of element', () => {
		const pos = TOOLTIP_POSITION_MAP['right'][0];
		expect(pos.originX).toBe('end');
		expect(pos.overlayX).toBe('start');
	});

	it('should have opposite fallback for top position', () => {
		const fallback = TOOLTIP_POSITION_MAP['top'][1];
		expect(fallback.originY).toBe('bottom');
		expect(fallback.overlayY).toBe('top');
	});

	it('should have opposite fallback for bottom position', () => {
		const fallback = TOOLTIP_POSITION_MAP['bottom'][1];
		expect(fallback.originY).toBe('top');
		expect(fallback.overlayY).toBe('bottom');
	});
});
