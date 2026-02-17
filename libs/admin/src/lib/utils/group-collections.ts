import type { CollectionConfig } from '@momentumcms/core';
import type { CollectionGroup } from '../widgets/widget.types';

const DEFAULT_GROUP = 'Collections';

/**
 * Slugify a group name into a valid HTML id attribute value.
 * Lowercases, replaces non-alphanumeric runs with hyphens, trims leading/trailing hyphens.
 */
function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

/**
 * Group collections by their `admin.group` field.
 * Named groups appear first (in order of first appearance), the default "Collections" group last.
 * Each group includes a slugified `id` safe for use as an HTML id attribute.
 */
export function groupCollections(collections: readonly CollectionConfig[]): CollectionGroup[] {
	const groupMap = new Map<string, CollectionConfig[]>();

	for (const c of collections) {
		const name = c.admin?.group ?? DEFAULT_GROUP;
		const list = groupMap.get(name) ?? [];
		list.push(c);
		groupMap.set(name, list);
	}

	const groups: CollectionGroup[] = [];
	for (const [name, colls] of groupMap) {
		if (name !== DEFAULT_GROUP) {
			groups.push({ id: `group-${slugify(name)}`, name, collections: colls });
		}
	}
	const defaultGroup = groupMap.get(DEFAULT_GROUP);
	if (defaultGroup) {
		groups.push({
			id: `group-${slugify(DEFAULT_GROUP)}`,
			name: DEFAULT_GROUP,
			collections: defaultGroup,
		});
	}
	return groups;
}
