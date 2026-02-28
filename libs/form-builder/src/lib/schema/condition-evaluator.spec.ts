import { evaluateConditions } from './condition-evaluator';
import type { FormCondition } from '../types/form-schema.types';

describe('evaluateConditions', () => {
	it('should return true for empty conditions', () => {
		expect(evaluateConditions([], {})).toBe(true);
	});

	describe('equals operator', () => {
		it('should return true when field equals value', () => {
			const conditions: FormCondition[] = [
				{ field: 'status', operator: 'equals', value: 'active' },
			];
			expect(evaluateConditions(conditions, { status: 'active' })).toBe(true);
		});

		it('should return false when field does not equal value', () => {
			const conditions: FormCondition[] = [
				{ field: 'status', operator: 'equals', value: 'active' },
			];
			expect(evaluateConditions(conditions, { status: 'inactive' })).toBe(false);
		});
	});

	describe('not_equals operator', () => {
		it('should return true when field does not equal value', () => {
			const conditions: FormCondition[] = [
				{ field: 'status', operator: 'not_equals', value: 'draft' },
			];
			expect(evaluateConditions(conditions, { status: 'published' })).toBe(true);
		});

		it('should return false when field equals value', () => {
			const conditions: FormCondition[] = [
				{ field: 'status', operator: 'not_equals', value: 'draft' },
			];
			expect(evaluateConditions(conditions, { status: 'draft' })).toBe(false);
		});
	});

	describe('contains operator', () => {
		it('should return true when string contains value', () => {
			const conditions: FormCondition[] = [{ field: 'name', operator: 'contains', value: 'John' }];
			expect(evaluateConditions(conditions, { name: 'John Doe' })).toBe(true);
		});

		it('should return false when string does not contain value', () => {
			const conditions: FormCondition[] = [{ field: 'name', operator: 'contains', value: 'Jane' }];
			expect(evaluateConditions(conditions, { name: 'John Doe' })).toBe(false);
		});

		it('should return false for non-string values', () => {
			const conditions: FormCondition[] = [{ field: 'count', operator: 'contains', value: '5' }];
			expect(evaluateConditions(conditions, { count: 5 })).toBe(false);
		});
	});

	describe('not_empty operator', () => {
		it('should return true for non-empty string', () => {
			const conditions: FormCondition[] = [{ field: 'name', operator: 'not_empty' }];
			expect(evaluateConditions(conditions, { name: 'John' })).toBe(true);
		});

		it('should return false for empty string', () => {
			const conditions: FormCondition[] = [{ field: 'name', operator: 'not_empty' }];
			expect(evaluateConditions(conditions, { name: '' })).toBe(false);
		});

		it('should return false for null', () => {
			const conditions: FormCondition[] = [{ field: 'name', operator: 'not_empty' }];
			expect(evaluateConditions(conditions, { name: null })).toBe(false);
		});

		it('should return false for undefined', () => {
			const conditions: FormCondition[] = [{ field: 'name', operator: 'not_empty' }];
			expect(evaluateConditions(conditions, { name: undefined })).toBe(false);
		});
	});

	describe('empty operator', () => {
		it('should return true for empty string', () => {
			const conditions: FormCondition[] = [{ field: 'name', operator: 'empty' }];
			expect(evaluateConditions(conditions, { name: '' })).toBe(true);
		});

		it('should return true for null', () => {
			const conditions: FormCondition[] = [{ field: 'name', operator: 'empty' }];
			expect(evaluateConditions(conditions, { name: null })).toBe(true);
		});

		it('should return false for non-empty string', () => {
			const conditions: FormCondition[] = [{ field: 'name', operator: 'empty' }];
			expect(evaluateConditions(conditions, { name: 'John' })).toBe(false);
		});
	});

	describe('multiple conditions (AND logic)', () => {
		it('should return true when all conditions are met', () => {
			const conditions: FormCondition[] = [
				{ field: 'type', operator: 'equals', value: 'business' },
				{ field: 'name', operator: 'not_empty' },
			];
			expect(evaluateConditions(conditions, { type: 'business', name: 'Acme' })).toBe(true);
		});

		it('should return false when any condition is not met', () => {
			const conditions: FormCondition[] = [
				{ field: 'type', operator: 'equals', value: 'business' },
				{ field: 'name', operator: 'not_empty' },
			];
			expect(evaluateConditions(conditions, { type: 'business', name: '' })).toBe(false);
		});
	});

	describe('missing field in data', () => {
		it('should return false when field is not present in values', () => {
			const conditions: FormCondition[] = [{ field: 'missing', operator: 'equals', value: 'x' }];
			expect(evaluateConditions(conditions, {})).toBe(false);
		});
	});
});
