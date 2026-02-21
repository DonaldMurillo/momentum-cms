import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
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

function isDockerInstalled(): boolean {
	try {
		execFileSync('docker', ['--version'], { stdio: 'pipe', timeout: 5000, shell: true });
		return true;
	} catch {
		return false;
	}
}

function isDockerRunning(): boolean {
	try {
		execFileSync('docker', ['info'], { stdio: 'pipe', timeout: 5000, shell: true });
		return true;
	} catch {
		return false;
	}
}

function displayDockerInstallInstructions(): void {
	console.log(pc.yellow('\n⚠️  Docker is not installed.'));
	console.log();
	console.log('To use Docker for PostgreSQL, please install Docker:');
	console.log();

	const platform = process.platform;
	if (platform === 'darwin') {
		console.log(
			'  macOS: Download Docker Desktop from https://www.docker.com/products/docker-desktop/',
		);
	} else if (platform === 'linux') {
		console.log('  Linux: Run the following command:');
		console.log(pc.dim('  curl -fsSL https://get.docker.com | sh'));
		console.log();
		console.log('  Or install via your package manager:');
		console.log(pc.dim('  sudo apt-get install docker.io docker-compose-plugin  # Ubuntu/Debian'));
		console.log(pc.dim('  sudo dnf install docker docker-compose-plugin        # Fedora/RHEL'));
	} else if (platform === 'win32') {
		console.log(
			'  Windows: Download Docker Desktop from https://www.docker.com/products/docker-desktop/',
		);
		console.log('  Note: Requires WSL2. See https://docs.docker.com/desktop/windows/install/');
	} else {
		console.log('  Visit https://docs.docker.com/get-docker/');
	}

	console.log();
	console.log(
		'You can still use an external PostgreSQL instance by updating the DATABASE_URL in .env',
	);
	console.log();
}

function startPostgresContainer(projectDir: string): void {
	try {
		console.log(pc.dim('Starting PostgreSQL container...'));
		execFileSync('docker', ['compose', 'up', '-d'], {
			cwd: projectDir,
			stdio: 'inherit',
			shell: true,
		});
	} catch (error) {
		throw new Error(`Failed to start Docker container: ${error}`);
	}
}

function waitForPostgres(projectDir: string, timeout = 30000): Promise<boolean> {
	return new Promise((resolve) => {
		const startTime = Date.now();
		const interval = 1000;

		const checkHealth = async (): Promise<void> => {
			while (Date.now() - startTime <= timeout) {
				try {
					execFileSync(
						'docker',
						['compose', 'exec', '-T', 'postgres', 'pg_isready', '-U', 'postgres'],
						{
							cwd: projectDir,
							stdio: 'pipe',
							timeout: 5000,
							shell: true,
						},
					);
					resolve(true);
					return;
				} catch {
					// Wait before next check
					await sleep(interval);
				}
			}
			resolve(false);
		};

		void checkHealth();
	});
}

