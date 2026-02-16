import prompts from 'prompts';
import pc from 'picocolors';
import { createProject } from './create-project';

export interface CLIOptions {
	projectName: string;
	flavor: 'angular' | 'analog';
	database: 'postgres' | 'sqlite';
	install: boolean;
	registry?: string;
}

function parseArgs(argv: string[]): Partial<CLIOptions> {
	const args = argv.slice(2);
	const opts: Partial<CLIOptions> & { install?: boolean; registry?: string } = {};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === '--flavor' && args[i + 1]) {
			const val = args[++i];
			if (val === 'angular' || val === 'analog') {
				opts.flavor = val;
			}
		} else if (arg === '--database' && args[i + 1]) {
			const val = args[++i];
			if (val === 'postgres' || val === 'sqlite') {
				opts.database = val;
			}
		} else if (arg === '--no-install') {
			opts.install = false;
		} else if (arg === '--registry' && args[i + 1]) {
			opts.registry = args[++i];
		} else if (!arg.startsWith('-') && !opts.projectName) {
			opts.projectName = arg;
		}
	}

	return opts;
}

function isValidProjectName(name: string): boolean {
	return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name);
}

export async function runCLI(): Promise<void> {
	console.log();
	console.log(pc.bold(pc.cyan('  Momentum CMS')));
	console.log(pc.dim('  Create a new Momentum CMS application'));
	console.log();

	const cliArgs = parseArgs(process.argv);

	const response = await prompts(
		[
			{
				type: cliArgs.projectName ? null : 'text',
				name: 'projectName',
				message: 'Project name:',
				initial: 'my-momentum-app',
				validate: (value: string) =>
					isValidProjectName(value)
						? true
						: 'Invalid name. Use letters, numbers, hyphens, underscores.',
			},
			{
				type: cliArgs.flavor ? null : 'select',
				name: 'flavor',
				message: 'Which framework?',
				choices: [
					{ title: 'Angular (Express SSR)', value: 'angular' },
					{ title: 'Analog (Nitro)', value: 'analog' },
				],
			},
			{
				type: cliArgs.database ? null : 'select',
				name: 'database',
				message: 'Which database?',
				choices: [
					{ title: 'PostgreSQL', value: 'postgres' },
					{ title: 'SQLite', value: 'sqlite' },
				],
			},
			{
				type: cliArgs.install !== undefined ? null : 'confirm',
				name: 'install',
				message: 'Install dependencies?',
				initial: true,
			},
		],
		{
			onCancel: () => {
				console.log(pc.red('\nSetup cancelled.'));
				process.exit(1);
			},
		},
	);

	const options: CLIOptions = {
		projectName: cliArgs.projectName ?? response.projectName,
		flavor: cliArgs.flavor ?? response.flavor,
		database: cliArgs.database ?? response.database,
		install: cliArgs.install ?? response.install ?? true,
		registry: cliArgs.registry,
	};

	await createProject(options);
}
