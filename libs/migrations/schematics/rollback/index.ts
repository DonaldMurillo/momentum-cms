import { type Rule, type SchematicContext, type Tree } from '@angular-devkit/schematics';
import { execFileSync } from 'node:child_process';
import type { MigrationRollbackSchema } from './schema';

/**
 * Angular schematic that rolls back the latest batch of applied migrations.
 *
 * Usage: ng generate @momentumcms/migrations:rollback
 */
export function migrationRollback(options: MigrationRollbackSchema): Rule {
	return (_tree: Tree, context: SchematicContext) => {
		const configPath = options.configPath || 'src/momentum.config.ts';
		const args = ['tsx', 'node_modules/@momentumcms/migrations/cli/rollback.cjs', configPath];

		context.logger.info('Rolling back latest migration batch...');

		try {
			execFileSync('npx', args, { stdio: 'inherit', shell: true });
		} catch (error) {
			context.logger.error('Migration rollback failed.');
			throw error;
		}

		return _tree;
	};
}
