import path from 'node:path';
import { execFileSync } from 'node:child_process';
import fs from 'fs-extra';
import pc from 'picocolors';
import type { CLIOptions } from './cli';

const TEMPLATE_EXT = '.tmpl';

function getTemplatesDir(): string {
	return path.resolve(__dirname, 'templates');
}

function interpolate(content: string, vars: Record<string, string>): string {
	let result = content;
	for (const [key, value] of Object.entries(vars)) {
		result = result.replaceAll(`{{${key}}}`, value);
	}
	return result;
}

function copyTemplateDir(srcDir: string, destDir: string, vars: Record<string, string>): void {
	const entries = fs.readdirSync(srcDir, { withFileTypes: true });

	for (const entry of entries) {
		const srcPath = path.join(srcDir, entry.name);
		let destName = entry.name;

		if (entry.isDirectory()) {
			const destPath = path.join(destDir, destName);
			fs.ensureDirSync(destPath);
			copyTemplateDir(srcPath, destPath, vars);
			continue;
		}

		const isTemplate = destName.endsWith(TEMPLATE_EXT);
		if (isTemplate) {
			destName = destName.slice(0, -TEMPLATE_EXT.length);
		}

		const destPath = path.join(destDir, destName);

		if (isTemplate) {
			const content = fs.readFileSync(srcPath, 'utf-8');
			fs.writeFileSync(destPath, interpolate(content, vars), 'utf-8');
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

export async function createProject(options: CLIOptions): Promise<void> {
	const { projectName, flavor, database, install, registry } = options;
	const projectDir = path.resolve(process.cwd(), projectName);

	if (fs.existsSync(projectDir)) {
		console.error(pc.red(`\nDirectory "${projectName}" already exists.`));
		process.exit(1);
	}

	const templatesDir = getTemplatesDir();
	const pkgJson = fs.readJsonSync(path.resolve(__dirname, 'package.json'));
	const packageVersion: string = pkgJson.version ?? '0.0.1';

	const vars: Record<string, string> = {
		projectName,
		packageVersion,
		databaseType: database,
		dbImport:
			database === 'postgres'
				? "import { postgresAdapter } from '@momentumcms/db-drizzle';"
				: "import { sqliteAdapter } from '@momentumcms/db-drizzle';",
		dbAdapter:
			database === 'postgres'
				? `postgresAdapter({\n\t\tconnectionString: process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/momentum',\n\t})`
				: `sqliteAdapter({\n\t\tfilename: process.env['DATABASE_PATH'] ?? './data/momentum.db',\n\t})`,
		dbPoolSetup:
			database === 'postgres'
				? `import type { PostgresAdapterWithRaw } from '@momentumcms/db-drizzle';

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- PostgresAdapter implements PostgresAdapterWithRaw
const pool = (dbAdapter as PostgresAdapterWithRaw).getPool();`
				: '',
		authDbConfig:
			database === 'postgres'
				? "db: { type: 'postgres', pool },"
				: "db: { type: 'sqlite', database: dbAdapter.getRawDatabase() },",
		dbPackage: database === 'postgres' ? '"pg": "^8.18.0"' : '"better-sqlite3": "^12.6.0"',
		dbDevPackage: database === 'postgres' ? '' : '"@types/better-sqlite3": "^7.6.13",',
		envDbVar:
			database === 'postgres'
				? 'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/momentum'
				: 'DATABASE_PATH=./data/momentum.db',
		defaultPort: '4200',
		externalDependencies: database === 'postgres' ? '"pg", "pg-native"' : '"better-sqlite3"',
	};

	console.log();
	console.log(pc.cyan(`Creating ${pc.bold(projectName)} with ${flavor} + ${database}...`));
	console.log();

	fs.ensureDirSync(projectDir);

	// Copy shared files
	copyTemplateDir(path.join(templatesDir, 'shared'), projectDir, vars);

	// Copy flavor-specific files
	copyTemplateDir(path.join(templatesDir, flavor), projectDir, vars);

	if (install) {
		console.log(pc.dim('Installing dependencies...'));
		const args = ['install'];
		if (registry) {
			args.push('--registry', registry);
		}
		execFileSync('npm', args, {
			cwd: projectDir,
			stdio: 'inherit',
		});
		console.log();
	}

	console.log(pc.green(pc.bold('Done!')));
	console.log();
	console.log('  Next steps:');
	console.log();
	console.log(pc.dim(`  cd ${projectName}`));
	if (!install) {
		console.log(pc.dim('  npm install'));
	}
	console.log(pc.dim('  npm run dev'));
	console.log();
	console.log(pc.dim('  Open http://localhost:' + vars.defaultPort + '/admin'));
	console.log();
}
