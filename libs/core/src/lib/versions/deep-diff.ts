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
	// Treat only undefined (field absent) as "missing". Null is a valid value
	// meaning "explicitly cleared" — it must not be conflated with undefined.
	const oldMissing = oldVal === undefined;
	const newMissing = newVal === undefined;

	if (oldMissing && newMissing) {
		return { ...base, changeType: 'unchanged' };
	}
	if (oldMissing) {
		return { ...base, changeType: 'added', newValue: newVal };
	}
	if (newMissing) {
		return { ...base, changeType: 'removed', oldValue: oldVal };
	}

	// Both values are present (including null). Compare them directly.
	if (oldVal === null && newVal === null) {
		return { ...base, changeType: 'unchanged', oldValue: oldVal, newValue: newVal };
	}
	if (oldVal === null || newVal === null) {
		// One is null, other is non-null — this is a change
		return { ...base, changeType: 'changed', oldValue: oldVal, newValue: newVal };
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
	// Treat only undefined as "missing". Null is a valid value meaning
	// "explicitly cleared" — distinct from "field absent".
	const oldMissing = oldVal === undefined;
	const newMissing = newVal === undefined;

	let changeType: DiffChangeType;
	if (oldMissing && newMissing) {
		changeType = 'unchanged';
	} else if (oldMissing) {
		changeType = 'added';
	} else if (newMissing) {
		changeType = 'removed';
	} else if (oldVal === newVal || JSON.stringify(oldVal) === JSON.stringify(newVal)) {
		changeType = 'unchanged';
	} else {
		changeType = 'changed';
	}

	return {
		field: key,
		changeType,
		oldValue: oldMissing ? undefined : oldVal,
		newValue: newMissing ? undefined : newVal,
	};
}
// ============================================
// Word-level diff — Hirschberg's algorithm
// ============================================

/** Max word count for LCS diffing. Above this, fall back to full add/remove. */
const WORD_DIFF_LIMIT = 2000;

/**
 * Compute word-level diff between two strings.
 * Uses Hirschberg’s algorithm (divide-and-conquer LCS) for O(min(m,n)) space.
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

	let oldWords = oldText.split(/\s+/);
	let newWords = newText.split(/\s+/);

	// Guard against excessive computation for very large texts
	if (oldWords.length > WORD_DIFF_LIMIT || newWords.length > WORD_DIFF_LIMIT) {
		return [
			{ type: 'removed', value: oldText },
			{ type: 'added', value: newText },
		];
	}

	// Ensure oldWords is the longer sequence so Hirschberg splits the longer side
	// and computes DP rows of size min(m,n), giving O(min(m,n)) space.
	let swapped = false;
	if (oldWords.length < newWords.length) {
		[oldWords, newWords] = [newWords, oldWords];
		swapped = true;
	}

	const ops = hirschbergDiff(oldWords, 0, oldWords.length, newWords, 0, newWords.length);

	// Swap operation types back if sequences were swapped
	const finalOps = swapped
		? ops.map((op) => ({
				...op,
				type:
					op.type === 'added'
						? ('removed' as const)
						: op.type === 'removed'
							? ('added' as const)
							: op.type,
			}))
		: ops;

	// Merge consecutive same-type operations into segments
	const segments: TextDiffSegment[] = [];
	for (const op of finalOps) {
		const last = segments[segments.length - 1];
		if (last && last.type === op.type) {
			last.value += ' ' + op.word;
		} else {
			segments.push({ type: op.type, value: op.word });
		}
	}

	return segments;
}

// --------------------------------------------
// Hirschberg helpers (file-private)
// --------------------------------------------

/** A single diff operation produced by Hirschberg's recursion. */
type DiffOp = { type: 'common' | 'added' | 'removed'; word: string };

/**
 * Compute the last row of the LCS DP table for a[aStart..aEnd) × b[bStart..bEnd)
 * using only two rows (O(n) space where n = bEnd - bStart).
 */
function computeLcsRow(
	a: string[],
	aStart: number,
	aEnd: number,
	b: string[],
	bStart: number,
	bEnd: number,
): Uint16Array {
	const n = bEnd - bStart;
	let prev = new Uint16Array(n + 1);
	let curr = new Uint16Array(n + 1);

	for (let i = aStart; i < aEnd; i++) {
		const aWord = a[i];
		for (let j = 1; j <= n; j++) {
			if (aWord === b[bStart + j - 1]) {
				curr[j] = prev[j - 1] + 1;
			} else {
				curr[j] = prev[j] > curr[j - 1] ? prev[j] : curr[j - 1];
			}
		}
		const tmp = prev;
		prev = curr;
		curr = tmp;
	}

	return prev;
}

