import { type Rule, type SchematicContext, type Tree } from '@angular-devkit/schematics';
import { execFileSync } from 'node:child_process';
import type { TypesSchema } from './schema';

/**
 * Angular schematic that generates TypeScript types and browser-safe
 * admin config from a momentum.config.ts file.
 *
 * Usage: ng generate @momentumcms/core:types [--configPath=src/momentum.config.ts]
 */
export function generateTypes(options: TypesSchema): Rule {
	return (_tree: Tree, context: SchematicContext) => {
		const configPath = options.configPath || 'src/momentum.config.ts';
		const typesOutput = options.typesOutput || 'src/generated/momentum.types.ts';
		const configOutput = options.configOutput || 'src/generated/momentum.config.ts';

		context.logger.info('Generating Momentum CMS types and admin config...');
		context.logger.info(`  Config: ${configPath}`);
		context.logger.info(`  Types:  ${typesOutput}`);
		context.logger.info(`  Admin:  ${configOutput}`);

		try {
			execFileSync(
				'npx',
				['momentum-generate', configPath, '--types', typesOutput, '--config', configOutput],
				{ stdio: 'inherit', shell: true },
			);
			context.logger.info('Types and admin config generated successfully.');
		} catch (error) {
			context.logger.error('Failed to generate types. Is @momentumcms/core installed?');
			throw error;
		}

		return _tree;
	};
}
