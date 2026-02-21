/**
 * SEO Analysis Result Types
 *
 * Types for the SEO scoring engine results.
 */

export interface SeoAnalysisResult {
	/** Overall score (0-100) */
	score: number;
	/** Overall grade: 'good' (70+), 'warning' (40-69), 'poor' (0-39) */
	grade: 'good' | 'warning' | 'poor';
	/** Individual rule results */
	rules: SeoRuleResult[];
	/** ISO timestamp of when analysis was performed */
	analyzedAt: string;
	/** Collection slug */
	collection: string;
	/** Document ID */
	documentId: string;
	/** Focus keyword used for analysis */
	focusKeyword?: string;
}

export interface SeoRuleResult {
	/** Rule identifier */
	id: string;
	/** Rule display name */
	name: string;
	/** Score for this rule (0-100) */
	score: number;
	/** Weight in total score */
	weight: number;
	/** Human-readable recommendation (null if passing) */
	recommendation: string | null;
}

/**
 * Structured meta tags returned by the meta tag API.
 */
export interface MetaTags {
	/** The page title */
	title: string;
	/** Meta tags (name or property based) */
	meta: Array<{ name?: string; property?: string; content: string }>;
	/** Link tags (canonical, etc.) */
	link: Array<{ rel: string; href: string }>;
	/** Script tags (JSON-LD) */
	script: Array<{ type: string; innerHTML: string }>;
}
