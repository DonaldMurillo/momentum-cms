/**
 * SEO Analysis Engine
 *
 * Scoring engine with built-in rules for SEO content quality assessment.
 */

import type { SeoScoringRule, SeoScoringContext, SeoAnalysisConfig } from '../seo-config.types';
import type { SeoAnalysisResult, SeoRuleResult } from './seo-analysis.types';
import { computeGrade } from '../seo-utils';

// ============================================
// Text Extraction
// ============================================

const HTML_TAG_RE = /<[^>]*>/g;
const HEADING_RE_SOURCE = '<h([1-6])[^>]*>(.*?)</h[1-6]>';
const WHITESPACE_RE = /\s+/g;

/**
 * Strip HTML tags and return plain text.
 */
export function extractTextContent(doc: Record<string, unknown>): string {
	const parts: string[] = [];
	for (const value of Object.values(doc)) {
		if (typeof value === 'string') {
			parts.push(value.replace(HTML_TAG_RE, ' '));
		}
	}
	return parts.join(' ').replace(WHITESPACE_RE, ' ').trim();
}

/**
 * Extract headings from HTML content in document fields.
 */
export function extractHeadings(
	doc: Record<string, unknown>,
): Array<{ level: number; text: string }> {
	const headings: Array<{ level: number; text: string }> = [];
	for (const value of Object.values(doc)) {
		if (typeof value !== 'string') continue;
		const re = new RegExp(HEADING_RE_SOURCE, 'gi');
		let match: RegExpExecArray | null;
		while ((match = re.exec(value)) !== null) {
			headings.push({
				level: parseInt(match[1], 10),
				text: match[2].replace(HTML_TAG_RE, '').trim(),
			});
		}
	}
	return headings;
}

// ============================================
// Built-in Scoring Rules
// ============================================

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function rangeScore(
	value: number,
	optMin: number,
	optMax: number,
	absMin: number,
	absMax: number,
): number {
	if (value >= optMin && value <= optMax) return 100;
	if (value < absMin || value > absMax) return 0;
	if (value < optMin) {
		return Math.round(((value - absMin) / (optMin - absMin)) * 100);
	}
	return Math.round(((absMax - value) / (absMax - optMax)) * 100);
}

export function createTitleLengthRule(config?: SeoAnalysisConfig): SeoScoringRule {
	const min = config?.titleLength?.min ?? 50;
	const max = config?.titleLength?.max ?? 60;
	return {
		id: 'title-length',
		name: 'Title Length',
		weight: 15,
		score: (ctx) => {
			const title = ctx.seo.metaTitle ?? '';
			if (!title) return 0;
			return rangeScore(title.length, min, max, 20, 70);
		},
		recommendation: (ctx) => {
			const title = ctx.seo.metaTitle ?? '';
			if (!title) return 'Add a meta title for search engines';
			if (title.length < min)
				return `Title is too short (${title.length} chars). Aim for ${min}-${max} characters.`;
			if (title.length > max)
				return `Title is too long (${title.length} chars). Aim for ${min}-${max} characters.`;
			return null;
		},
	};
}

export function createDescriptionLengthRule(config?: SeoAnalysisConfig): SeoScoringRule {
	const min = config?.descriptionLength?.min ?? 120;
	const max = config?.descriptionLength?.max ?? 155;
	return {
		id: 'description-length',
		name: 'Description Length',
		weight: 15,
		score: (ctx) => {
			const desc = ctx.seo.metaDescription ?? '';
			if (!desc) return 0;
			return rangeScore(desc.length, min, max, 50, 160);
		},
		recommendation: (ctx) => {
			const desc = ctx.seo.metaDescription ?? '';
			if (!desc) return 'Add a meta description for search results';
			if (desc.length < min)
				return `Description is too short (${desc.length} chars). Aim for ${min}-${max} characters.`;
			if (desc.length > max)
				return `Description is too long (${desc.length} chars). Aim for ${min}-${max} characters.`;
			return null;
		},
	};
}

export function createKeywordInTitleRule(): SeoScoringRule {
	return {
		id: 'keyword-in-title',
		name: 'Keyword in Title',
		weight: 15,
		score: (ctx) => {
			const keyword = ctx.seo.focusKeyword;
			if (!keyword) return 100;
			const title = ctx.seo.metaTitle ?? '';
			return title.toLowerCase().includes(keyword.toLowerCase()) ? 100 : 0;
		},
		recommendation: (ctx) => {
			const keyword = ctx.seo.focusKeyword;
			if (!keyword) return null;
			const title = ctx.seo.metaTitle ?? '';
			if (!title.toLowerCase().includes(keyword.toLowerCase())) {
				return `Include your focus keyword "${keyword}" in the meta title`;
			}
			return null;
		},
	};
}

export function createKeywordInDescriptionRule(): SeoScoringRule {
	return {
		id: 'keyword-in-description',
		name: 'Keyword in Description',
		weight: 10,
		score: (ctx) => {
			const keyword = ctx.seo.focusKeyword;
			if (!keyword) return 100;
			const desc = ctx.seo.metaDescription ?? '';
			return desc.toLowerCase().includes(keyword.toLowerCase()) ? 100 : 0;
		},
		recommendation: (ctx) => {
			const keyword = ctx.seo.focusKeyword;
			if (!keyword) return null;
			const desc = ctx.seo.metaDescription ?? '';
			if (!desc.toLowerCase().includes(keyword.toLowerCase())) {
				return `Include your focus keyword "${keyword}" in the meta description`;
			}
			return null;
		},
	};
}

