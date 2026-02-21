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
 * 6. Verify generated projects: files, npm install
 * 7. Start dev server briefly to verify dependency optimization (catches missing peer deps)
 * 8. Run tsc --noEmit
 * 9. Build the generated project (ng build / vite build)
 * 10. Start production server and verify health + SSR endpoints (SQLite only)
 * 9. Cleanup
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
import { chromium, type Browser } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const LOG_PREFIX = '[test-create-app]';

// Libraries to publish (order matters - dependencies first)
const PUBLISHABLE_LIBS = [
	'core',
	'logger',
	'migrations',
	'plugins-core',
	'plugins-analytics',
	'plugins-otel',
	'plugins-seo',
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
 * Create a temporary Verdaccio config file that uses the given storage directory.
 * This ensures each test run gets a fresh, isolated registry.
 */
function createVerdaccioConfig(storageDir: string, configDir: string): string {
	const configPath = path.join(configDir, 'verdaccio-config.yml');
	const content = `storage: ${storageDir}
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
    maxage: 60m
packages:
  '@momentumcms/*':
    access: $all
    publish: $all
    unpublish: $all
  'create-momentum-app':
    access: $all
    publish: $all
    unpublish: $all
  '**':
    access: $all
    publish: $all
    unpublish: $all
    proxy: npmjs
log:
  type: stdout
  format: pretty
  level: warn
publish:
  allow_offline: true
`;
	fs.writeFileSync(configPath, content);
	return configPath;
}

/**
 * Start Verdaccio on a given port and wait for it to be ready.
 * Uses shell: true because npx requires shell resolution on all platforms.
 */
function startVerdaccio(port: number, configPath: string): ChildProcess {
	console.log(`${LOG_PREFIX} Starting Verdaccio on port ${port}...`);

	const proc = spawn(
		'npx',
		['verdaccio', '--config', configPath, '--listen', `http://0.0.0.0:${port}`],
		{
			cwd: ROOT_DIR,
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
		'plugins-seo': 'dist/libs/plugins/seo',
		migrations: 'dist/libs/migrations',
	};
	const rel = pathMap[lib];
	if (!rel) throw new Error(`Unknown lib: ${lib}`);
	return path.join(ROOT_DIR, rel);
}

/**
 * Create a temporary .npmrc file that routes @momentumcms packages to local Verdaccio
 * while letting all other packages resolve from the real npm registry.
 * Also includes a fake auth token required by Verdaccio for publishing.
 */
function createLocalNpmrc(port: number, dir: string): string {
	const npmrcPath = path.join(dir, '.npmrc');
	const content = [
		`@momentumcms:registry=http://localhost:${port}`,
		`//localhost:${port}/:_authToken=test-token`,
		'',
	].join('\n');
	fs.writeFileSync(npmrcPath, content);
	return npmrcPath;
}

/**
 * Publish a single library to local registry using execFileSync (safe, no shell injection)
 */
function publishLib(lib: string, registryUrl: string, npmrcPath: string): void {
	const distPath = resolveDistPath(lib);
	if (!fs.existsSync(distPath)) {
		throw new Error(`Dist path not found for ${lib}: ${distPath}`);
	}

	console.log(`${LOG_PREFIX}   Publishing ${lib}...`);
	execFileSync(
		'npm',
		['publish', '--registry', registryUrl, '--access', 'public', '--userconfig', npmrcPath],
		{
			cwd: distPath,
			stdio: 'pipe',
		},
	);
}

const TEST_VERSION = '0.0.1-test.0';

/**
 * Normalize all dist package.json versions to a consistent test version.
 * This is necessary because nx release may have updated some dist versions
 * while others remain at source version, causing semver range mismatches.
 */
function normalizeDistVersions(): void {
	console.log(`${LOG_PREFIX} Normalizing dist package versions to ${TEST_VERSION}...`);

	// Normalize all lib dist packages
	for (const lib of PUBLISHABLE_LIBS) {
		const distPath = resolveDistPath(lib);
		const pkgPath = path.join(distPath, 'package.json');
		if (!fs.existsSync(pkgPath)) continue;

		const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
		pkg.version = TEST_VERSION;

		// Also update any @momentumcms/* dependency versions to match
		for (const depType of ['dependencies', 'peerDependencies', 'devDependencies'] as const) {
			const deps = pkg[depType];
			if (!deps) continue;
			for (const [name, version] of Object.entries(deps)) {
				if (name.startsWith('@momentumcms/') && typeof version === 'string') {
					deps[name] = TEST_VERSION;
				}
			}
		}

		fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
	}

	// Normalize the CLI dist package
	const cliDistPkg = path.join(ROOT_DIR, 'dist', 'apps', 'create-momentum-app', 'package.json');
	if (fs.existsSync(cliDistPkg)) {
		const pkg = JSON.parse(fs.readFileSync(cliDistPkg, 'utf-8'));
		pkg.version = TEST_VERSION;
		fs.writeFileSync(cliDistPkg, JSON.stringify(pkg, null, 2) + '\n');
	}
}

/**
 * Publish all libraries to local registry
 */
function publishAllLibs(registryUrl: string, npmrcPath: string): void {
	console.log(`${LOG_PREFIX} Publishing all libraries to local Verdaccio...`);
	for (const lib of PUBLISHABLE_LIBS) {
		publishLib(lib, registryUrl, npmrcPath);
	}
	console.log(`${LOG_PREFIX} All libraries published successfully.`);
}

/**
 * Run create-momentum-app to scaffold a project using execFileSync (safe, no shell).
 * Always scaffolds without install — install is handled separately via installDeps.
 */
function scaffoldProject(
	projectName: string,
	flavor: Flavor,
	database: Database,
	targetDir: string,
): void {
	console.log(`${LOG_PREFIX} Scaffolding ${projectName} (${flavor} + ${database})...`);

	const cliPath = path.join(ROOT_DIR, 'dist', 'apps', 'create-momentum-app', 'index.cjs');
	const args = [cliPath, projectName, '--flavor', flavor, '--database', database, '--no-install'];

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
			'src/app/app.config.server.ts',
			'src/app/app.routes.ts',
			'src/app/app.routes.server.ts',
			'src/app/pages/welcome.ts',
			'src/app/pages/posts.ts',
			'src/app/pages/post-detail.ts',
			'src/app/pages/post-detail.resolver.ts',
			'src/app/pages/post-block-providers.ts',
			'src/app/pages/blocks/hero-block.component.ts',
			'src/app/pages/blocks/text-block.component.ts',
			'src/app/pages/blocks/image-text-block.component.ts',
			'src/main.server.ts',
			'src/collections/posts.collection.ts',
		],
		analog: [
			'vite.config.ts',
			'src/momentum.config.ts',
			'src/server/middleware/00-init.ts',
			'src/server/routes/api/[...momentum].ts',
			'src/app/app.ts',
			'src/app/app.config.ts',
			'src/app/pages/posts.page.ts',
			'src/app/pages/post-block-providers.ts',
			'src/app/pages/blocks/hero-block.component.ts',
			'src/collections/posts.collection.ts',
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
 * Run npm install in the generated project against local registry.
 * Writes a .npmrc in the project directory that routes @momentumcms packages
 * to local Verdaccio while all other packages use the real npm registry.
 */
function installDeps(projectDir: string, port: number): void {
	console.log(`${LOG_PREFIX} Running npm install in ${path.basename(projectDir)}...`);

	// Write project-level .npmrc to route scoped packages to Verdaccio
	const projectNpmrc = path.join(projectDir, '.npmrc');
	fs.writeFileSync(
		projectNpmrc,
		`@momentumcms:registry=http://localhost:${port}\n//localhost:${port}/:_authToken=test-token\n`,
	);

	execFileSync('npm', ['install'], {
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
 * Start the dev server briefly to verify esbuild dependency optimization passes.
 * This catches missing peer dependencies (like @angular/aria) that production
 * builds miss because they only bundle actually-imported code, while the dev
 * server eagerly pre-bundles ALL packages in node_modules.
 */
async function verifyDevServer(projectDir: string, flavor: Flavor): Promise<void> {
	console.log(`${LOG_PREFIX} Starting dev server to verify dependency optimization...`);

	const port = await findFreePort();
	const cmd = flavor === 'angular' ? 'npx' : 'npx';
	const args =
		flavor === 'angular'
			? ['ng', 'serve', '--port', String(port)]
			: ['vite', '--port', String(port)];

	const proc = spawn(cmd, args, {
		cwd: projectDir,
		stdio: ['ignore', 'pipe', 'pipe'],
		shell: true,
		detached: true,
		env: { ...process.env, NODE_ENV: 'development' },
	});

	let output = '';
	proc.stdout?.on('data', (data: Buffer) => {
		output += data.toString();
	});
	proc.stderr?.on('data', (data: Buffer) => {
		output += data.toString();
	});

	try {
		const timeoutMs = 60000;
		const start = Date.now();

		await new Promise<void>((resolve, reject) => {
			const checkInterval = setInterval(() => {
				// Check for successful compilation indicators
				if (
					output.includes('Application bundle generation complete') ||
					output.includes('Local:') ||
					output.includes('ready in')
				) {
					clearInterval(checkInterval);
					resolve();
				}
				// Check for esbuild errors (missing dependencies)
				if (output.includes('Could not resolve') || output.includes('ERROR')) {
					clearInterval(checkInterval);
					reject(new Error(`Dev server dependency optimization failed:\n${output}`));
				}
				if (Date.now() - start > timeoutMs) {
					clearInterval(checkInterval);
					reject(new Error(`Dev server did not start within ${timeoutMs}ms:\n${output}`));
				}
			}, 500);
		});

		console.log(`${LOG_PREFIX} Dev server started successfully (dependency optimization passed).`);
	} finally {
		killProcess(proc);
		// Give it a moment to shut down
		await new Promise((r) => setTimeout(r, 1000));
	}
}

/**
 * Run `npm run generate` and verify both output files are created
 * with expected content (types + admin config).
 */
function verifyGenerateTypes(projectDir: string): void {
	console.log(`${LOG_PREFIX} Running npm run generate...`);
	execFileSync('npm', ['run', 'generate'], {
		cwd: projectDir,
		stdio: 'inherit',
		timeout: 30000,
		shell: true,
	});

	const typesPath = path.join(projectDir, 'src', 'generated', 'momentum.types.ts');
	if (!fs.existsSync(typesPath)) {
		throw new Error(`generate did not create types file: ${typesPath}`);
	}

	const typesContent = fs.readFileSync(typesPath, 'utf-8');
	if (!typesContent.includes('CollectionSlug')) {
		throw new Error(
			'generate types output does not contain expected "CollectionSlug" type.\n' +
				`Content:\n${typesContent.substring(0, 500)}`,
		);
	}

	const configPath = path.join(projectDir, 'src', 'generated', 'momentum.config.ts');
	if (!fs.existsSync(configPath)) {
		throw new Error(`generate did not create admin config file: ${configPath}`);
	}

	const configContent = fs.readFileSync(configPath, 'utf-8');
	if (!configContent.includes('adminConfig')) {
		throw new Error(
			'generate admin config does not contain expected "adminConfig" export.\n' +
				`Content:\n${configContent.substring(0, 500)}`,
		);
	}
	if (!configContent.includes('MomentumAdminConfig')) {
		throw new Error(
			'generate admin config does not contain expected "MomentumAdminConfig" type.\n' +
				`Content:\n${configContent.substring(0, 500)}`,
		);
	}
	// Verify collections are inlined (not imported from user files)
	// Prettier may format with single or double quotes depending on project config
	if (!configContent.includes("slug: 'posts'") && !configContent.includes('slug: "posts"')) {
		throw new Error(
			'generate admin config does not contain inlined Posts collection.\n' +
				`Content:\n${configContent.substring(0, 1000)}`,
		);
	}

	console.log(`${LOG_PREFIX} generate verified: ${typesPath}, ${configPath}`);
}

/**
 * Build the scaffolded project using its own build script.
 * Angular: ng build, Analog: analog build
 */
function buildProject(projectDir: string): void {
	console.log(`${LOG_PREFIX} Running npm run build in ${path.basename(projectDir)}...`);
	execFileSync('npm', ['run', 'build'], {
		cwd: projectDir,
		stdio: 'inherit',
		timeout: 300000, // 5 min — Angular SSR builds can be slow
	});
	console.log(`${LOG_PREFIX} Build succeeded.`);
}

/**
 * Start the built server and verify health + admin endpoints respond.
 * Only runs for SQLite projects (postgres needs an external DB).
 */
async function startAndVerifyServer(
	projectDir: string,
	flavor: Flavor,
	projectName: string,
	database: Database,
): Promise<void> {
	if (database !== 'sqlite') {
		console.log(
			`${LOG_PREFIX} Skipping server verification for ${database} (requires external DB)`,
		);
		return;
	}

	const port = await findFreePort();

	// Determine the server entry point based on flavor
	const serverEntry =
		flavor === 'angular'
			? path.join(projectDir, 'dist', projectName, 'server', 'server.mjs')
			: path.join(projectDir, 'dist', 'analog', 'server', 'index.mjs');

	if (!fs.existsSync(serverEntry)) {
		throw new Error(`Server entry not found: ${serverEntry}`);
	}

	// Ensure data directory exists for SQLite
	fs.mkdirSync(path.join(projectDir, 'data'), { recursive: true });

	console.log(`${LOG_PREFIX} Starting server on port ${port}...`);

	const serverProc = spawn('node', [serverEntry], {
		cwd: projectDir,
		env: {
			...process.env,
			PORT: String(port),
			DATABASE_PATH: path.join(projectDir, 'data', 'test.db'),
			BETTER_AUTH_URL: `http://localhost:${port}`,
			NODE_ENV: 'production',
		},
		stdio: ['ignore', 'pipe', 'pipe'],
		detached: true,
	});

	let serverOutput = '';
	serverProc.stdout?.on('data', (data: Buffer) => {
		const msg = data.toString();
		serverOutput += msg;
		if (msg.trim()) console.log(`[server] ${msg.trim()}`);
	});
	serverProc.stderr?.on('data', (data: Buffer) => {
		const msg = data.toString();
		serverOutput += msg;
		if (msg.trim()) console.error(`[server] ${msg.trim()}`);
	});

	try {
		// Wait for server to become ready via health endpoint
		const healthUrl = `http://localhost:${port}/api/health`;
		const start = Date.now();
		const timeoutMs = 30000;
		let ready = false;

		while (Date.now() - start < timeoutMs) {
			try {
				const res = await fetch(healthUrl);
				if (res.ok) {
					ready = true;
					break;
				}
			} catch {
				// not ready yet
			}
			await new Promise((r) => setTimeout(r, 500));
		}

		if (!ready) {
			console.error(`Server output:\n${serverOutput}`);
			throw new Error(`Server did not become ready within ${timeoutMs}ms`);
		}

		console.log(`${LOG_PREFIX} Server health check passed on port ${port}`);

		// Verify SSR returns HTML at root and /admin renders admin content.
		// Analog SSR has a known JIT compilation issue with Nitro, so only
		// enforce SSR page checks for Angular. Health endpoint already verified above.
		if (flavor === 'angular') {
			const rootRes = await fetch(`http://localhost:${port}/`);
			if (!rootRes.ok) {
				throw new Error(`/ returned status ${rootRes.status}`);
			}
			const html = await rootRes.text();
			if (!html.includes('Welcome to Momentum CMS')) {
				throw new Error(
					'/ did not return landing page content. First 500 chars:\n' + html.substring(0, 500),
				);
			}
			console.log(`${LOG_PREFIX} SSR serves landing page correctly at /.`);

			// Verify /admin returns HTML (client-rendered SPA shell)
			// Admin routes use RenderMode.Client, so SSR returns an HTML shell
			// with <app-root> and script tags — actual UI renders client-side.
			const adminRes = await fetch(`http://localhost:${port}/admin`, { redirect: 'follow' });
			if (!adminRes.ok) {
				throw new Error(`/admin returned status ${adminRes.status}`);
			}
			const adminHtml = await adminRes.text();
			if (!adminHtml.includes('<app-root')) {
				throw new Error(
					'/admin did not return HTML with app-root. First 500 chars:\n' +
						adminHtml.substring(0, 500),
				);
			}
			console.log(`${LOG_PREFIX} Admin SPA shell served correctly at /admin.`);

			// Run Playwright browser tests (full user flow)
			await runPlaywrightTests(port);
		} else {
			console.log(`${LOG_PREFIX} Skipping SSR page checks for ${flavor} (known Nitro JIT issue).`);
		}
	} finally {
		killProcess(serverProc);
	}
}

/**
 * Run Playwright browser tests against a running server.
 * Tests the full user flow: setup redirect → create admin → login → admin portal.
 */
async function runPlaywrightTests(port: number): Promise<void> {
	console.log(`${LOG_PREFIX} Running Playwright browser tests...`);

	const browser: Browser = await chromium.launch({ headless: true });
	const baseUrl = `http://localhost:${port}`;

	try {
		// --- Test 1: Landing page loads at / ---
		console.log(`${LOG_PREFIX}   [Playwright] Test 1: Landing page at /`);
		const landingPage = await browser.newPage();
		await landingPage.goto(baseUrl);
		await landingPage.waitForLoadState('networkidle');
		const heading = landingPage.getByRole('heading', { name: /welcome to momentum cms/i });
		await heading.waitFor({ state: 'visible', timeout: 10000 });
		console.log(`${LOG_PREFIX}   [Playwright] Landing page renders correctly.`);
		await landingPage.close();

		// --- Test 2: /admin redirects to /admin/setup (no users in DB) ---
		console.log(`${LOG_PREFIX}   [Playwright] Test 2: Admin redirect to setup`);
		const setupPage = await browser.newPage();
		await setupPage.goto(`${baseUrl}/admin`);
		await setupPage.waitForURL(/\/admin\/setup/, { timeout: 15000 });
		const setupHeading = setupPage.getByRole('heading', { name: /welcome to momentum cms/i });
		await setupHeading.waitFor({ state: 'visible', timeout: 10000 });
		console.log(`${LOG_PREFIX}   [Playwright] Redirected to /admin/setup correctly.`);

		// --- Test 3: Create admin account via setup form ---
		console.log(`${LOG_PREFIX}   [Playwright] Test 3: Create admin account`);
		// Use input[name=...] selectors because mcms-input wraps a native input —
		// placeholder selectors resolve to 2 elements (component host + inner input).
		await setupPage.locator('input[name="name"]').fill('Test Admin');
		await setupPage.locator('input[name="email"]').fill('admin@test.com');
		await setupPage.locator('input[name="password"]').fill('testpass123');
		await setupPage.locator('input[name="confirmPassword"]').fill('testpass123');
		await setupPage.getByRole('button', { name: /create admin account/i }).click();

		// After creating admin, should redirect to /admin (dashboard)
		await setupPage.waitForURL(/\/admin(?!\/setup|\/login)/, { timeout: 15000 });
		console.log(`${LOG_PREFIX}   [Playwright] Admin account created, redirected to dashboard.`);

		// --- Test 4: Verify admin dashboard content ---
		console.log(`${LOG_PREFIX}   [Playwright] Test 4: Verify admin dashboard`);
		const dashboardHeading = setupPage.getByRole('heading', { name: /dashboard/i });
		await dashboardHeading.waitFor({ state: 'visible', timeout: 10000 });
		// Verify sidebar has Posts collection link
		const postsLink = setupPage.getByRole('link', { name: /posts/i });
		await postsLink.waitFor({ state: 'visible', timeout: 5000 });
		console.log(`${LOG_PREFIX}   [Playwright] Dashboard loaded with Posts in sidebar.`);
		await setupPage.close();

		// --- Test 5: Login flow with existing user ---
		console.log(`${LOG_PREFIX}   [Playwright] Test 5: Login with existing user`);
		const loginPage = await browser.newPage();
		await loginPage.goto(`${baseUrl}/admin/login`);
		await loginPage.waitForLoadState('networkidle');
		await loginPage.locator('input[name="email"]').fill('admin@test.com');
		await loginPage.locator('input[name="password"]').fill('testpass123');
		await loginPage.getByRole('button', { name: /sign in/i }).click();
		await loginPage.waitForURL(/\/admin(?!\/login|\/setup)/, { timeout: 15000 });
		console.log(`${LOG_PREFIX}   [Playwright] Login succeeded, redirected to dashboard.`);
		await loginPage.close();

		// --- Test 6: Create a post via REST API ---
		console.log(`${LOG_PREFIX}   [Playwright] Test 6: Create post via API`);
		const apiContext = await browser.newPage();
		// Login first to get auth cookies
		await apiContext.goto(`${baseUrl}/admin/login`);
		await apiContext.waitForLoadState('networkidle');
		await apiContext.locator('input[name="email"]').fill('admin@test.com');
		await apiContext.locator('input[name="password"]').fill('testpass123');
		await apiContext.getByRole('button', { name: /sign in/i }).click();
		await apiContext.waitForURL(/\/admin(?!\/login|\/setup)/, { timeout: 15000 });

		// Create post with blocks via the API
		const createRes = await apiContext.evaluate(async (url: string) => {
			const res = await fetch(`${url}/api/posts`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: 'Hello World Post',
					slug: 'hello-world-post',
					pageContent: [
						{
							blockType: 'hero',
							heading: 'Welcome Hero',
							subheading: 'This is the hero subheading',
							ctaText: 'Read More',
							ctaLink: '/posts',
						},
						{
							blockType: 'textBlock',
							heading: 'Text Section',
							body: 'This is the body of the text block with some content.',
						},
						{
							blockType: 'imageText',
							heading: 'Image Text Heading',
							body: 'Image text body content.',
							imageUrl: 'https://placehold.co/400x300',
							imageAlt: 'Placeholder image',
							imagePosition: 'left',
						},
					],
				}),
			});
			return { status: res.status, ok: res.ok };
		}, baseUrl);
		if (!createRes.ok) {
			throw new Error(`Failed to create post via API: status ${createRes.status}`);
		}
		console.log(`${LOG_PREFIX}   [Playwright] Post created via API (status ${createRes.status}).`);
		await apiContext.close();

		// --- Test 7: Posts listing page at /posts ---
		console.log(`${LOG_PREFIX}   [Playwright] Test 7: Posts listing page`);
		const postsPage = await browser.newPage();
		await postsPage.goto(`${baseUrl}/posts`);
		await postsPage.waitForLoadState('networkidle');

		const postsTitle = postsPage.locator('[data-testid="posts-title"]');
		await postsTitle.waitFor({ state: 'visible', timeout: 10000 });

		// Wait for posts to load (grid appears)
		const postsGrid = postsPage.locator('[data-testid="posts-grid"]');
		await postsGrid.waitFor({ state: 'visible', timeout: 10000 });

		// Verify at least one post card is rendered
		const postCards = postsPage.locator('[data-testid="post-card"]');
		const cardCount = await postCards.count();
		if (cardCount < 1) {
			throw new Error(`Expected at least 1 post card, found ${cardCount}`);
		}

		// Verify the post title is visible
		const firstPostTitle = postsPage.locator('[data-testid="post-title"]').first();
		await firstPostTitle.waitFor({ state: 'visible', timeout: 5000 });
		const titleText = await firstPostTitle.textContent();
		if (!titleText?.includes('Hello World Post')) {
			throw new Error(`Expected post title "Hello World Post", got "${titleText}"`);
		}
		console.log(`${LOG_PREFIX}   [Playwright] Posts listing renders ${cardCount} post(s).`);

		// --- Test 8: Search filters posts ---
		console.log(`${LOG_PREFIX}   [Playwright] Test 8: Search filters posts`);
		const searchInput = postsPage.locator('[data-testid="posts-search"]');
		await searchInput.fill('nonexistent-query-xyz');
		// Wait for the empty state to appear
		const postsEmpty = postsPage.locator('[data-testid="posts-empty"]');
		await postsEmpty.waitFor({ state: 'visible', timeout: 5000 });
		console.log(`${LOG_PREFIX}   [Playwright] Search filters: empty state shown for no results.`);

		// Clear search and verify posts come back
		await searchInput.clear();
		await postsGrid.waitFor({ state: 'visible', timeout: 5000 });
		console.log(`${LOG_PREFIX}   [Playwright] Search clear: posts grid restored.`);
		await postsPage.close();

		// --- Test 9: Post detail page with blocks ---
		console.log(`${LOG_PREFIX}   [Playwright] Test 9: Post detail page with blocks`);
		const detailPage = await browser.newPage();
		await detailPage.goto(`${baseUrl}/posts/hello-world-post`);
		await detailPage.waitForLoadState('networkidle');

		// Verify post detail renders
		const postDetail = detailPage.locator('[data-testid="post-detail"]');
		await postDetail.waitFor({ state: 'visible', timeout: 10000 });

		// Verify title
		const detailTitle = detailPage.locator('[data-testid="post-detail-title"]');
		await detailTitle.waitFor({ state: 'visible', timeout: 5000 });
		const detailTitleText = await detailTitle.textContent();
		if (!detailTitleText?.includes('Hello World Post')) {
			throw new Error(`Expected detail title "Hello World Post", got "${detailTitleText}"`);
		}

		// Verify blocks container is rendered
		const blocksContainer = detailPage.locator('[data-testid="post-blocks"]');
		await blocksContainer.waitFor({ state: 'visible', timeout: 5000 });

		// Verify back link
		const backLink = detailPage.locator('[data-testid="post-back-link"]');
		await backLink.waitFor({ state: 'visible', timeout: 5000 });

		console.log(`${LOG_PREFIX}   [Playwright] Post detail page renders with title and blocks.`);
		await detailPage.close();

		// --- Test 10: Non-existent post shows error state ---
		console.log(`${LOG_PREFIX}   [Playwright] Test 10: Non-existent post error state`);
		const errorPage = await browser.newPage();
		await errorPage.goto(`${baseUrl}/posts/does-not-exist-slug`);
		await errorPage.waitForLoadState('networkidle');

		const postError = errorPage.locator('[data-testid="post-error"]');
		await postError.waitFor({ state: 'visible', timeout: 10000 });
		console.log(`${LOG_PREFIX}   [Playwright] Non-existent post shows error state.`);
		await errorPage.close();

		console.log(`${LOG_PREFIX} All Playwright browser tests passed!`);
	} finally {
		await browser.close();
	}
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

		// 2. Find free port and start Verdaccio with isolated config
		const port = await findFreePort();
		const verdaccioConfigPath = createVerdaccioConfig(storageDir, tempDir);
		verdaccioProc = startVerdaccio(port, verdaccioConfigPath);
		await waitForVerdaccio(port);
		const registryUrl = `http://localhost:${port}`;

		// 2b. Create .npmrc with fake auth token for local Verdaccio
		const npmrcPath = createLocalNpmrc(port, tempDir);
		console.log(`${LOG_PREFIX} Created local .npmrc at ${npmrcPath}`);

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

		// 6. Normalize versions and publish all libs to local Verdaccio
		normalizeDistVersions();
		publishAllLibs(registryUrl, npmrcPath);

		// 7. Test each flavor × database combination
		for (const flavor of flavors) {
			for (const database of databases) {
				const projectName = `test-${flavor}-${database}`;
				const projectDir = path.join(tempDir, projectName);

				try {
					// Scaffold the project (always without install — we handle it)
					scaffoldProject(projectName, flavor, database, tempDir);

					// Verify file structure and template interpolation
					verifyProject(projectDir, flavor, database);

					// Install dependencies (routes @momentumcms to Verdaccio, rest to npm)
					if (!config.skipInstall) {
						installDeps(projectDir, port);

						// Verify type generator works
						verifyGenerateTypes(projectDir);

						// Verify dev server starts (catches missing peer deps)
						await verifyDevServer(projectDir, flavor);

						// Verify TypeScript compiles
						verifyTypeScript(projectDir);

						// Build the project (ng build / analog build)
						buildProject(projectDir);

						// Start server and verify endpoints (SQLite only)
						await startAndVerifyServer(projectDir, flavor, projectName, database);
					}

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
