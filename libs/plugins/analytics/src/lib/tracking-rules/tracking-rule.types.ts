/**
 * Tracking Rule Types
 *
 * Types for admin-managed element tracking rules.
 * Admins define CSS selector + DOM event → analytics event mappings.
 */

/**
 * DOM event types supported by tracking rules.
 */
export type TrackingEventType = 'click' | 'submit' | 'scroll-into-view' | 'hover' | 'focus';

/**
 * Describes how to extract a property value from a matched DOM element.
 */
export interface PropertyExtraction {
	/** Property key in the analytics event */
	key: string;
	/** Where to read the value from */
	source: 'text' | 'attribute' | 'dataset';
	/** Attribute or dataset key name (required for 'attribute' and 'dataset' sources) */
	attribute?: string;
}

/**
 * A tracking rule as stored in the database.
 */
export interface TrackingRule {
	id: string;
	/** Human-readable name */
	name: string;
	/** CSS selector to match elements */
	selector: string;
	/** DOM event type to listen for */
	eventType: TrackingEventType;
	/** Analytics event name to fire */
	eventName: string;
	/** URL pattern to match pages (glob: * = any segment, ** = any path) */
	urlPattern: string;
	/** Static properties attached to every event */
	properties: Record<string, string>;
	/** Dynamic property extraction from matched DOM elements */
	extractProperties?: PropertyExtraction[];
	/** Whether this rule is active */
	active: boolean;
	/** Max events per minute per visitor for this rule */
	rateLimit?: number;
}

/**
 * Client-facing tracking rule (stripped of internal fields).
 */
export type ClientTrackingRule = Omit<TrackingRule, 'id'>;
