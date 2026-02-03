import type { ConnectedPosition } from '@angular/cdk/overlay';
import type { DropdownMenuAlign, DropdownMenuSide } from './dropdown-menu.types';

export function getDropdownPositions(
	side: DropdownMenuSide,
	align: DropdownMenuAlign,
	offset: number,
): ConnectedPosition[] {
	const positions: ConnectedPosition[] = [];

	const alignMap: Record<
		DropdownMenuAlign,
		{ originX: 'start' | 'center' | 'end'; overlayX: 'start' | 'center' | 'end' }
	> = {
		start: { originX: 'start', overlayX: 'start' },
		center: { originX: 'center', overlayX: 'center' },
		end: { originX: 'end', overlayX: 'end' },
	};

	const alignment = alignMap[align];

	switch (side) {
		case 'top':
			positions.push({
				originX: alignment.originX,
				originY: 'top',
				overlayX: alignment.overlayX,
				overlayY: 'bottom',
				offsetY: -offset,
			});
			break;
		case 'bottom':
			positions.push({
				originX: alignment.originX,
				originY: 'bottom',
				overlayX: alignment.overlayX,
				overlayY: 'top',
				offsetY: offset,
			});
			break;
		case 'left':
			positions.push({
				originX: 'start',
				originY: align === 'start' ? 'top' : align === 'end' ? 'bottom' : 'center',
				overlayX: 'end',
				overlayY: align === 'start' ? 'top' : align === 'end' ? 'bottom' : 'center',
				offsetX: -offset,
			});
			break;
		case 'right':
			positions.push({
				originX: 'end',
				originY: align === 'start' ? 'top' : align === 'end' ? 'bottom' : 'center',
				overlayX: 'start',
				overlayY: align === 'start' ? 'top' : align === 'end' ? 'bottom' : 'center',
				offsetX: offset,
			});
			break;
	}

	// Add fallback positions
	if (side === 'bottom') {
		positions.push({
			originX: alignment.originX,
			originY: 'top',
			overlayX: alignment.overlayX,
			overlayY: 'bottom',
			offsetY: -offset,
		});
	} else if (side === 'top') {
		positions.push({
			originX: alignment.originX,
			originY: 'bottom',
			overlayX: alignment.overlayX,
			overlayY: 'top',
			offsetY: offset,
		});
	}

	return positions;
}
