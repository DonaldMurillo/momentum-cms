/**
 * Menubar orientation
 */
export type MenubarOrientation = 'horizontal' | 'vertical';

/**
 * Menubar item configuration
 */
export interface MenubarItemConfig {
	/** Unique value identifier */
	value: string;
	/** Display label */
	label: string;
	/** Whether the item is disabled */
	disabled?: boolean;
	/** Keyboard shortcut hint */
	shortcut?: string;
	/** Icon identifier */
	icon?: string;
	/** Submenu items */
	children?: MenubarItemConfig[];
}
