/**
 * Shared SEO Utility Functions
 *
 * Common helpers used across multiple SEO plugin modules.
 */

import type { CollectionConfig, TabsField } from '@momentumcms/core';
import type { SeoFieldData } from './seo-config.types';

/**
 * Check if a collection already has SEO fields — either as a top-level
 * `group('seo', ...)` or as a named `seo` tab inside a `tabs()` field.
 */
export function hasSeoField(collection: CollectionConfig): boolean {
	for (const field of collection.fields) {
		// Direct seo group at top level
		if (field.name === 'seo' && field.type === 'group') return true;

		// Named seo tab inside a tabs field
		if (field.type === 'tabs') {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowing field union by type discriminant
			const tabsField = field as TabsField;
			if (tabsField.tabs.some((t) => t.name === 'seo')) return true;
		}
	}
	return false;
}

/**
 * Extract SEO field data from a document's `seo` property.
 * Returns an empty object if the seo field is missing or malformed.
 */
export function extractSeoFieldData(doc: Record<string, unknown>): SeoFieldData {
	const raw = doc['seo'];
	if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowed via typeof check
		return raw as SeoFieldData;
	}
	return {};
}

/**
 * Compute SEO grade from a numeric score.
 */
export function computeGrade(score: number): 'good' | 'warning' | 'poor' {
	if (score >= 70) return 'good';
	if (score >= 40) return 'warning';
	return 'poor';
}
