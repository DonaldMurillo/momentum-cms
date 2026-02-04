import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Tree } from './tree.component';
import { TreeItem } from './tree-item.component';
import { TreeItemGroupComponent } from './tree-item-group.component';

const meta: Meta<Tree> = {
	title: 'Components/Navigation/Tree',
	component: Tree,
	tags: ['autodocs'],
	decorators: [
		moduleMetadata({
			imports: [Tree, TreeItem, TreeItemGroupComponent],
		}),
	],
	argTypes: {
		multi: {
			control: 'boolean',
			description: 'Whether multiple items can be selected',
		},
		disabled: {
			control: 'boolean',
			description: 'Whether the tree is disabled',
		},
		selectionMode: {
			control: 'select',
			options: ['follow', 'explicit'],
			description: 'Selection mode',
		},
	},
};
export default meta;
type Story = StoryObj<Tree>;

export const Default: Story = {
	render: () => ({
		template: `
			<mcms-tree #tree="mcmsTree" style="max-width: 300px;">
				<mcms-tree-item #documents="mcmsTreeItem" [parent]="tree.ariaTree" value="documents" label="Documents" [hasChildren]="true">
					Documents
					<mcms-tree-item-group [ownedBy]="documents.treeItem">
						<mcms-tree-item [parent]="documents.treeItem.group!" value="work" label="Work">Work</mcms-tree-item>
						<mcms-tree-item [parent]="documents.treeItem.group!" value="personal" label="Personal">Personal</mcms-tree-item>
					</mcms-tree-item-group>
				</mcms-tree-item>
				<mcms-tree-item [parent]="tree.ariaTree" value="downloads" label="Downloads">Downloads</mcms-tree-item>
				<mcms-tree-item [parent]="tree.ariaTree" value="pictures" label="Pictures">Pictures</mcms-tree-item>
			</mcms-tree>
		`,
	}),
};

export const MultiSelect: Story = {
	args: {
		multi: true,
	},
	render: (args) => ({
		props: args,
		template: `
			<mcms-tree #tree="mcmsTree" [multi]="multi" style="max-width: 300px;">
				<mcms-tree-item [parent]="tree.ariaTree" value="item1" label="Item 1">Item 1</mcms-tree-item>
				<mcms-tree-item [parent]="tree.ariaTree" value="item2" label="Item 2">Item 2</mcms-tree-item>
				<mcms-tree-item [parent]="tree.ariaTree" value="item3" label="Item 3">Item 3</mcms-tree-item>
				<mcms-tree-item [parent]="tree.ariaTree" value="item4" label="Item 4">Item 4</mcms-tree-item>
			</mcms-tree>
		`,
	}),
};

export const NestedFolders: Story = {
	render: () => ({
		template: `
			<mcms-tree #tree="mcmsTree" style="max-width: 300px;">
				<mcms-tree-item #src="mcmsTreeItem" [parent]="tree.ariaTree" value="src" label="src" [hasChildren]="true">
					src
					<mcms-tree-item-group [ownedBy]="src.treeItem">
						<mcms-tree-item #components="mcmsTreeItem" [parent]="src.treeItem.group!" value="components" label="components" [hasChildren]="true">
							components
							<mcms-tree-item-group [ownedBy]="components.treeItem">
								<mcms-tree-item [parent]="components.treeItem.group!" value="button.ts" label="button.ts">button.ts</mcms-tree-item>
								<mcms-tree-item [parent]="components.treeItem.group!" value="card.ts" label="card.ts">card.ts</mcms-tree-item>
							</mcms-tree-item-group>
						</mcms-tree-item>
						<mcms-tree-item [parent]="src.treeItem.group!" value="index.ts" label="index.ts">index.ts</mcms-tree-item>
					</mcms-tree-item-group>
				</mcms-tree-item>
				<mcms-tree-item [parent]="tree.ariaTree" value="package.json" label="package.json">package.json</mcms-tree-item>
				<mcms-tree-item [parent]="tree.ariaTree" value="readme.md" label="README.md">README.md</mcms-tree-item>
			</mcms-tree>
		`,
	}),
};

export const WithDisabledItems: Story = {
	render: () => ({
		template: `
			<mcms-tree #tree="mcmsTree" style="max-width: 300px;">
				<mcms-tree-item [parent]="tree.ariaTree" value="available" label="Available">Available</mcms-tree-item>
				<mcms-tree-item [parent]="tree.ariaTree" value="disabled" label="Disabled" [disabled]="true">Disabled</mcms-tree-item>
				<mcms-tree-item [parent]="tree.ariaTree" value="another" label="Another">Another Available</mcms-tree-item>
			</mcms-tree>
		`,
	}),
};

export const FileExplorer: Story = {
	render: () => ({
		template: `
			<div style="max-width: 300px; border: 1px solid hsl(var(--mcms-border)); border-radius: 0.5rem; padding: 0.5rem;">
				<mcms-tree #tree="mcmsTree">
					<mcms-tree-item #project="mcmsTreeItem" [parent]="tree.ariaTree" value="my-project" label="my-project" [hasChildren]="true" [expanded]="true">
						<span style="display: flex; align-items: center; gap: 0.5rem;">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: hsl(var(--mcms-warning));">
								<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
							</svg>
							my-project
						</span>
						<mcms-tree-item-group [ownedBy]="project.treeItem">
							<mcms-tree-item #srcFolder="mcmsTreeItem" [parent]="project.treeItem.group!" value="src" label="src" [hasChildren]="true">
								<span style="display: flex; align-items: center; gap: 0.5rem;">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: hsl(var(--mcms-warning));">
										<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
									</svg>
									src
								</span>
								<mcms-tree-item-group [ownedBy]="srcFolder.treeItem">
									<mcms-tree-item [parent]="srcFolder.treeItem.group!" value="app.ts" label="app.ts">
										<span style="display: flex; align-items: center; gap: 0.5rem;">
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: hsl(var(--mcms-info));">
												<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
												<path d="M14 2v4a2 2 0 0 0 2 2h4"/>
											</svg>
											app.ts
										</span>
									</mcms-tree-item>
									<mcms-tree-item [parent]="srcFolder.treeItem.group!" value="index.ts" label="index.ts">
										<span style="display: flex; align-items: center; gap: 0.5rem;">
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: hsl(var(--mcms-info));">
												<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
												<path d="M14 2v4a2 2 0 0 0 2 2h4"/>
											</svg>
											index.ts
										</span>
									</mcms-tree-item>
								</mcms-tree-item-group>
							</mcms-tree-item>
							<mcms-tree-item [parent]="project.treeItem.group!" value="package.json" label="package.json">
								<span style="display: flex; align-items: center; gap: 0.5rem;">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: hsl(var(--mcms-success));">
										<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
										<path d="M14 2v4a2 2 0 0 0 2 2h4"/>
									</svg>
									package.json
								</span>
							</mcms-tree-item>
						</mcms-tree-item-group>
					</mcms-tree-item>
				</mcms-tree>
			</div>
		`,
	}),
};
