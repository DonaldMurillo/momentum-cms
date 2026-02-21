import { type Rule, type SchematicContext, type Tree } from '@angular-devkit/schematics';
import { execFileSync } from 'node:child_process';
import type { MigrationRunSchema } from './schema';

/**
 * Angular schematic that runs pending migrations.
 * Supports clone-test-apply safety pipeline for PostgreSQL.
 *
 * Usage: ng generate @momentumcms/migrations:run [--testOnly] [--skipCloneTest]
 */
export function migrationRun(options: MigrationRunSchema): Rule {
	return (_tree: Tree, context: SchematicContext) => {
		const configPath = options.configPath || 'src/momentum.config.ts';
		const args = ['tsx', 'node_modules/@momentumcms/migrations/cli/run.cjs', configPath];

		if (options.testOnly) {
			args.push('--test-only');
		}
		if (options.skipCloneTest) {
			args.push('--skip-clone-test');
		}

		context.logger.info('Running pending migrations...');

		try {
			execFileSync('npx', args, { stdio: 'inherit', shell: true });
		} catch (error) {
			context.logger.error('Migration run failed.');
			throw error;
		}

		return _tree;
	};
}
