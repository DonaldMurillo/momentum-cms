/**
 * Tree node data structure
 */
export interface TreeNode {
	/** Unique identifier for the node */
	id: string;
	/** Display label */
	label: string;
	/** Optional icon identifier */
	icon?: string;
	/** Whether the node is disabled */
	disabled?: boolean;
	/** Whether the node is initially expanded */
	expanded?: boolean;
	/** Child nodes */
	children?: TreeNode[];
}
