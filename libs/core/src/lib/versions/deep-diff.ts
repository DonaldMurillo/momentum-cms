/**
 * Deep Diff Engine for Version Comparison
 *
 * Performs field-aware deep comparison between two document version snapshots.
 * Uses collection field config for type-aware diffing (text word-diff, array item matching, etc.).
 */

import type { Field, ArrayField, GroupField } from '../fields/field.types';
import { flattenDataFields } from '../fields/field.types';
import type {
	DeepDiffResult,
	DiffChangeType,
	TextDiffSegment,
	ArrayDiffItem,
} from './version.types';

/** Primitive field types that use direct === comparison. */
const PRIMITIVE_TYPES = new Set([
	'text',
	'textarea',
	'email',
	'slug',
	'number',
	'checkbox',
	'date',
	'select',
	'radio',
	'password',
	'point',
	'upload',
	'relationship',
]);

/** Text-like field types that get word-level diff. */
const TEXT_TYPES = new Set(['text', 'textarea', 'email', 'slug']);

/**
 * Compute a deep, field-aware diff between two document snapshots.
 */
export function deepDiff(
	oldObj: Record<string, unknown>,
	newObj: Record<string, unknown>,
	fields?: Field[],
): DeepDiffResult[] {
	if (fields && fields.length > 0) {
		return diffWithFields(oldObj, newObj, fields);
	}
	return diffWithoutFields(oldObj, newObj);
}

/**
 * Diff using field config for type-aware comparison.
 */
function diffWithFields(
	oldObj: Record<string, unknown>,
	newObj: Record<string, unknown>,
	fields: Field[],
): DeepDiffResult[] {
	const dataFields = flattenDataFields(fields);
	const results: DeepDiffResult[] = [];
	const processedKeys = new Set<string>();

	for (const field of dataFields) {
		processedKeys.add(field.name);
		if (field.diffExclude) continue;
		const result = diffField(field, oldObj[field.name], newObj[field.name]);
		results.push(result);
	}

	// Handle extra keys not in field config
	const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
	for (const key of allKeys) {
		if (!processedKeys.has(key)) {
			results.push(diffUnknownField(key, oldObj[key], newObj[key]));
		}
	}

	return results;
}

/**
 * Diff a single field based on its type.
 */
function diffField(field: Field, oldVal: unknown, newVal: unknown): DeepDiffResult {
	const base = {
		field: field.name,
		label: field.label,
		fieldType: field.type,
	};

	// Handle added/removed at the field level
	const oldUndef = oldVal === undefined || oldVal === null;
	const newUndef = newVal === undefined || newVal === null;

	if (oldUndef && newUndef) {
		return { ...base, changeType: 'unchanged' };
	}
	if (oldUndef) {
		return { ...base, changeType: 'added', newValue: newVal };
	}
	if (newUndef) {
		return { ...base, changeType: 'removed', oldValue: oldVal };
	}

	// Type-specific comparison
	if (field.type === 'group') {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowed by type check
		return diffGroupField(field as GroupField, oldVal, newVal);
	}
	if (field.type === 'array') {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowed by type check
		return diffArrayField(field as ArrayField, oldVal, newVal);
	}
	if (field.type === 'json' || field.type === 'blocks') {
		return diffJsonField(field, oldVal, newVal);
	}
	if (PRIMITIVE_TYPES.has(field.type)) {
		return diffPrimitiveField(field, oldVal, newVal);
	}

	// richText and anything else: value comparison with raw values
	if (oldVal === newVal || JSON.stringify(oldVal) === JSON.stringify(newVal)) {
		return { ...base, changeType: 'unchanged', oldValue: oldVal, newValue: newVal };
	}
	return { ...base, changeType: 'changed', oldValue: oldVal, newValue: newVal };
}

/**
 * Diff a primitive field using === comparison.
 * Adds textDiff for text-like types.
 */
function diffPrimitiveField(field: Field, oldVal: unknown, newVal: unknown): DeepDiffResult {
	const base = {
		field: field.name,
		label: field.label,
		fieldType: field.type,
		oldValue: oldVal,
		newValue: newVal,
	};

	if (oldVal === newVal) {
		return { ...base, changeType: 'unchanged' };
	}

	const result: DeepDiffResult = { ...base, changeType: 'changed' };

	// Add word-level diff for text types
	if (TEXT_TYPES.has(field.type) && typeof oldVal === 'string' && typeof newVal === 'string') {
		result.textDiff = wordDiff(oldVal, newVal);
	}

	return result;
}

