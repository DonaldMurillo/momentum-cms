/**
 * Data Migration Helpers
 *
 * Provides batched, safe data transformation operations for use
 * within migration up/down functions via MigrationContext.data.
 */
import type { DataMigrationHelpers } from '../migration.types';
import type { DatabaseDialect } from '../schema/column-type-map';

/**
 * Database interface needed by data helpers.
 */
export interface DataHelperDb {
	execute(sql: string, params?: unknown[]): Promise<number>;
	query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

/**
 * Create a DataMigrationHelpers instance bound to a database.
 */
export function createDataHelpers(
	db: DataHelperDb,
	dialect: DatabaseDialect,
): DataMigrationHelpers {
	const ph = (index: number): string =>
		dialect === 'postgresql' ? `$${index}` : '?';

	return {
		async backfill(
			table: string,
			column: string,
			value: unknown,
			options?,
		): Promise<number> {
			const where = options?.where ? ` AND (${options.where})` : '';
			const batchSize = options?.batchSize ?? 1000;
			let totalAffected = 0;

			if (dialect === 'postgresql') {
				// PostgreSQL: batch via ctid
				let affected: number;
				do {
					affected = await db.execute(
						`UPDATE "${table}" SET "${column}" = ${ph(1)}
						 WHERE ctid IN (
							SELECT ctid FROM "${table}"
							WHERE "${column}" IS NULL${where}
							LIMIT ${batchSize}
						 )`,
						[value],
					);
					totalAffected += affected;
				} while (affected >= batchSize);
			} else {
				// SQLite: simpler approach using rowid
				let affected: number;
				do {
					affected = await db.execute(
						`UPDATE "${table}" SET "${column}" = ${ph(1)}
						 WHERE rowid IN (
							SELECT rowid FROM "${table}"
							WHERE "${column}" IS NULL${where}
							LIMIT ${batchSize}
						 )`,
						[value],
					);
					totalAffected += affected;
				} while (affected >= batchSize);
			}

			return totalAffected;
		},

		async transform(
			table: string,
			column: string,
			sqlExpression: string,
			options?,
		): Promise<number> {
			const where = options?.where ? ` WHERE ${options.where}` : '';
			const batchSize = options?.batchSize ?? 0; // 0 = no batching

			if (batchSize <= 0) {
				return db.execute(
					`UPDATE "${table}" SET "${column}" = ${sqlExpression}${where}`,
				);
			}

			// Batched transform
			let totalAffected = 0;
			let affected: number;
			do {
				if (dialect === 'postgresql') {
					affected = await db.execute(
						`UPDATE "${table}" SET "${column}" = ${sqlExpression}
						 WHERE ctid IN (
							SELECT ctid FROM "${table}"${where}
							LIMIT ${batchSize}
						 )`,
					);
				} else {
					affected = await db.execute(
						`UPDATE "${table}" SET "${column}" = ${sqlExpression}
						 WHERE rowid IN (
							SELECT rowid FROM "${table}"${where}
							LIMIT ${batchSize}
						 )`,
					);
				}
				totalAffected += affected;
			} while (affected >= batchSize);

			return totalAffected;
		},

		async renameColumn(
			table: string,
			from: string,
			to: string,
			columnType: string,
		): Promise<void> {
			// Safe rename: add new column, copy data, drop old
			await db.execute(
				`ALTER TABLE "${table}" ADD COLUMN "${to}" ${columnType}`,
			);
			await db.execute(
				`UPDATE "${table}" SET "${to}" = "${from}"`,
			);
			await db.execute(
				`ALTER TABLE "${table}" DROP COLUMN "${from}"`,
			);
		},

		async splitColumn(
			table: string,
			_sourceColumn: string,
			targets: Array<{ name: string; type: string; expression: string }>,
		): Promise<void> {
			for (const target of targets) {
				await db.execute(
					`ALTER TABLE "${table}" ADD COLUMN "${target.name}" ${target.type}`,
				);
				await db.execute(
					`UPDATE "${table}" SET "${target.name}" = ${target.expression}`,
				);
			}
		},

		async mergeColumns(
			table: string,
			_sourceColumns: string[],
			targetColumn: string,
			targetType: string,
			mergeExpression: string,
		): Promise<void> {
			await db.execute(
				`ALTER TABLE "${table}" ADD COLUMN "${targetColumn}" ${targetType}`,
			);
			await db.execute(
				`UPDATE "${table}" SET "${targetColumn}" = ${mergeExpression}`,
			);
		},

		async copyData(
			sourceTable: string,
			targetTable: string,
			columnMapping: Record<string, string | { expression: string }>,
			options?,
		): Promise<number> {
			const targetCols: string[] = [];
			const sourceCols: string[] = [];

			for (const [target, source] of Object.entries(columnMapping)) {
				targetCols.push(`"${target}"`);
				if (typeof source === 'string') {
					sourceCols.push(`"${source}"`);
				} else {
					sourceCols.push(source.expression);
				}
			}

			const where = options?.where ? ` WHERE ${options.where}` : '';

			const affected = await db.execute(
				`INSERT INTO "${targetTable}" (${targetCols.join(', ')})
				 SELECT ${sourceCols.join(', ')} FROM "${sourceTable}"${where}`,
			);

			return affected;
		},

		async columnToJson(
			table: string,
			sourceColumn: string,
			jsonColumn: string,
			jsonKey: string,
		): Promise<void> {
			if (dialect === 'postgresql') {
				await db.execute(
					`UPDATE "${table}" SET "${jsonColumn}" = COALESCE("${jsonColumn}", '{}'::jsonb) || jsonb_build_object('${jsonKey}', "${sourceColumn}")`,
				);
			} else {
				await db.execute(
					`UPDATE "${table}" SET "${jsonColumn}" = json_set(COALESCE("${jsonColumn}", '{}'), '$.${jsonKey}', "${sourceColumn}")`,
				);
			}
		},

		async jsonToColumn(
			table: string,
			jsonColumn: string,
			jsonKey: string,
			targetColumn: string,
			targetType: string,
		): Promise<void> {
			await db.execute(
				`ALTER TABLE "${table}" ADD COLUMN "${targetColumn}" ${targetType}`,
			);

			if (dialect === 'postgresql') {
				await db.execute(
					`UPDATE "${table}" SET "${targetColumn}" = "${jsonColumn}"->>'${jsonKey}'`,
				);
			} else {
				await db.execute(
					`UPDATE "${table}" SET "${targetColumn}" = json_extract("${jsonColumn}", '$.${jsonKey}')`,
				);
			}
		},

		async dedup(
			table: string,
			columns: string[],
			keepStrategy = 'latest',
		): Promise<number> {
			const colList = columns.map((c) => `"${c}"`).join(', ');

			let orderBy: string;
			switch (keepStrategy) {
				case 'earliest':
					orderBy = '"createdAt" ASC';
					break;
				case 'first':
					orderBy = dialect === 'postgresql' ? 'ctid ASC' : 'rowid ASC';
					break;
				default: // 'latest'
					orderBy = '"createdAt" DESC';
					break;
			}

			if (dialect === 'postgresql') {
				return db.execute(
					`DELETE FROM "${table}" WHERE ctid NOT IN (
						SELECT DISTINCT ON (${colList}) ctid
						FROM "${table}"
						ORDER BY ${colList}, ${orderBy}
					)`,
				);
			}

			// SQLite
			return db.execute(
				`DELETE FROM "${table}" WHERE rowid NOT IN (
					SELECT MIN(rowid) FROM "${table}"
					GROUP BY ${colList}
				)`,
			);
		},
	};
}
