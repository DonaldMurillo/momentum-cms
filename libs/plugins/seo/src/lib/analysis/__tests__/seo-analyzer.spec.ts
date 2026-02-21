import { describe, it, expect } from 'vitest';
import type { SeoScoringContext } from '../../seo-config.types';
import {
	analyzeSeo,
	buildDefaultRules,
	createTitleLengthRule,
	createDescriptionLengthRule,
	createKeywordInTitleRule,
	createKeywordInDescriptionRule,
	createKeywordDensityRule,
	createOgDataRule,
	createHeadingStructureRule,
	createCanonicalUrlRule,
	createContentLengthRule,
	createNoIndexWarningRule,
	extractTextContent,
	extractHeadings,
} from '../seo-analyzer';

function makeContext(overrides: Partial<SeoScoringContext> = {}): SeoScoringContext {
	return {
		seo: {},
		doc: {},
		collection: 'posts',
		textContent: '',
		headings: [],
		...overrides,
	};
}

describe('extractTextContent', () => {
	it('should strip HTML tags from values', () => {
		const result = extractTextContent({ content: '<p>Hello <strong>world</strong></p>' });
		expect(result).toBe('Hello world');
	});

	it('should concatenate multiple string fields', () => {
		const result = extractTextContent({ title: 'Title', content: 'Body' });
		expect(result).toContain('Title');
		expect(result).toContain('Body');
	});

	it('should skip non-string values', () => {
		const result = extractTextContent({ count: 42, active: true, content: 'text' });
		expect(result).toBe('text');
	});
});

describe('extractHeadings', () => {
	it('should extract headings from HTML', () => {
		const result = extractHeadings({ content: '<h1>Main</h1><h2>Sub</h2>' });
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({ level: 1, text: 'Main' });
		expect(result[1]).toEqual({ level: 2, text: 'Sub' });
	});

	it('should return empty for no headings', () => {
		const result = extractHeadings({ content: '<p>No headings here</p>' });
		expect(result).toHaveLength(0);
	});
});

describe('Title length rule', () => {
	const rule = createTitleLengthRule();

	it('should score 100 when title is 50-60 chars', () => {
		const ctx = makeContext({ seo: { metaTitle: 'A'.repeat(55) } });
		expect(rule.score(ctx)).toBe(100);
	});

	it('should score partial when title is outside optimal but within absolute range', () => {
		const ctx = makeContext({ seo: { metaTitle: 'A'.repeat(35) } });
		const score = rule.score(ctx);
		expect(score).toBeGreaterThan(0);
		expect(score).toBeLessThan(100);
	});

	it('should score 0 when title is empty', () => {
		const ctx = makeContext({ seo: { metaTitle: '' } });
		expect(rule.score(ctx)).toBe(0);
	});

	it('should return recommendation when score < 100', () => {
		const ctx = makeContext({ seo: { metaTitle: 'Short' } });
		expect(rule.recommendation(ctx)).toContain('too short');
	});

	it('should return null recommendation when title is optimal', () => {
		const ctx = makeContext({ seo: { metaTitle: 'A'.repeat(55) } });
		expect(rule.recommendation(ctx)).toBeNull();
	});
});

describe('Description length rule', () => {
	const rule = createDescriptionLengthRule();

	it('should score 100 when description is 120-155 chars', () => {
		const ctx = makeContext({ seo: { metaDescription: 'A'.repeat(140) } });
		expect(rule.score(ctx)).toBe(100);
	});

	it('should score 0 when empty', () => {
		const ctx = makeContext({ seo: {} });
		expect(rule.score(ctx)).toBe(0);
	});
});

describe('Keyword in title rule', () => {
	const rule = createKeywordInTitleRule();

	it('should score 100 when focusKeyword appears in metaTitle', () => {
		const ctx = makeContext({
			seo: { metaTitle: 'Best Angular CMS Guide', focusKeyword: 'angular cms' },
		});
		expect(rule.score(ctx)).toBe(100);
	});

	it('should score 0 when missing', () => {
		const ctx = makeContext({
			seo: { metaTitle: 'Something Else', focusKeyword: 'angular cms' },
		});
		expect(rule.score(ctx)).toBe(0);
	});

	it('should score 100 when no focusKeyword set (skip)', () => {
		const ctx = makeContext({ seo: { metaTitle: 'Any Title' } });
		expect(rule.score(ctx)).toBe(100);
	});
});