export function createKeywordDensityRule(config?: SeoAnalysisConfig): SeoScoringRule {
	const minDensity = config?.keywordDensity?.min ?? 1;
	const maxDensity = config?.keywordDensity?.max ?? 3;
	return {
		id: 'keyword-density',
		name: 'Keyword Density',
		weight: 10,
		score: (ctx) => {
			const keyword = ctx.seo.focusKeyword;
			if (!keyword) return 100;
			if (!ctx.textContent) return 0;
			const words = ctx.textContent.split(/\s+/).length;
			if (words === 0) return 0;
			const keywordLower = keyword.toLowerCase();
			const textLower = ctx.textContent.toLowerCase();
			let count = 0;
			let pos = 0;
			while ((pos = textLower.indexOf(keywordLower, pos)) !== -1) {
				count++;
				pos += keywordLower.length;
			}
			const density = (count / words) * 100;
			if (density >= minDensity && density <= maxDensity) return 100;
			if (density === 0) return 0;
			if (density < minDensity) return clamp(Math.round((density / minDensity) * 100), 0, 100);
			return clamp(Math.round(((maxDensity * 2 - density) / maxDensity) * 100), 0, 100);
		},
		recommendation: (ctx) => {
			const keyword = ctx.seo.focusKeyword;
			if (!keyword || !ctx.textContent)
				return keyword ? 'Add content with your focus keyword' : null;
			return null;
		},
	};
}

export function createHeadingStructureRule(): SeoScoringRule {
	return {
		id: 'heading-structure',
		name: 'Heading Structure',
		weight: 10,
		score: (ctx) => {
			if (ctx.headings.length === 0) return 0;
			const hasH1 = ctx.headings.some((h) => h.level === 1);
			return hasH1 ? 100 : 50;
		},
		recommendation: (ctx) => {
			if (ctx.headings.length === 0) return 'Add headings to structure your content';
			if (!ctx.headings.some((h) => h.level === 1)) return 'Add an H1 heading to your content';
			return null;
		},
	};
}

export function createOgDataRule(): SeoScoringRule {
	return {
		id: 'og-data-complete',
		name: 'Open Graph Data',
		weight: 10,
		score: (ctx) => {
			let score = 0;
			const ogTitle = ctx.seo.ogTitle ?? ctx.seo.metaTitle;
			const ogDesc = ctx.seo.ogDescription ?? ctx.seo.metaDescription;
			const ogImage = ctx.seo.ogImage;
			if (ogTitle) score += 33;
			if (ogDesc) score += 33;
			if (ogImage) score += 34;
			return score;
		},
		recommendation: (ctx) => {
			const missing: string[] = [];
			if (!ctx.seo.ogTitle && !ctx.seo.metaTitle) missing.push('OG Title');
			if (!ctx.seo.ogDescription && !ctx.seo.metaDescription) missing.push('OG Description');
			if (!ctx.seo.ogImage) missing.push('OG Image');
			return missing.length > 0 ? `Missing Open Graph data: ${missing.join(', ')}` : null;
		},
	};
}

export function createCanonicalUrlRule(): SeoScoringRule {
	return {
		id: 'canonical-url',
		name: 'Canonical URL',
		weight: 5,
		score: (ctx) => (ctx.seo.canonicalUrl ? 100 : 0),
		recommendation: (ctx) =>
			ctx.seo.canonicalUrl ? null : 'Set a canonical URL to prevent duplicate content issues',
	};
}

export function createContentLengthRule(): SeoScoringRule {
	return {
		id: 'content-length',
		name: 'Content Length',
		weight: 5,
		score: (ctx) => {
			const words = ctx.textContent.split(/\s+/).filter(Boolean).length;
			if (words >= 300) return 100;
			if (words >= 150) return 50;
			return 0;
		},
		recommendation: (ctx) => {
			const words = ctx.textContent.split(/\s+/).filter(Boolean).length;
			if (words < 300) return `Content is short (${words} words). Aim for at least 300 words.`;
			return null;
		},
	};
}

export function createNoIndexWarningRule(): SeoScoringRule {
	return {
		id: 'no-index-warning',
		name: 'No Index Check',
		weight: 5,
		score: (ctx) => (ctx.seo.noIndex ? 0 : 100),
		recommendation: (ctx) =>
			ctx.seo.noIndex ? 'This page is set to noindex — search engines will not index it' : null,
	};
}

/**
 * Build the default set of scoring rules.
 */
export function buildDefaultRules(config?: SeoAnalysisConfig): SeoScoringRule[] {
	return [
		createTitleLengthRule(config),
		createDescriptionLengthRule(config),
		createKeywordInTitleRule(),
		createKeywordInDescriptionRule(),
		createKeywordDensityRule(config),
		createHeadingStructureRule(),
		createOgDataRule(),
		createCanonicalUrlRule(),
		createContentLengthRule(),
		createNoIndexWarningRule(),
	];
}

// ============================================
// Analyzer
// ============================================

/**
 * Run SEO analysis on a document.
 */
export function analyzeSeo(
	context: SeoScoringContext,
	rules: SeoScoringRule[],
): Omit<SeoAnalysisResult, 'analyzedAt' | 'collection' | 'documentId' | 'focusKeyword'> {
	const totalWeight = rules.reduce((sum, r) => sum + r.weight, 0);
	const ruleResults: SeoRuleResult[] = rules.map((rule) => {
		const score = clamp(rule.score(context), 0, 100);
		return {
			id: rule.id,
			name: rule.name,
			score,
			weight: rule.weight,
			recommendation: score < 100 ? rule.recommendation(context) : null,
		};
	});

	const weightedSum = ruleResults.reduce((sum, r) => sum + r.score * r.weight, 0);
	const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

	return {
		score: overallScore,
		grade: computeGrade(overallScore),
		rules: ruleResults,
	};
}
