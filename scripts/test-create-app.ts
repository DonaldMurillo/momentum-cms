#!/usr/bin/env npx tsx
/**
 * E2E Test for create-momentum-app
 *
 * Tests the full publish-and-scaffold pipeline:
 * 1. Start local Verdaccio registry on ephemeral port
 * 2. Build all publishable @momentumcms/* packages
 * 3. Publish them to local Verdaccio
 * 4. Build create-momentum-app CLI
 * 5. Run CLI for each flavor (angular + analog) × database (postgres + sqlite)
 * 6. Verify generated projects: files, npm install, tsc --noEmit
 * 7. Cleanup
 *
 * Usage:
 *   npx tsx scripts/test-create-app.ts              # Full test (all flavors)
 *   npx tsx scripts/test-create-app.ts --skip-install # Skip npm install in generated projects
 *   npx tsx scripts/test-create-app.ts --flavor angular # Test only one flavor
 */

import { spawn, execFileSync, ChildProcess } from 'child_process';
import * as net from 'net';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const LOG_PREFIX = '[test-create-app]';
const VERDACCIO_CONFIG = path.join(ROOT_DIR, '.verdaccio', 'config.yml');

// Libraries to publish (order matters - dependencies first)
const PUBLISHABLE_LIBS = [
	'core',
	'logger',
	'plugins-core',
	'plugins-analytics',
	'plugins-otel',
	'db-drizzle',
	'storage',
	'auth',
	'server-core',
	'server-express',
	'server-analog',
	'ui',
	'admin',
];

type Flavor = 'angular' | 'analog';
type Database = 'postgres' | 'sqlite';

interface TestConfig {
	skipInstall: boolean;
	flavor?: Flavor;
	database?: Database;
	verbose: boolean;
}

function parseArgs(): TestConfig {
	const args = process.argv.slice(2);
	const flavorArg = args.find((_, i) => args[i - 1] === '--flavor');
	const dbArg = args.find((_, i) => args[i - 1] === '--database');
	return {
		skipInstall: args.includes('--skip-install'),
		flavor: flavorArg === 'angular' || flavorArg === 'analog' ? flavorArg : undefined,
		database: dbArg === 'postgres' || dbArg === 'sqlite' ? dbArg : undefined,
		verbose: args.includes('--verbose') || args.includes('-v'),
	};
}

/**
 * Find an available port by binding to port 0
 */
async function findFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.once('error', reject);
		server.listen(0, () => {
			const addr = server.address();
			if (addr && typeof addr === 'object') {
				const port = addr.port;
				server.close(() => resolve(port));
			} else {
				server.close(() => reject(new Error('Could not determine port')));
			}
		});
	});
}

/**
 * Start Verdaccio on a given port and wait for it to be ready.
 * Uses shell: true because npx requires shell resolution on all platforms.
 */
function startVerdaccio(port: number, storageDir: string): ChildProcess {
	console.log(`${LOG_PREFIX} Starting Verdaccio on port ${port}...`);

	const proc = spawn(
		'npx',
		['verdaccio', '--config', VERDACCIO_CONFIG, '--listen', `http://0.0.0.0:${port}`],
		{
			cwd: ROOT_DIR,
			env: { ...process.env, VERDACCIO_STORAGE_PATH: storageDir },
			stdio: ['ignore', 'pipe', 'pipe'],
			shell: true,
			detached: true,
		},
	);

	proc.stdout?.on('data', (data: Buffer) => {
		const msg = data.toString().trim();
		if (msg) console.log(`[Verdaccio] ${msg}`);
	});
	proc.stderr?.on('data', (data: Buffer) => {
		const msg = data.toString().trim();
		if (msg) console.error(`[Verdaccio] ${msg}`);
	});

	return proc;
}

/**
 * Wait for Verdaccio to respond
 */
async function waitForVerdaccio(port: number, timeoutMs = 30000): Promise<void> {
	const start = Date.now();
	const url = `http://localhost:${port}/-/ping`;

	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(url);
			if (res.ok) {
				console.log(`${LOG_PREFIX} Verdaccio is ready on port ${port}`);
				return;
			}
		} catch {
			// not ready yet
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	throw new Error(`Verdaccio did not start within ${timeoutMs}ms`);
}

