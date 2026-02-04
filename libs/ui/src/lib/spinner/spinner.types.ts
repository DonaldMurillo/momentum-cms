export type SpinnerSize = 'sm' | 'md' | 'lg';

export const SPINNER_SIZES: Record<SpinnerSize, { width: number; height: number; stroke: number }> =
	{
		sm: { width: 16, height: 16, stroke: 2 },
		md: { width: 24, height: 24, stroke: 2 },
		lg: { width: 32, height: 32, stroke: 3 },
	};