/**
 * Diff a group field by recursing into sub-fields.
 */
function diffGroupField(field: GroupField, oldVal: unknown, newVal: unknown): DeepDiffResult {
	const base = {
		field: field.name,
		label: field.label,
		fieldType: 'group' as const,
	};

	const oldRec = isRecord(oldVal) ? oldVal : {};
	const newRec = isRecord(newVal) ? newVal : {};

	const children = diffWithFields(oldRec, newRec, field.fields);
	const hasChanges = children.some((c) => c.changeType !== 'unchanged');

	return {
		...base,
		changeType: hasChanges ? 'changed' : 'unchanged',
		oldValue: oldVal,
		newValue: newVal,
		children,
	};
}

/**
 * Diff an array field, matching items by `id` when present.
 */
function diffArrayField(field: ArrayField, oldVal: unknown, newVal: unknown): DeepDiffResult {
	const base = {
		field: field.name,
		label: field.label,
		fieldType: 'array' as const,
	};

	const oldArr = Array.isArray(oldVal) ? oldVal : [];
	const newArr = Array.isArray(newVal) ? newVal : [];

	// Check if items have ids
	const hasIds =
		oldArr.every((item) => isRecord(item) && 'id' in item) &&
		newArr.every((item) => isRecord(item) && 'id' in item);

	const arrayChanges: ArrayDiffItem[] = hasIds
		? diffArrayById(oldArr, newArr, field.fields)
		: diffArrayByIndex(oldArr, newArr, field.fields);

	const hasChanges = arrayChanges.length > 0;

	return {
		...base,
		changeType: hasChanges ? 'changed' : 'unchanged',
		oldValue: oldVal,
		newValue: newVal,
		arrayChanges: hasChanges ? arrayChanges : undefined,
	};
}

/**
 * Diff arrays by matching items on their `id` field.
 */
function diffArrayById(oldArr: unknown[], newArr: unknown[], subFields: Field[]): ArrayDiffItem[] {
	const changes: ArrayDiffItem[] = [];

	const oldMap = new Map<string, { item: Record<string, unknown>; index: number }>();
	for (let i = 0; i < oldArr.length; i++) {
		const item = toRecord(oldArr[i]);
		oldMap.set(String(item['id']), { item, index: i });
	}

	const newMap = new Map<string, { item: Record<string, unknown>; index: number }>();
	for (let i = 0; i < newArr.length; i++) {
		const item = toRecord(newArr[i]);
		newMap.set(String(item['id']), { item, index: i });
	}

	// Find removed items
	for (const [id, { item, index }] of oldMap) {
		if (!newMap.has(id)) {
			changes.push({ index, changeType: 'removed', oldValue: item });
		}
	}

	// Find added and changed items
	for (const [id, { item: newItem, index }] of newMap) {
		const oldEntry = oldMap.get(id);
		if (!oldEntry) {
			changes.push({ index, changeType: 'added', newValue: newItem });
		} else {
			// Compare sub-fields
			const children = diffWithFields(oldEntry.item, newItem, subFields);
			const hasFieldChanges = children.some((c) => c.changeType !== 'unchanged');
			if (hasFieldChanges) {
				changes.push({
					index,
					changeType: 'changed',
					oldValue: oldEntry.item,
					newValue: newItem,
					children,
				});
			}
		}
	}

	return changes;
}

/**
 * Diff arrays by index (no id matching).
 */
function diffArrayByIndex(
	oldArr: unknown[],
	newArr: unknown[],
	subFields: Field[],
): ArrayDiffItem[] {
	const changes: ArrayDiffItem[] = [];
	const maxLen = Math.max(oldArr.length, newArr.length);

	for (let i = 0; i < maxLen; i++) {
		if (i >= oldArr.length) {
			changes.push({ index: i, changeType: 'added', newValue: newArr[i] });
		} else if (i >= newArr.length) {
			changes.push({ index: i, changeType: 'removed', oldValue: oldArr[i] });
		} else {
			const oldItem = oldArr[i];
			const newItem = newArr[i];
			if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
				const oldRec = isRecord(oldItem) ? oldItem : {};
				const newRec = isRecord(newItem) ? newItem : {};
				const children =
					subFields.length > 0 ? diffWithFields(oldRec, newRec, subFields) : undefined;
				const hasFieldChanges = children
					? children.some((c) => c.changeType !== 'unchanged')
					: true;
				if (hasFieldChanges) {
					changes.push({
						index: i,
						changeType: 'changed',
						oldValue: oldItem,
						newValue: newItem,
						children: children?.filter((c) => c.changeType !== 'unchanged'),
					});
				}
			}
		}
	}

	return changes;
}