/**
 * Build all publishable packages via Nx
 */
function buildAllPackages(): void {
	console.log(`${LOG_PREFIX} Building all publishable packages...`);
	execFileSync('npx', ['nx', 'run-many', '-t', 'build', '--projects', PUBLISHABLE_LIBS.join(',')], {
		cwd: ROOT_DIR,
		stdio: 'inherit',
	});
}

/**
 * Build the create-momentum-app CLI
 */
function buildCli(): void {
	console.log(`${LOG_PREFIX} Building create-momentum-app CLI...`);
	execFileSync('npx', ['nx', 'build', 'create-momentum-app'], {
		cwd: ROOT_DIR,
		stdio: 'inherit',
	});
}

/**
 * Resolve the dist output path for a library
 */
function resolveDistPath(lib: string): string {
	const pathMap: Record<string, string> = {
		core: 'dist/libs/core',
		logger: 'dist/libs/logger',
		storage: 'dist/libs/storage',
		ui: 'dist/libs/ui',
		admin: 'dist/libs/admin',
		auth: 'dist/libs/auth',
		'db-drizzle': 'dist/libs/db-drizzle',
		'server-core': 'dist/libs/server-core',
		'server-express': 'dist/libs/server-express',
		'server-analog': 'dist/libs/server-analog',
		'plugins-core': 'dist/libs/plugins/core',
		'plugins-analytics': 'dist/libs/plugins/analytics',
		'plugins-otel': 'dist/libs/plugins/otel',
	};
	const rel = pathMap[lib];
	if (!rel) throw new Error(`Unknown lib: ${lib}`);
	return path.join(ROOT_DIR, rel);
}

/**
 * Publish a single library to local registry using execFileSync (safe, no shell injection)
 */
function publishLib(lib: string, registryUrl: string): void {
	const distPath = resolveDistPath(lib);
	if (!fs.existsSync(distPath)) {
		throw new Error(`Dist path not found for ${lib}: ${distPath}`);
	}

	console.log(`${LOG_PREFIX}   Publishing ${lib}...`);
	execFileSync('npm', ['publish', '--registry', registryUrl, '--access', 'public'], {
		cwd: distPath,
		stdio: 'pipe',
	});
}

/**
 * Publish all libraries to local registry
 */
function publishAllLibs(registryUrl: string): void {
	console.log(`${LOG_PREFIX} Publishing all libraries to local Verdaccio...`);
	for (const lib of PUBLISHABLE_LIBS) {
		publishLib(lib, registryUrl);
	}
	console.log(`${LOG_PREFIX} All libraries published successfully.`);
}

/**
 * Run create-momentum-app to scaffold a project using execFileSync (safe, no shell)
 */
function scaffoldProject(
	projectName: string,
	flavor: Flavor,
	database: Database,
	targetDir: string,
	registryUrl: string,
	install: boolean,
): void {
	console.log(`${LOG_PREFIX} Scaffolding ${projectName} (${flavor} + ${database})...`);

	const cliPath = path.join(ROOT_DIR, 'dist', 'apps', 'create-momentum-app', 'index.cjs');
	const args = [
		cliPath,
		projectName,
		'--flavor',
		flavor,
		'--database',
		database,
		'--registry',
		registryUrl,
	];
	if (!install) {
		args.push('--no-install');
	}

	execFileSync('node', args, {
		cwd: targetDir,
		stdio: 'inherit',
	});
}

/**
 * Verify a scaffolded project has the expected structure
 */
