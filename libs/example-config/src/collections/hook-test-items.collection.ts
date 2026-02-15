import { defineCollection, text, number, allowAll } from '@momentum-cms/core';

/**
 * In-memory hook invocation log for E2E testing.
 * Tracks every hook call so tests can verify hook behavior.
 */
export interface HookInvocation {
	hookType: string;
	operation?: string;
	data?: Record<string, unknown>;
	doc?: Record<string, unknown>;
	originalDoc?: Record<string, unknown>;
	timestamp: number;
}

const hookInvocations: HookInvocation[] = [];

/**
 * Configurable hook behavior for testing error and transform paths.
 */
export interface HookBehaviorConfig {
	/** Hook types that should throw an error */
	throwOn?: string[];
	/** Hook types that should transform data */
	transformOn?: string[];
	/** Field name to set during transform */
	transformField?: string;
	/** Value to set on the transform field */
	transformValue?: string;
}

let hookBehavior: HookBehaviorConfig = {};

/** Get the current hook invocation log. */
export function getHookLog(): HookInvocation[] {
	return hookInvocations;
}

/** Clear all hook invocations. */
export function clearHookLog(): void {
	hookInvocations.length = 0;
}

/** Get the current hook behavior config. */
export function getHookBehavior(): HookBehaviorConfig {
	return hookBehavior;
}

/** Set the hook behavior config. */
export function setHookBehavior(config: HookBehaviorConfig): void {
	hookBehavior = config;
}

/**
 * Collection with all lifecycle hooks wired for E2E testing.
 * Hooks log invocations and optionally throw or transform based on hookBehavior config.
 */
export const HookTestItems = defineCollection({
	slug: 'hook-test-items',
	labels: {
		singular: 'HookTestItem',
		plural: 'HookTestItems',
	},
	fields: [
		text('title', { required: true, label: 'Title' }),
		text('slug', { label: 'Slug' }),
		text('status', { label: 'Status' }),
		number('priority', { label: 'Priority' }),
	],
	access: {
		read: allowAll(),
		create: allowAll(),
		update: allowAll(),
		delete: allowAll(),
		admin: allowAll(),
	},
	hooks: {
		beforeValidate: [
			({ data, operation, originalDoc }) => {
				hookInvocations.push({
					hookType: 'beforeValidate',
					operation,
					data: data ? { ...data } : undefined,
					originalDoc: originalDoc ? { ...originalDoc } : undefined,
					timestamp: Date.now(),
				});
				if (hookBehavior.throwOn?.includes('beforeValidate')) {
					throw new Error('Hook error: beforeValidate');
				}
				if (
					hookBehavior.transformOn?.includes('beforeValidate') &&
					data &&
					hookBehavior.transformField
				) {
					return { ...data, [hookBehavior.transformField]: hookBehavior.transformValue };
				}
				return undefined;
			},
		],
		beforeChange: [
			({ data, operation, originalDoc }) => {
				hookInvocations.push({
					hookType: 'beforeChange',
					operation,
					data: data ? { ...data } : undefined,
					originalDoc: originalDoc ? { ...originalDoc } : undefined,
					timestamp: Date.now(),
				});
				if (hookBehavior.throwOn?.includes('beforeChange')) {
					throw new Error('Hook error: beforeChange');
				}
				if (
					hookBehavior.transformOn?.includes('beforeChange') &&
					data &&
					hookBehavior.transformField
				) {
					return { ...data, [hookBehavior.transformField]: hookBehavior.transformValue };
				}
				return undefined;
			},
		],
		afterChange: [
			({ data, operation, originalDoc }) => {
				hookInvocations.push({
					hookType: 'afterChange',
					operation,
					doc: data ? { ...data } : undefined,
					originalDoc: originalDoc ? { ...originalDoc } : undefined,
					timestamp: Date.now(),
				});
				if (hookBehavior.throwOn?.includes('afterChange')) {
					throw new Error('Hook error: afterChange');
				}
			},
		],
		beforeRead: [
			() => {
				hookInvocations.push({
					hookType: 'beforeRead',
					timestamp: Date.now(),
				});
				if (hookBehavior.throwOn?.includes('beforeRead')) {
					throw new Error('Hook error: beforeRead');
				}
			},
		],
		afterRead: [
			({ doc }) => {
				hookInvocations.push({
					hookType: 'afterRead',
					doc: doc ? { ...doc } : undefined,
					timestamp: Date.now(),
				});
				if (hookBehavior.throwOn?.includes('afterRead')) {
					throw new Error('Hook error: afterRead');
				}
				if (hookBehavior.transformOn?.includes('afterRead') && doc && hookBehavior.transformField) {
					return { ...doc, [hookBehavior.transformField]: hookBehavior.transformValue };
				}
				return undefined;
			},
		],
		beforeDelete: [
			({ doc }) => {
				hookInvocations.push({
					hookType: 'beforeDelete',
					doc: doc ? { ...doc } : undefined,
					timestamp: Date.now(),
				});
				if (hookBehavior.throwOn?.includes('beforeDelete')) {
					throw new Error('Hook error: beforeDelete');
				}
			},
		],
		afterDelete: [
			({ doc }) => {
				hookInvocations.push({
					hookType: 'afterDelete',
					doc: doc ? { ...doc } : undefined,
					timestamp: Date.now(),
				});
				if (hookBehavior.throwOn?.includes('afterDelete')) {
					throw new Error('Hook error: afterDelete');
				}
			},
		],
	},
});