describe('Keyword in description rule', () => {
	const rule = createKeywordInDescriptionRule();

	it('should score 100 when focusKeyword appears in metaDescription', () => {
		const ctx = makeContext({
			seo: {
				metaDescription: 'Best Angular CMS Guide for developers',
				focusKeyword: 'angular cms',
			},
		});
		expect(rule.score(ctx)).toBe(100);
	});

	it('should score 0 when focusKeyword missing from metaDescription', () => {
		const ctx = makeContext({
			seo: { metaDescription: 'Something completely different', focusKeyword: 'angular cms' },
		});
		expect(rule.score(ctx)).toBe(0);
	});

	it('should score 100 when no focusKeyword set (skip)', () => {
		const ctx = makeContext({ seo: { metaDescription: 'Any description here' } });
		expect(rule.score(ctx)).toBe(100);
	});

	it('should score 0 when description is empty but keyword set', () => {
		const ctx = makeContext({ seo: { focusKeyword: 'test' } });
		expect(rule.score(ctx)).toBe(0);
	});

	it('should return recommendation when keyword missing from description', () => {
		const ctx = makeContext({
			seo: { metaDescription: 'No keyword here', focusKeyword: 'angular' },
		});
		expect(rule.recommendation(ctx)).toContain('angular');
	});

	it('should return null recommendation when no focusKeyword', () => {
		const ctx = makeContext({ seo: { metaDescription: 'Desc' } });
		expect(rule.recommendation(ctx)).toBeNull();
	});
});

describe('Keyword density rule', () => {
	const rule = createKeywordDensityRule();

	it('should score 100 when keyword density is in 1-3% range', () => {
		// 100 words, keyword appears 2 times => 2% density
		const words = Array(98).fill('lorem').join(' ');
		const ctx = makeContext({
			seo: { focusKeyword: 'angular' },
			textContent: `angular ${words} angular`,
		});
		expect(rule.score(ctx)).toBe(100);
	});

	it('should score 0 when keyword not found', () => {
		const ctx = makeContext({
			seo: { focusKeyword: 'angular' },
			textContent: 'lorem ipsum dolor sit amet',
		});
		expect(rule.score(ctx)).toBe(0);
	});

	it('should score 100 when no focusKeyword set', () => {
		const ctx = makeContext({ seo: {}, textContent: 'some content' });
		expect(rule.score(ctx)).toBe(100);
	});

	it('should handle empty textContent', () => {
		const ctx = makeContext({ seo: { focusKeyword: 'test' }, textContent: '' });
		expect(rule.score(ctx)).toBe(0);
	});
});

describe('Heading structure rule', () => {
	const rule = createHeadingStructureRule();

	it('should score 100 when H1 is present', () => {
		const ctx = makeContext({ headings: [{ level: 1, text: 'Main' }] });
		expect(rule.score(ctx)).toBe(100);
	});

	it('should score 50 when headings exist but no H1', () => {
		const ctx = makeContext({ headings: [{ level: 2, text: 'Sub' }] });
		expect(rule.score(ctx)).toBe(50);
	});

	it('should score 0 when no headings', () => {
		const ctx = makeContext({ headings: [] });
		expect(rule.score(ctx)).toBe(0);
	});
});

describe('OG data complete rule', () => {
	const rule = createOgDataRule();

	it('should score 100 when ogTitle + ogDescription + ogImage all set', () => {
		const ctx = makeContext({
			seo: { ogTitle: 'Title', ogDescription: 'Desc', ogImage: 'img.jpg' },
		});
		expect(rule.score(ctx)).toBe(100);
	});

	it('should score partial when some missing', () => {
		const ctx = makeContext({ seo: { ogTitle: 'Title' } });
		const score = rule.score(ctx);
		expect(score).toBeGreaterThan(0);
		expect(score).toBeLessThan(100);
	});

	it('should fallback to metaTitle for ogTitle', () => {
		const ctx = makeContext({
			seo: { metaTitle: 'Title', metaDescription: 'Desc', ogImage: 'img.jpg' },
		});
		expect(rule.score(ctx)).toBe(100);
	});
});

