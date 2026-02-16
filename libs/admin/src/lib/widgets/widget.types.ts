/**
 * Widget Types for Momentum CMS Admin
 *
 * Common types used across admin widgets.
 */

import type { CollectionConfig } from '@momentumcms/core';

/**
 * Branding configuration for admin sidebar.
 */
export interface AdminBranding {
	/** The title displayed in the sidebar header */
	title?: string;
	/** URL to the logo image */
	logo?: string;
}

/**
 * Navigation item in the admin sidebar.
 */
export interface AdminNavItem {
	/** Display label */
	label: string;
	/** Router link path */
	href: string;
	/** Icon name (for future icon support) */
	icon?: string;
	/** Badge content (count or text) */
	badge?: string | number;
	/** Whether this item is active */
	active?: boolean;
	/** Whether this item is disabled */
	disabled?: boolean;
}

/**
 * Navigation section with optional grouping.
 */
export interface AdminNavSection {
	/** Section title (optional) */
	title?: string;
	/** Navigation items in this section */
	items: AdminNavItem[];
	/** Whether the section is collapsible */
	collapsible?: boolean;
	/** Whether the section is expanded (if collapsible) */
	expanded?: boolean;
}

/**
 * User information for the sidebar user section.
 */
export interface AdminUser {
	/** User's unique ID */
	id: string | number;
	/** User's full name */
	name: string;
	/** User's email */
	email: string;
	/** User's avatar URL (optional) */
	avatarUrl?: string;
	/** User's role (optional) */
	role?: string;
}

/**
 * Collection with count information for the dashboard.
 */
export interface CollectionWithCount {
	/** Collection configuration */
	collection: CollectionConfig;
	/** Number of documents in the collection */
	count: number;
	/** Whether the count is loading */
	loading?: boolean;
	/** Error message if count fetch failed */
	error?: string;
}

/**
 * Action that can be performed on an entity.
 */
export interface EntityAction {
	/** Unique action identifier */
	id: string;
	/** Display label */
	label: string;
	/** Icon name (for future icon support) */
	icon?: string;
	/** Variant for styling (default, destructive) */
	variant?: 'default' | 'destructive';
	/** Whether action is disabled */
	disabled?: boolean;
	/** Whether action requires confirmation */
	requiresConfirmation?: boolean;
	/** Confirmation message (if requiresConfirmation is true) */
	confirmationMessage?: string;
}

/**
 * Generic entity record from the API.
 */
export interface Entity {
	id: string | number;
	createdAt?: string;
	updatedAt?: string;
	[key: string]: unknown;
}
