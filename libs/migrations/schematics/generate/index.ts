import { type Rule, type SchematicContext, type Tree } from '@angular-devkit/schematics';
import { execFileSync } from 'node:child_process';
import type { MigrationGenerateSchema } from './schema';

/**
 * Angular schematic that generates a new migration file by diffing
 * the current collection schema against the last snapshot.
 *
 * Usage: ng generate @momentumcms/migrations:generate [--name=add-posts]
 */
export function migrationGenerate(options: MigrationGenerateSchema): Rule {
	return (_tree: Tree, context: SchematicContext) => {
		const configPath = options.configPath || 'src/momentum.config.ts';
		const args = ['tsx', 'node_modules/@momentumcms/migrations/cli/generate.cjs', configPath];

		if (options.name) {
			args.push('--name', options.name);
		}
		if (options.dryRun) {
			args.push('--dry-run');
		}

		context.logger.info(`Generating migration from ${configPath}...`);

		try {
			execFileSync('npx', args, { stdio: 'inherit', shell: true });
		} catch (error) {
			context.logger.error('Migration generation failed.');
			throw error;
		}

		return _tree;
	};
}
