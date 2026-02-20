import { describe, it, expect } from 'vitest';
import {
	fieldToPostgresType,
	fieldToSqliteType,
	fieldToColumnType,
	normalizeColumnType,
	areTypesCompatible,
} from '../column-type-map';
import type { Field } from '@momentumcms/core';

/**
 * Helper to create a minimal field with a given type.
 */
function makeField(type: string, name = 'test'): Field {
	 
	return { name, type } as Field;
}

describe('column-type-map', () => {
	describe('fieldToPostgresType', () => {
		it.each([
			['text', 'TEXT'],
			['textarea', 'TEXT'],
			['richText', 'TEXT'],
			['password', 'TEXT'],
			['radio', 'TEXT'],
			['point', 'TEXT'],
		])('should map %s to %s', (fieldType, expected) => {
			expect(fieldToPostgresType(makeField(fieldType))).toBe(expected);
		});

		it.each([
			['email', 'VARCHAR(255)'],
			['slug', 'VARCHAR(255)'],
			['select', 'VARCHAR(255)'],
		])('should map %s to %s', (fieldType, expected) => {
			expect(fieldToPostgresType(makeField(fieldType))).toBe(expected);
		});

		it('should map number to NUMERIC', () => {
			expect(fieldToPostgresType(makeField('number'))).toBe('NUMERIC');
		});

		it('should map checkbox to BOOLEAN', () => {
			expect(fieldToPostgresType(makeField('checkbox'))).toBe('BOOLEAN');
		});

		it('should map date to TIMESTAMPTZ', () => {
			expect(fieldToPostgresType(makeField('date'))).toBe('TIMESTAMPTZ');
		});

		it.each([
			['relationship', 'VARCHAR(36)'],
			['upload', 'VARCHAR(36)'],
		])('should map %s to %s', (fieldType, expected) => {
			expect(fieldToPostgresType(makeField(fieldType))).toBe(expected);
		});

		it.each([
			['array', 'JSONB'],
			['group', 'JSONB'],
			['blocks', 'JSONB'],
			['json', 'JSONB'],
		])('should map %s to %s', (fieldType, expected) => {
			expect(fieldToPostgresType(makeField(fieldType))).toBe(expected);
		});

		it.each(['tabs', 'collapsible', 'row'])(
			'should map layout field %s to TEXT as fallback',
			(fieldType) => {
				expect(fieldToPostgresType(makeField(fieldType))).toBe('TEXT');
			},
		);

		it('should map unknown types to TEXT', () => {
			expect(fieldToPostgresType(makeField('customType'))).toBe('TEXT');
		});
	});

	describe('fieldToSqliteType', () => {
		it.each([
			['text', 'TEXT'],
			['textarea', 'TEXT'],
			['richText', 'TEXT'],
			['email', 'TEXT'],
			['slug', 'TEXT'],
			['select', 'TEXT'],
			['password', 'TEXT'],
			['radio', 'TEXT'],
			['point', 'TEXT'],
		])('should map %s to %s', (fieldType, expected) => {
			expect(fieldToSqliteType(makeField(fieldType))).toBe(expected);
		});

		it('should map number to REAL', () => {
			expect(fieldToSqliteType(makeField('number'))).toBe('REAL');
		});

		it('should map checkbox to INTEGER', () => {
			expect(fieldToSqliteType(makeField('checkbox'))).toBe('INTEGER');
		});

		it.each([
			['date', 'TEXT'],
			['relationship', 'TEXT'],
			['upload', 'TEXT'],
			['array', 'TEXT'],
			['group', 'TEXT'],
			['blocks', 'TEXT'],
			['json', 'TEXT'],
		])('should map %s to %s', (fieldType, expected) => {
			expect(fieldToSqliteType(makeField(fieldType))).toBe(expected);
		});
	});

	describe('fieldToColumnType', () => {
		it('should delegate to postgres mapper for postgresql dialect', () => {
			expect(fieldToColumnType(makeField('checkbox'), 'postgresql')).toBe('BOOLEAN');
		});

		it('should delegate to sqlite mapper for sqlite dialect', () => {
			expect(fieldToColumnType(makeField('checkbox'), 'sqlite')).toBe('INTEGER');
		});
	});

	describe('normalizeColumnType', () => {
		describe('postgresql', () => {
			it('should normalize CHARACTER VARYING(255) to VARCHAR(255)', () => {
				expect(normalizeColumnType('character varying(255)', 'postgresql')).toBe(
					'VARCHAR(255)',
				);
			});

			it('should normalize CHARACTER VARYING(36) to VARCHAR(36)', () => {
				expect(normalizeColumnType('character varying(36)', 'postgresql')).toBe(
					'VARCHAR(36)',
				);
			});

			it('should normalize CHARACTER VARYING (no length) to VARCHAR(255)', () => {
				expect(normalizeColumnType('character varying', 'postgresql')).toBe('VARCHAR(255)');
			});

			it('should normalize TIMESTAMP WITH TIME ZONE to TIMESTAMPTZ', () => {
				expect(normalizeColumnType('timestamp with time zone', 'postgresql')).toBe(
					'TIMESTAMPTZ',
				);
			});

			it('should normalize TIMESTAMP WITHOUT TIME ZONE to TIMESTAMP', () => {
				expect(normalizeColumnType('timestamp without time zone', 'postgresql')).toBe(
					'TIMESTAMP',
				);
			});

			it('should pass through already-normalized types', () => {
				expect(normalizeColumnType('TEXT', 'postgresql')).toBe('TEXT');
				expect(normalizeColumnType('JSONB', 'postgresql')).toBe('JSONB');
				expect(normalizeColumnType('BOOLEAN', 'postgresql')).toBe('BOOLEAN');
				expect(normalizeColumnType('NUMERIC', 'postgresql')).toBe('NUMERIC');
			});
		});

		describe('sqlite', () => {
			it('should normalize INT to INTEGER', () => {
				expect(normalizeColumnType('INT', 'sqlite')).toBe('INTEGER');
			});

			it('should normalize FLOAT to REAL', () => {
				expect(normalizeColumnType('FLOAT', 'sqlite')).toBe('REAL');
			});

			it('should normalize DOUBLE to REAL', () => {
				expect(normalizeColumnType('DOUBLE', 'sqlite')).toBe('REAL');
			});

			it('should pass through TEXT', () => {
				expect(normalizeColumnType('TEXT', 'sqlite')).toBe('TEXT');
			});
		});
	});

	describe('areTypesCompatible', () => {
		it('should consider character varying(255) and VARCHAR(255) compatible', () => {
			expect(
				areTypesCompatible('character varying(255)', 'VARCHAR(255)', 'postgresql'),
			).toBe(true);
		});

		it('should consider timestamp with time zone and TIMESTAMPTZ compatible', () => {
			expect(
				areTypesCompatible('timestamp with time zone', 'TIMESTAMPTZ', 'postgresql'),
			).toBe(true);
		});

		it('should consider TEXT and TEXT compatible', () => {
			expect(areTypesCompatible('TEXT', 'TEXT', 'postgresql')).toBe(true);
		});

		it('should consider TEXT and JSONB incompatible', () => {
			expect(areTypesCompatible('TEXT', 'JSONB', 'postgresql')).toBe(false);
		});

		it('should consider INT and INTEGER compatible in SQLite', () => {
			expect(areTypesCompatible('INT', 'INTEGER', 'sqlite')).toBe(true);
		});
	});
});