describe('Canonical URL rule', () => {
	const rule = createCanonicalUrlRule();

	it('should score 100 when set', () => {
		const ctx = makeContext({ seo: { canonicalUrl: 'https://example.com/page' } });
		expect(rule.score(ctx)).toBe(100);
	});

	it('should score 0 when missing', () => {
		const ctx = makeContext({ seo: {} });
		expect(rule.score(ctx)).toBe(0);
	});
});

describe('Content length rule', () => {
	const rule = createContentLengthRule();

	it('should score 100 when 300+ words', () => {
		const ctx = makeContext({ textContent: Array(300).fill('word').join(' ') });
		expect(rule.score(ctx)).toBe(100);
	});

	it('should score 50 when 150-299 words', () => {
		const ctx = makeContext({ textContent: Array(200).fill('word').join(' ') });
		expect(rule.score(ctx)).toBe(50);
	});

	it('should score 0 when < 150 words', () => {
		const ctx = makeContext({ textContent: 'short content' });
		expect(rule.score(ctx)).toBe(0);
	});
});

describe('No index warning rule', () => {
	const rule = createNoIndexWarningRule();

	it('should score 100 when noIndex is false', () => {
		const ctx = makeContext({ seo: { noIndex: false } });
		expect(rule.score(ctx)).toBe(100);
	});

	it('should score 0 when noIndex is true', () => {
		const ctx = makeContext({ seo: { noIndex: true } });
		expect(rule.score(ctx)).toBe(0);
	});
});

describe('analyzeSeo', () => {
	it('should calculate weighted average across all rules', () => {
		const rules = buildDefaultRules();
		const ctx = makeContext({
			seo: {
				metaTitle: 'A'.repeat(55),
				metaDescription: 'A'.repeat(140),
				canonicalUrl: 'https://example.com',
				ogTitle: 'OG',
				ogDescription: 'Desc',
				ogImage: 'img.jpg',
			},
			textContent: Array(300).fill('word').join(' '),
			headings: [{ level: 1, text: 'Heading' }],
		});

		const result = analyzeSeo(ctx, rules);
		expect(result.score).toBeGreaterThan(0);
		expect(result.score).toBeLessThanOrEqual(100);
		expect(result.rules).toHaveLength(rules.length);
	});

	it('should return grade good for 70+', () => {
		const result = analyzeSeo(
			makeContext({
				seo: {
					metaTitle: 'A'.repeat(55),
					metaDescription: 'A'.repeat(140),
					canonicalUrl: 'https://example.com',
					ogTitle: 'OG',
					ogDescription: 'Desc',
					ogImage: 'img.jpg',
				},
				textContent: Array(300).fill('word').join(' '),
				headings: [{ level: 1, text: 'H' }],
			}),
			buildDefaultRules(),
		);
		expect(result.grade).toBe('good');
	});

	it('should return grade poor for low scores', () => {
		// With a focusKeyword set but no content, most rules score 0
		const result = analyzeSeo(makeContext({ seo: { focusKeyword: 'test' } }), buildDefaultRules());
		expect(result.grade).toBe('poor');
	});

	it('should include custom rules in scoring', () => {
		const customRule = {
			id: 'custom-test',
			name: 'Custom Test',
			weight: 100,
			score: (): number => 50,
			recommendation: (): null => null,
		};
		const result = analyzeSeo(makeContext(), [customRule]);
		expect(result.score).toBe(50);
		expect(result.rules).toHaveLength(1);
		expect(result.rules[0].id).toBe('custom-test');
	});

	it('should handle empty rules array', () => {
		const result = analyzeSeo(makeContext(), []);
		expect(result.score).toBe(0);
		expect(result.rules).toHaveLength(0);
	});
});