function verifyProject(projectDir: string, flavor: Flavor, database: Database): void {
	console.log(`${LOG_PREFIX} Verifying project structure...`);

	const commonFiles = ['package.json', '.env.example', '.gitignore', 'README.md', 'tsconfig.json'];

	const flavorFiles: Record<Flavor, string[]> = {
		angular: [
			'angular.json',
			'src/server.ts',
			'src/momentum.config.ts',
			'src/app/app.ts',
			'src/app/app.config.ts',
			'src/app/app.routes.ts',
			'src/collections/posts.ts',
		],
		analog: [
			'vite.config.ts',
			'src/momentum.config.ts',
			'src/server/middleware/00-init.ts',
			'src/server/routes/api/[...momentum].ts',
			'src/app/app.ts',
			'src/app/app.config.ts',
			'src/collections/posts.ts',
		],
	};

	const requiredFiles = [...commonFiles, ...flavorFiles[flavor]];
	const missing: string[] = [];

	for (const file of requiredFiles) {
		if (!fs.existsSync(path.join(projectDir, file))) {
			missing.push(file);
		}
	}

	if (missing.length > 0) {
		throw new Error(`Missing files in ${flavor} project:\n  ${missing.join('\n  ')}`);
	}

	// Verify package.json has correct @momentum-cms dependencies
	const pkgJson = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
	const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
	const requiredDeps = ['@momentumcms/core', '@momentumcms/db-drizzle', '@momentumcms/auth'];
	const missingDeps: string[] = [];
	for (const dep of requiredDeps) {
		if (!deps[dep]) {
			missingDeps.push(dep);
		}
	}
	if (missingDeps.length > 0) {
		throw new Error(`Missing dependencies in ${flavor} project:\n  ${missingDeps.join('\n  ')}`);
	}

	// Verify .env.example has correct database variable
	const envContent = fs.readFileSync(path.join(projectDir, '.env.example'), 'utf-8');
	if (database === 'postgres' && !envContent.includes('DATABASE_URL=')) {
		throw new Error('PostgreSQL project missing DATABASE_URL in .env.example');
	}
	if (database === 'sqlite' && !envContent.includes('DATABASE_PATH=')) {
		throw new Error('SQLite project missing DATABASE_PATH in .env.example');
	}

	// Verify momentum.config.ts references the correct db adapter
	const configContent = fs.readFileSync(
		path.join(projectDir, 'src', 'momentum.config.ts'),
		'utf-8',
	);
	if (database === 'postgres' && !configContent.includes('postgresAdapter')) {
		throw new Error('PostgreSQL project missing postgresAdapter in momentum.config.ts');
	}
	if (database === 'sqlite' && !configContent.includes('sqliteAdapter')) {
		throw new Error('SQLite project missing sqliteAdapter in momentum.config.ts');
	}

	// Verify no unresolved template variables remain ({{...}} patterns)
	const templateVarRegex = /\{\{[a-zA-Z]+\}\}/;
	const filesToCheck = [
		path.join(projectDir, 'package.json'),
		path.join(projectDir, '.env.example'),
		path.join(projectDir, 'src', 'momentum.config.ts'),
	];

	for (const filePath of filesToCheck) {
		if (!fs.existsSync(filePath)) continue;
		const content = fs.readFileSync(filePath, 'utf-8');
		const match = templateVarRegex.exec(content);
		if (match) {
			throw new Error(
				`Unresolved template variable "${match[0]}" in ${path.relative(projectDir, filePath)}`,
			);
		}
	}

	console.log(`${LOG_PREFIX} Project structure verified: ${flavor} + ${database}`);
}

/**
 * Run npm install in the generated project against local registry
 */
function installDeps(projectDir: string, registryUrl: string): void {
	console.log(`${LOG_PREFIX} Running npm install in ${path.basename(projectDir)}...`);
	execFileSync('npm', ['install', '--registry', registryUrl], {
		cwd: projectDir,
		stdio: 'inherit',
		timeout: 120000,
	});
	console.log(`${LOG_PREFIX} npm install succeeded.`);
}

/**
 * Run tsc --noEmit to verify TypeScript compiles
 */
function verifyTypeScript(projectDir: string): void {
	console.log(`${LOG_PREFIX} Running tsc --noEmit in ${path.basename(projectDir)}...`);
	execFileSync('npx', ['tsc', '--noEmit'], {
		cwd: projectDir,
		stdio: 'inherit',
		timeout: 60000,
	});
	console.log(`${LOG_PREFIX} TypeScript compilation succeeded.`);
}

/**
 * Kill a process and its children
 */