/**
 * Diff a JSON/blocks field using deep JSON comparison.
 */
function diffJsonField(field: Field, oldVal: unknown, newVal: unknown): DeepDiffResult {
	const base = {
		field: field.name,
		label: field.label,
		fieldType: field.type,
		oldValue: oldVal,
		newValue: newVal,
	};

	if (JSON.stringify(oldVal) === JSON.stringify(newVal)) {
		return { ...base, changeType: 'unchanged' };
	}
	return { ...base, changeType: 'changed' };
}

/**
 * Fallback diff without field config — compares all keys.
 */
function diffWithoutFields(
	oldObj: Record<string, unknown>,
	newObj: Record<string, unknown>,
): DeepDiffResult[] {
	const results: DeepDiffResult[] = [];
	const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

	for (const key of allKeys) {
		results.push(diffUnknownField(key, oldObj[key], newObj[key]));
	}

	return results;
}

/**
 * Diff a field without type metadata (fallback).
 */
function diffUnknownField(key: string, oldVal: unknown, newVal: unknown): DeepDiffResult {
	const oldUndef = oldVal === undefined || oldVal === null;
	const newUndef = newVal === undefined || newVal === null;

	let changeType: DiffChangeType;
	if (oldUndef && newUndef) {
		changeType = 'unchanged';
	} else if (oldUndef) {
		changeType = 'added';
	} else if (newUndef) {
		changeType = 'removed';
	} else if (JSON.stringify(oldVal) === JSON.stringify(newVal)) {
		changeType = 'unchanged';
	} else {
		changeType = 'changed';
	}

	return {
		field: key,
		changeType,
		oldValue: oldUndef ? undefined : oldVal,
		newValue: newUndef ? undefined : newVal,
	};
}

// ============================================
// Word-level diff
// ============================================

/** Max word count for LCS diffing. Above this, fall back to full add/remove. */
const WORD_DIFF_LIMIT = 2000;

/**
 * Compute word-level diff between two strings.
 * Uses a simple LCS algorithm on word arrays.
 * Falls back to full remove+add for texts exceeding WORD_DIFF_LIMIT words.
 */
export function wordDiff(oldText: string, newText: string): TextDiffSegment[] {
	if (oldText === newText) {
		return oldText.length > 0 ? [{ type: 'common', value: oldText }] : [];
	}
	if (oldText.length === 0) {
		return newText.length > 0 ? [{ type: 'added', value: newText }] : [];
	}
	if (newText.length === 0) {
		return [{ type: 'removed', value: oldText }];
	}

	const oldWords = oldText.split(/\s+/);
	const newWords = newText.split(/\s+/);

	// Guard against O(m*n) memory explosion for very large texts
	if (oldWords.length > WORD_DIFF_LIMIT || newWords.length > WORD_DIFF_LIMIT) {
		return [
			{ type: 'removed', value: oldText },
			{ type: 'added', value: newText },
		];
	}

	// Build LCS table
	const m = oldWords.length;
	const n = newWords.length;
	const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			if (oldWords[i - 1] === newWords[j - 1]) {
				dp[i][j] = dp[i - 1][j - 1] + 1;
			} else {
				dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
			}
		}
	}

	// Backtrack to build diff segments
	const segments: TextDiffSegment[] = [];
	let i = m;
	let j = n;

	// Collect raw operations in reverse order
	const ops: { type: 'common' | 'added' | 'removed'; word: string }[] = [];

	while (i > 0 || j > 0) {
		if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
			ops.push({ type: 'common', word: oldWords[i - 1] });
			i--;
			j--;
		} else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
			ops.push({ type: 'added', word: newWords[j - 1] });
			j--;
		} else {
			ops.push({ type: 'removed', word: oldWords[i - 1] });
			i--;
		}
	}

	ops.reverse();

	// Merge consecutive same-type operations into segments
	for (const op of ops) {
		const last = segments[segments.length - 1];
		if (last && last.type === op.type) {
			last.value += ' ' + op.word;
		} else {
			segments.push({ type: op.type, value: op.word });
		}
	}

	return segments;
}

// ============================================
// Utilities
// ============================================

function isRecord(val: unknown): val is Record<string, unknown> {
	return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function toRecord(val: unknown): Record<string, unknown> {
	return isRecord(val) ? val : {};
}