/**
 * Compute the last row of the LCS DP table for reversed subsequences:
 * reverse(a[aStart..aEnd)) × reverse(b[bStart..bEnd)).
 * Uses the same two-row O(n) space technique.
 */
function computeLcsRowReverse(
	a: string[],
	aStart: number,
	aEnd: number,
	b: string[],
	bStart: number,
	bEnd: number,
): Uint16Array {
	const n = bEnd - bStart;
	let prev = new Uint16Array(n + 1);
	let curr = new Uint16Array(n + 1);

	for (let i = aEnd - 1; i >= aStart; i--) {
		const aWord = a[i];
		for (let j = 1; j <= n; j++) {
			if (aWord === b[bEnd - j]) {
				curr[j] = prev[j - 1] + 1;
			} else {
				curr[j] = prev[j] > curr[j - 1] ? prev[j] : curr[j - 1];
			}
		}
		const tmp = prev;
		prev = curr;
		curr = tmp;
	}

	return prev;
}

/**
 * Standard LCS diff using full DP table — used as the base case for Hirschberg's
 * when one dimension is ≤ 1. This is small enough that O(m*n) memory is trivial.
 */
function standardLcsDiff(
	oldWords: string[],
	oStart: number,
	oEnd: number,
	newWords: string[],
	nStart: number,
	nEnd: number,
): DiffOp[] {
	const m = oEnd - oStart;
	const n = nEnd - nStart;

	if (m === 0) {
		const ops: DiffOp[] = [];
		for (let j = nStart; j < nEnd; j++) ops.push({ type: 'added', word: newWords[j] });
		return ops;
	}
	if (n === 0) {
		const ops: DiffOp[] = [];
		for (let i = oStart; i < oEnd; i++) ops.push({ type: 'removed', word: oldWords[i] });
		return ops;
	}

	// Build small DP table
	const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			if (oldWords[oStart + i - 1] === newWords[nStart + j - 1]) {
				dp[i][j] = dp[i - 1][j - 1] + 1;
			} else {
				dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
			}
		}
	}

	// Backtrack (same tie-breaking as original: prefer 'added' when tied)
	const ops: DiffOp[] = [];
	let i = m;
	let j = n;

	while (i > 0 || j > 0) {
		if (i > 0 && j > 0 && oldWords[oStart + i - 1] === newWords[nStart + j - 1]) {
			ops.push({ type: 'common', word: oldWords[oStart + i - 1] });
			i--;
			j--;
		} else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
			ops.push({ type: 'added', word: newWords[nStart + j - 1] });
			j--;
		} else {
			ops.push({ type: 'removed', word: oldWords[oStart + i - 1] });
			i--;
		}
	}

	ops.reverse();
	return ops;
}

/**
 * Hirschberg's divide-and-conquer LCS algorithm.
 * Space: O(min(m,n)) — only two DP rows per recursion level, and left completes
 * before right starts so peak memory is O(n) × O(log m) stack depth.
 * Time:  O(m*n) — same asymptotic complexity as the standard algorithm.
 */
function hirschbergDiff(
	oldWords: string[],
	oStart: number,
	oEnd: number,
	newWords: string[],
	nStart: number,
	nEnd: number,
): DiffOp[] {
	const m = oEnd - oStart;
	const n = nEnd - nStart;

	// Base case: small enough for standard DP (O(m*n) is trivial here)
	if (m <= 1 || n <= 1) {
		return standardLcsDiff(oldWords, oStart, oEnd, newWords, nStart, nEnd);
	}

	// Split old sequence at midpoint
	const mid = oStart + Math.floor(m / 2);

	// Forward pass: LCS row for old[oStart..mid) × new[nStart..nEnd)
	const forward = computeLcsRow(oldWords, oStart, mid, newWords, nStart, nEnd);

	// Backward pass: LCS row for reversed old[mid..oEnd) × reversed new[nStart..nEnd)
	const backward = computeLcsRowReverse(oldWords, mid, oEnd, newWords, nStart, nEnd);

	// Find split point k in [0..n] that maximises forward[k] + backward[n-k]
	let maxSum = -1;
	let bestK = 0;
	for (let k = 0; k <= n; k++) {
		const sum = forward[k] + backward[n - k];
		if (sum > maxSum) {
			maxSum = sum;
			bestK = k;
		}
	}

	const splitN = nStart + bestK;

	// Recurse on the two halves — left completes before right starts
	const left = hirschbergDiff(oldWords, oStart, mid, newWords, nStart, splitN);
	const right = hirschbergDiff(oldWords, mid, oEnd, newWords, splitN, nEnd);

	return [...left, ...right];
}

// Utilities
// ============================================

function isRecord(val: unknown): val is Record<string, unknown> {
	return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function toRecord(val: unknown): Record<string, unknown> {
	return isRecord(val) ? val : {};
}
