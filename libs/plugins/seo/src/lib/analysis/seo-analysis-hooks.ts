/**
 * SEO Analysis Hooks
 *
 * Injects afterChange hooks into SEO-enabled collections to trigger
 * asynchronous content analysis after document saves.
 */

import type { CollectionConfig, HookFunction } from '@momentumcms/core';
import type { MomentumAPI } from '@momentumcms/plugins/core';
import type { SeoAnalysisConfig } from '../seo-config.types';
import { hasSeoField, extractSeoFieldData } from '../seo-utils';
import { analyzeSeo, buildDefaultRules, extractTextContent, extractHeadings } from './seo-analyzer';

/**
 * Check if a collection should be excluded from analysis.
 */
function shouldExclude(collection: CollectionConfig, config: SeoAnalysisConfig): boolean {
	return (config.excludeCollections ?? []).includes(collection.slug);
}

/**
 * Marker to prevent duplicate hook injection.
 */
const HOOK_MARKER = Symbol('seo-analysis-hook');

type MarkedHook = HookFunction & { [key: symbol]: boolean };

function isMarkedHook(h: HookFunction): h is MarkedHook {
	return HOOK_MARKER in h;
}

/**
 * Check if a collection already has the SEO analysis hook (idempotency).
 */
function hasAnalysisHook(collection: CollectionConfig): boolean {
	return (
		Array.isArray(collection.hooks?.afterChange) &&
		collection.hooks.afterChange.some((h) => isMarkedHook(h) && h[HOOK_MARKER] === true)
	);
}

interface CollectionApiShape {
	find?(opts: unknown): Promise<{ docs: Array<Record<string, unknown>> }>;
	create?(data: Record<string, unknown>): Promise<unknown>;
	update?(id: string, data: Record<string, unknown>): Promise<unknown>;
}

/**
 * Run async analysis and store results. Fire-and-forget.
 */
async function analyzeSeoAsync(
	api: MomentumAPI,
	collectionSlug: string,
	doc: Record<string, unknown>,
	config: SeoAnalysisConfig,
): Promise<void> {
	const seoData = extractSeoFieldData(doc);
	const docId = String(doc['id'] ?? '');
	if (!docId) return;

	const rules = buildDefaultRules(config);
	if (config.rules) {
		rules.push(...config.rules);
	}

	const textContent = extractTextContent(doc);
	const headings = extractHeadings(doc);

	const result = analyzeSeo(
		{
			seo: seoData,
			doc,
			collection: collectionSlug,
			textContent,
			headings,
		},
		rules,
	);

	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- MomentumAPI.collection returns dynamic shape
	const analysisApi = api.collection('seo-analysis') as CollectionApiShape;

	if (!analysisApi.find || !analysisApi.create) return;

	const existing = await analysisApi.find({
		where: {
			documentId: { equals: docId },
			collection: { equals: collectionSlug },
		},
		limit: 1,
	});

	const data = {
		collection: collectionSlug,
		documentId: docId,
		score: result.score,
		grade: result.grade,
		rules: result.rules,
		focusKeyword: seoData.focusKeyword ?? null,
		analyzedAt: new Date().toISOString(),
	};

	if (existing.docs.length > 0 && analysisApi.update) {
		await analysisApi.update(String(existing.docs[0]['id']), data);
	} else {
		await analysisApi.create(data);
	}
}

/**
 * Inject afterChange hooks for SEO analysis into eligible collections.
 */
export function injectSeoAnalysisHooks(
	collections: CollectionConfig[],
	config: SeoAnalysisConfig,
	getApi: () => MomentumAPI | null,
): void {
	for (const collection of collections) {
		if (!hasSeoField(collection)) continue;
		if (shouldExclude(collection, config)) continue;
		if (hasAnalysisHook(collection)) continue;

		collection.hooks = collection.hooks ?? {};
		const existingAfterChange = collection.hooks.afterChange ?? [];

		const afterChangeHook: HookFunction = (args: {
			doc?: Record<string, unknown>;
			data?: Record<string, unknown>;
		}): void => {
			const api = getApi();
			if (!api) return;
			const doc = args.doc ?? args.data;
			if (!doc) return;
			// Fire and forget — async analysis must not block saves
			void analyzeSeoAsync(api, collection.slug, doc, config).catch(() => {
				// Silently swallow — analysis failure must never break saves
			});
		};

		// Mark the hook for idempotency checking
		Object.defineProperty(afterChangeHook, HOOK_MARKER, { value: true });

		collection.hooks.afterChange = [...existingAfterChange, afterChangeHook];
	}
}