export async function createProject(options: CLIOptions): Promise<void> {
	const { projectName, flavor, database, install, docker, registry } = options;
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
		prerequisitesDocker:
			database === 'postgres'
				? `- **Docker** (for PostgreSQL database)
  - [macOS](https://www.docker.com/products/docker-desktop/)
  - [Linux](https://docs.docker.com/engine/install/)
  - [Windows](https://docs.docker.com/desktop/windows/install/) (requires WSL2)`
				: '',
		databaseSection:
			database === 'postgres'
				? `### PostgreSQL

This project uses PostgreSQL via Docker. The database is configured in \`docker-compose.yml\`.

**Connection Details:**
- Host: \`localhost\`
- Port: \`5432\`
- Database: \`momentum\`
- Username: \`postgres\`
- Password: \`postgres\`

**Docker Commands:**

\`\`\`bash
# Start database
docker compose up -d

# Stop database
docker compose down

# Stop and remove data
docker compose down -v

# View logs
docker compose logs -f postgres
\`\`\`

You can also use an external PostgreSQL instance by updating \`DATABASE_URL\` in \`.env\`.`
				: `### SQLite

This project uses SQLite with the database file at \`./data/momentum.db\`.  
The database is automatically created on first run - no setup required.`,
	};

	console.log();
	console.log(pc.cyan(`Creating ${pc.bold(projectName)} with ${flavor} + ${database}...`));
	console.log();

	fs.ensureDirSync(projectDir);

	// Copy shared files
	copyTemplateDir(path.join(templatesDir, 'shared'), projectDir, vars);

	// Copy flavor-specific files
	copyTemplateDir(path.join(templatesDir, flavor), projectDir, vars);

	// Copy .env.example to .env
	const envExample = path.join(projectDir, '.env.example');
	const envFile = path.join(projectDir, '.env');
	fs.copyFileSync(envExample, envFile);
	console.log(pc.dim('Created .env file'));
	console.log();

	// Remove docker-compose.yml if not using Docker with PostgreSQL
	if (database !== 'postgres' || !docker) {
		const dockerComposePath = path.join(projectDir, 'docker-compose.yml');
		if (fs.existsSync(dockerComposePath)) {
			fs.removeSync(dockerComposePath);
		}
	}

	// Setup Docker for PostgreSQL if requested
	let dockerSetupSuccess = false;
	if (database === 'postgres' && docker) {
		if (!isDockerInstalled()) {
			displayDockerInstallInstructions();
		} else if (!isDockerRunning()) {
			console.log(pc.yellow('\n⚠️  Docker is installed but not running.'));
			console.log();
			console.log('Please start Docker Desktop or run:');
			console.log(pc.dim('  sudo systemctl start docker'));
			console.log();
			console.log('Then run:');
			console.log(pc.dim(`  cd ${projectName} && docker compose up -d`));
			console.log();
		} else {
			try {
				startPostgresContainer(projectDir);
				const ready = await waitForPostgres(projectDir);
				if (ready) {
					console.log(pc.green('✓ PostgreSQL ready at localhost:5432'));
					console.log();
					dockerSetupSuccess = true;
				} else {
					console.log(pc.yellow('⚠️  PostgreSQL container started but not ready yet.'));
					console.log(pc.dim('  Check status: docker compose logs -f'));
					console.log();
				}
			} catch (error) {
				console.log(pc.yellow(`\n⚠️  Failed to start PostgreSQL: ${error}`));
				console.log(pc.dim('  Try manually: cd ' + projectName + ' && docker compose up -d'));
				console.log();
			}
		}
	}

	if (install) {
		console.log(pc.dim('Installing dependencies...'));
		const args = ['install'];
		if (registry) {
			args.push('--registry', registry);
		}
		execFileSync('npm', args, {
			cwd: projectDir,
			stdio: 'inherit',
			shell: true,
		});
		console.log();

		console.log(pc.dim('Generating types and admin config...'));
		try {
			execFileSync('npm', ['run', 'generate'], {
				cwd: projectDir,
				stdio: 'inherit',
				shell: true,
			});
			console.log(pc.green('✓ Types and admin config generated'));
			console.log();
		} catch {
			console.log(pc.yellow('⚠️  Code generation failed. Run `npm run generate` manually.'));
			console.log();
		}
	}

	console.log(pc.green(pc.bold('Done!')));
	console.log();
	console.log('  Next steps:');
	console.log();
	console.log(pc.dim(`  cd ${projectName}`));
	if (!install) {
		console.log(pc.dim('  npm install'));
	}
	if (database === 'postgres' && docker && !dockerSetupSuccess) {
		console.log(pc.dim('  docker compose up -d'));
	}
	console.log(pc.dim('  npm run dev'));
	console.log();
	console.log(pc.dim('  Open http://localhost:' + vars.defaultPort + '/admin'));
	console.log();
	console.log(pc.dim('  Docs: https://github.com/DonaldMurillo/momentum-cms#readme'));
	console.log();
}
