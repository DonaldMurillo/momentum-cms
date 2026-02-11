/* eslint-disable local/no-direct-browser-apis -- Standalone client tracker, not Angular-managed */

/**
 * Block-Level Analytics Tracker
 *
 * Attaches IntersectionObserver for impression tracking and mouseenter delegation
 * for hover tracking on blocks that have `data-block-track` attributes.
 *
 * Only tracks blocks where the admin has enabled tracking via the
 * `_analytics` group fields injected by the analytics plugin.
 *
 * @example
 * ```typescript
 * const tracker = createTracker({ endpoint: '/api/analytics/collect' });
 * const cleanup = attachBlockTracking(tracker);
 * // Later: cleanup() to disconnect observers and remove listeners
 * ```
 */

import type { MomentumTracker } from './tracker';

/**
 * Attach block-level analytics tracking to the page.
 *
 * Finds all elements with `data-block-track` and:
 * - Observes visibility via IntersectionObserver (for `impressions`)
 * - Listens for mouseenter via event delegation (for `hover`)
 *
 * @param tracker - Momentum tracker instance for event emission
 * @param container - DOM container to scope tracking (defaults to document.body)
 * @returns Cleanup function to disconnect observers and remove listeners
 */
export function attachBlockTracking(tracker: MomentumTracker, container?: HTMLElement): () => void {
	const root = container ?? document.body;
	const impressionsSeen = new Set<string>();
	let observer: IntersectionObserver | null = null;

	// --- Impressions via IntersectionObserver ---

	function handleIntersection(entries: IntersectionObserverEntry[]): void {
		for (const entry of entries) {
			if (!entry.isIntersecting) continue;

			if (!(entry.target instanceof HTMLElement)) continue;
			const el = entry.target;
			const blockType = el.dataset['blockType'];
			const blockIndex = el.dataset['blockIndex'];
			if (!blockType) continue;

			const key = `${blockType}:${blockIndex ?? '?'}`;
			if (impressionsSeen.has(key)) continue;
			impressionsSeen.add(key);

			tracker.track('block_impression', {
				blockType,
				blockIndex: blockIndex ? Number(blockIndex) : undefined,
			});
		}
	}

	observer = new IntersectionObserver(handleIntersection, {
		threshold: 0.5,
	});

	// Observe all blocks with impression tracking enabled
	const tracked = Array.from(root.querySelectorAll<HTMLElement>('[data-block-track]'));
	for (const el of tracked) {
		const trackValue = el.dataset['blockTrack'] ?? '';
		if (trackValue.includes('impressions')) {
			observer.observe(el);
		}
	}

	// --- Hover via mouseenter with capture (mouseenter does not bubble) ---

	function handleHover(event: Event): void {
		const target = event.target;
		if (!(target instanceof HTMLElement)) return;

		// Find the tracked block element (could be the target itself or an ancestor)
		const blockEl = target.closest<HTMLElement>('[data-block-track]');
		if (!blockEl) return;

		const trackValue = blockEl.dataset['blockTrack'] ?? '';
		if (!trackValue.includes('hover')) return;

		const blockType = blockEl.dataset['blockType'];
		const blockIndex = blockEl.dataset['blockIndex'];
		if (!blockType) return;

		tracker.track('block_hover', {
			blockType,
			blockIndex: blockIndex ? Number(blockIndex) : undefined,
		});
	}

	root.addEventListener('mouseenter', handleHover, true);

	// --- Cleanup ---

	return (): void => {
		observer?.disconnect();
		observer = null;
		root.removeEventListener('mouseenter', handleHover, true);
		impressionsSeen.clear();
	};
}