function killProcess(proc: ChildProcess): void {
	if (proc.pid) {
		try {
			// Kill the process group (macOS/Linux)
			process.kill(-proc.pid, 'SIGTERM');
		} catch {
			proc.kill('SIGTERM');
		}
	}
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
	const config = parseArgs();
	let verdaccioProc: ChildProcess | null = null;
	let tempDir: string | null = null;
	let storageDir: string | null = null;
	let exitCode = 0;

	// Default to SQLite only (no external DB dependency) unless specified
	const flavors: Flavor[] = config.flavor ? [config.flavor] : ['angular', 'analog'];
	const databases: Database[] = config.database ? [config.database] : ['sqlite'];

	console.log(`${LOG_PREFIX} Starting create-momentum-app E2E test`);
	console.log(`${LOG_PREFIX} Flavors: ${flavors.join(', ')}`);
	console.log(`${LOG_PREFIX} Databases: ${databases.join(', ')}`);
	console.log(`${LOG_PREFIX} Install deps: ${!config.skipInstall}`);

	// Ensure tmp directory exists
	const tmpBase = path.join(ROOT_DIR, 'tmp');
	if (!fs.existsSync(tmpBase)) {
		fs.mkdirSync(tmpBase, { recursive: true });
	}

	try {
		// 1. Create temp directories
		tempDir = fs.mkdtempSync(path.join(tmpBase, 'create-app-test-'));
		storageDir = fs.mkdtempSync(path.join(tmpBase, 'verdaccio-storage-'));
		console.log(`${LOG_PREFIX} Temp directory: ${tempDir}`);

		// 2. Find free port and start Verdaccio
		const port = await findFreePort();
		verdaccioProc = startVerdaccio(port, storageDir);
		await waitForVerdaccio(port);
		const registryUrl = `http://localhost:${port}`;

		// 3. Build all packages
		buildAllPackages();

		// 4. Build CLI
		buildCli();

		// 5. Run copy-assets for admin and ui (LICENSE + tailwind preset)
		console.log(`${LOG_PREFIX} Running copy-assets targets...`);
		try {
			execFileSync('npx', ['nx', 'run', 'admin:copy-assets'], {
				cwd: ROOT_DIR,
				stdio: 'pipe',
			});
		} catch {
			// target may not exist; continue
		}
		try {
			execFileSync('npx', ['nx', 'run', 'ui:copy-assets'], {
				cwd: ROOT_DIR,
				stdio: 'pipe',
			});
		} catch {
			// target may not exist; continue
		}

		// 6. Publish all libs to local Verdaccio
		publishAllLibs(registryUrl);

		// 7. Test each flavor × database combination
		for (const flavor of flavors) {
			for (const database of databases) {
				const projectName = `test-${flavor}-${database}`;
				const projectDir = path.join(tempDir, projectName);

				try {
					// Scaffold the project (with or without install based on config)
					scaffoldProject(projectName, flavor, database, tempDir, registryUrl, !config.skipInstall);

					// Verify file structure and template interpolation
					verifyProject(projectDir, flavor, database);

					// If CLI didn't install, install now for TypeScript verification
					if (config.skipInstall) {
						installDeps(projectDir, registryUrl);
					}

					// Verify TypeScript compiles
					verifyTypeScript(projectDir);

					console.log(`${LOG_PREFIX} PASS: ${flavor} + ${database}\n`);
				} catch (error) {
					console.error(`${LOG_PREFIX} FAIL: ${flavor} + ${database}`);
					console.error(error);
					exitCode = 1;
				}
			}
		}

		if (exitCode === 0) {
			console.log(`${LOG_PREFIX} All tests passed!`);
		} else {
			console.error(`${LOG_PREFIX} Some tests failed.`);
		}
	} catch (error) {
		console.error(`${LOG_PREFIX} Fatal error:`, error);
		exitCode = 1;
	} finally {
		if (verdaccioProc) {
			console.log(`${LOG_PREFIX} Stopping Verdaccio...`);
			killProcess(verdaccioProc);
		}

		if (tempDir && fs.existsSync(tempDir)) {
			console.log(`${LOG_PREFIX} Cleaning up temp directory...`);
			fs.rmSync(tempDir, { recursive: true, force: true });
		}

		if (storageDir && fs.existsSync(storageDir)) {
			fs.rmSync(storageDir, { recursive: true, force: true });
		}
	}

	process.exit(exitCode);
}

main();
