import type { ConnectedPosition } from '@angular/cdk/overlay';

export type TooltipPosition = 'top' | 'right' | 'bottom' | 'left';

export const TOOLTIP_POSITION_MAP: Record<TooltipPosition, ConnectedPosition[]> = {
	top: [
		{ originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
		{ originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
	],
	bottom: [
		{ originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
		{ originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
	],
	left: [
		{ originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'center', offsetX: -8 },
		{ originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center', offsetX: 8 },
	],
	right: [
		{ originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center', offsetX: 8 },
		{ originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'center', offsetX: -8 },
	],
};
