import { type Rule, type SchematicContext, type Tree } from '@angular-devkit/schematics';
import { execFileSync } from 'node:child_process';
import type { MigrationStatusSchema } from './schema';

/**
 * Angular schematic that shows the status of all migrations.
 *
 * Usage: ng generate @momentumcms/migrations:status
 */
export function migrationStatus(options: MigrationStatusSchema): Rule {
	return (_tree: Tree, context: SchematicContext) => {
		const configPath = options.configPath || 'src/momentum.config.ts';
		const args = ['tsx', 'node_modules/@momentumcms/migrations/cli/status.cjs', configPath];

		context.logger.info('Checking migration status...');

		try {
			execFileSync('npx', args, { stdio: 'inherit', shell: true });
		} catch (error) {
			context.logger.error('Migration status check failed.');
			throw error;
		}

		return _tree;
	};
}
