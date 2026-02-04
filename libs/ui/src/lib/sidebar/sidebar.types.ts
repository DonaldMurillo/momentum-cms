/**
 * Sidebar item configuration for programmatic usage.
 */
export interface SidebarNavItemConfig {
	/** Display label */
	label: string;
	/** Navigation URL */
	href?: string;
	/** Icon name or SVG */
	icon?: string;
	/** Badge content (text or number) */
	badge?: string | number;
	/** Whether the item is currently active */
	active?: boolean;
	/** Whether the item is disabled */
	disabled?: boolean;
	/** Child items for nested navigation */
	children?: SidebarNavItemConfig[];
}

/**
 * Sidebar section configuration for programmatic usage.
 */
export interface SidebarSectionConfig {
	/** Unique identifier */
	id: string;
	/** Section title */
	title?: string;
	/** Whether the section can be collapsed */
	collapsible?: boolean;
	/** Whether the section is expanded by default */
	defaultExpanded?: boolean;
	/** Navigation items in this section */
	items: SidebarNavItemConfig[];
}
