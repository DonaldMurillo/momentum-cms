import type { HookFunction } from '@momentumcms/core';

type ReprocessFn = (doc: Record<string, unknown>) => Promise<void>;

/**
 * Compare two focal points for equality.
 */
function focalPointsEqual(
	a?: { x: number; y: number } | null,
	b?: { x: number; y: number } | null,
): boolean {
	if (!a && !b) return true;
	if (!a || !b) return false;
	return a.x === b.x && a.y === b.y;
}

/**
 * Creates an afterChange hook that detects focal point changes
 * and triggers re-processing of image variants.
 */
export function createFocalPointHook(reprocess: ReprocessFn): HookFunction {
	return async ({ doc, originalDoc, operation }) => {
		// Only run on update operations with an original document
		if (operation !== 'update' || !originalDoc || !doc) return;

		// Must have a path (meaning it's a stored file)
		if (!doc['path']) return;

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- hook data is Record<string, unknown>, safe narrowing
		const newFP = doc['focalPoint'] as { x: number; y: number } | undefined;
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- hook data is Record<string, unknown>, safe narrowing
		const oldFP = originalDoc['focalPoint'] as { x: number; y: number } | undefined;

		if (!focalPointsEqual(newFP, oldFP)) {
			await reprocess(doc);
		}
	};
}
