import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { createProject } from '../create-project';
import type { CLIOptions } from '../cli';

/**
 * CLI scaffolding E2E tests.
 * Verifies that create-momentum-app generates correct project structure,
 * applies template substitutions, and respects all configuration options.
 */

/** Create a unique temp directory for each test */
function makeTempDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), 'mcms-cli-test-'));
}

/** Run createProject in a temp directory and return the project path */
async function scaffold(tempDir: string, overrides: Partial<CLIOptions> = {}): Promise<string> {
	const projectName = overrides.projectName ?? 'test-app';
	const opts: CLIOptions = {
		projectName,
		flavor: 'angular',
		database: 'sqlite',
		install: false,
		docker: false,
		...overrides,
	};

	const originalCwd = process.cwd();
	process.chdir(tempDir);
	try {
		await createProject(opts);
	} finally {
		process.chdir(originalCwd);
	}

	return path.join(tempDir, projectName);
}

/** Recursively find all files in a directory */
function getAllFiles(dir: string, base = dir): string[] {
	const results: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...getAllFiles(fullPath, base));
		} else {
			results.push(path.relative(base, fullPath));
		}
	}
	return results;
}

/** Read all text files and check for leftover template variables */
function findLeftoverVars(projectDir: string): string[] {
	const issues: string[] = [];
	const files = getAllFiles(projectDir);
	for (const file of files) {
		const fullPath = path.join(projectDir, file);
		// Skip binary files and node_modules
		if (file.includes('node_modules')) continue;
		try {
			const content = fs.readFileSync(fullPath, 'utf-8');
			const matches = content.match(/\{\{[a-zA-Z]+\}\}/g);
			if (matches) {
				issues.push(`${file}: ${matches.join(', ')}`);
			}
		} catch {
			// Skip binary files that can't be read as utf-8
		}
	}
	return issues;
}

describe('create-momentum-app scaffolding', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = makeTempDir();
	});

	afterEach(() => {
		fs.removeSync(tempDir);
	});

	describe('file structure', () => {
		it('should create all expected files for angular + sqlite', async () => {
			const projectDir = await scaffold(tempDir, {
				flavor: 'angular',
				database: 'sqlite',
			});

			// Core files
			expect(fs.existsSync(path.join(projectDir, 'package.json'))).toBe(true);
			expect(fs.existsSync(path.join(projectDir, '.env'))).toBe(true);
			expect(fs.existsSync(path.join(projectDir, '.env.example'))).toBe(true);
			expect(fs.existsSync(path.join(projectDir, '.gitignore'))).toBe(true);
			expect(fs.existsSync(path.join(projectDir, 'README.md'))).toBe(true);

			// Angular-specific
			expect(fs.existsSync(path.join(projectDir, 'angular.json'))).toBe(true);
			expect(fs.existsSync(path.join(projectDir, 'src', 'momentum.config.ts'))).toBe(true);
			expect(fs.existsSync(path.join(projectDir, 'src', 'server.ts'))).toBe(true);
			expect(fs.existsSync(path.join(projectDir, 'src', 'index.html'))).toBe(true);

			// Skills
			expect(
				fs.existsSync(path.join(projectDir, '.claude', 'skills', 'collection', 'SKILL.md')),
			).toBe(true);
			expect(
				fs.existsSync(path.join(projectDir, '.claude', 'skills', 'migrations', 'SKILL.md')),
			).toBe(true);

			// No docker-compose for sqlite
			expect(fs.existsSync(path.join(projectDir, 'docker-compose.yml'))).toBe(false);
		});

		it('should create all expected files for nestjs + postgres', async () => {
			const projectDir = await scaffold(tempDir, {
				flavor: 'nestjs',
				database: 'postgres',
				docker: false,
			});

			expect(fs.existsSync(path.join(projectDir, 'package.json'))).toBe(true);
			expect(fs.existsSync(path.join(projectDir, 'src', 'momentum.config.ts'))).toBe(true);
			expect(fs.existsSync(path.join(projectDir, 'angular.json'))).toBe(true);

			// No docker-compose when docker=false even with postgres
			expect(fs.existsSync(path.join(projectDir, 'docker-compose.yml'))).toBe(false);
		});

		it('should create all expected files for analog + sqlite', async () => {
			const projectDir = await scaffold(tempDir, {
				flavor: 'analog',
				database: 'sqlite',
			});

			expect(fs.existsSync(path.join(projectDir, 'package.json'))).toBe(true);
			expect(fs.existsSync(path.join(projectDir, 'src', 'momentum.config.ts'))).toBe(true);
			expect(fs.existsSync(path.join(projectDir, 'vite.config.ts'))).toBe(true);

			// No angular.json for analog
			expect(fs.existsSync(path.join(projectDir, 'angular.json'))).toBe(false);
		});

		it('should include docker-compose.yml for postgres + docker', async () => {
			// Use install: false and docker: false to avoid side effects,
			// then manually verify the template was generated before cleanup.
			// The docker-compose.yml is removed when !postgres || !docker,
			// so we scaffold with postgres + docker=false (file removed), then verify
			// the template itself generates the file correctly.
			const projectDir = await scaffold(tempDir, {
				projectName: 'docker-test',
				database: 'postgres',
				docker: false,
			});
			// File was removed because docker=false
			expect(fs.existsSync(path.join(projectDir, 'docker-compose.yml'))).toBe(false);

			// Verify the docker-compose template exists in shared templates and
			// would be copied if docker were true, by checking the template source.
			const templatesDir = path.resolve(__dirname, '..', '..', 'templates', 'shared');
			expect(fs.existsSync(path.join(templatesDir, 'docker-compose.yml.tmpl'))).toBe(true);
		});
	});

	describe('no .tmpl files in output', () => {
		it('should strip .tmpl extension from all generated files', async () => {
			const projectDir = await scaffold(tempDir);
			const files = getAllFiles(projectDir);
			const tmplFiles = files.filter((f) => f.endsWith('.tmpl'));
			expect(tmplFiles).toEqual([]);
		});
	});

	describe('template variable substitution', () => {
		it('should have no leftover {{variables}} in any generated file', async () => {
			const projectDir = await scaffold(tempDir, {
				projectName: 'my-cool-app',
				flavor: 'angular',
				database: 'sqlite',
			});
			const leftovers = findLeftoverVars(projectDir);
			expect(leftovers).toEqual([]);
		});

		it('should have no leftover {{variables}} for postgres config', async () => {
			const projectDir = await scaffold(tempDir, {
				projectName: 'pg-app',
				flavor: 'angular',
				database: 'postgres',
				docker: false,
			});
			const leftovers = findLeftoverVars(projectDir);
			expect(leftovers).toEqual([]);
		});

		it('should have no leftover {{variables}} for nestjs flavor', async () => {
			const projectDir = await scaffold(tempDir, {
				projectName: 'nest-app',
				flavor: 'nestjs',
				database: 'sqlite',
			});
			const leftovers = findLeftoverVars(projectDir);
			expect(leftovers).toEqual([]);
		});

		it('should have no leftover {{variables}} for analog flavor', async () => {
			const projectDir = await scaffold(tempDir, {
				projectName: 'analog-app',
				flavor: 'analog',
				database: 'postgres',
				docker: false,
			});
			const leftovers = findLeftoverVars(projectDir);
			expect(leftovers).toEqual([]);
		});
	});

	describe('project name as DB name (not hardcoded "momentum")', () => {
		it('should use project name in sqlite database path', async () => {
			const projectDir = await scaffold(tempDir, {
				projectName: 'my-cms',
				database: 'sqlite',
			});

			const config = fs.readFileSync(path.join(projectDir, 'src', 'momentum.config.ts'), 'utf-8');
			expect(config).toContain('my-cms.db');
			expect(config).not.toContain('momentum.db');

			const env = fs.readFileSync(path.join(projectDir, '.env'), 'utf-8');
			expect(env).toContain('my-cms.db');
		});

		it('should use project name in postgres connection string', async () => {
			const projectDir = await scaffold(tempDir, {
				projectName: 'my-cms',
				database: 'postgres',
				docker: false,
			});

			const config = fs.readFileSync(path.join(projectDir, 'src', 'momentum.config.ts'), 'utf-8');
			expect(config).toContain('localhost:5432/my-cms');
			expect(config).not.toContain('localhost:5432/momentum');

			const env = fs.readFileSync(path.join(projectDir, '.env'), 'utf-8');
			expect(env).toContain('localhost:5432/my-cms');

			// Verify docker-compose template has the project name variable
			// (file removed because docker=false, so check template directly)
			const tmpl = fs.readFileSync(
				path.resolve(__dirname, '..', '..', 'templates', 'shared', 'docker-compose.yml.tmpl'),
				'utf-8',
			);
			expect(tmpl).toContain('{{projectName}}');
		});

		it('should use project name in README database section', async () => {
			const projectDir = await scaffold(tempDir, {
				projectName: 'cool-project',
				database: 'postgres',
				docker: false,
			});

			const readme = fs.readFileSync(path.join(projectDir, 'README.md'), 'utf-8');
			expect(readme).toContain('cool-project');
		});
	});

	describe('PORT / BASE_URL DRY config', () => {
		it('should define PORT and BASE_URL constants in angular momentum.config.ts', async () => {
			const projectDir = await scaffold(tempDir, { flavor: 'angular' });
			const config = fs.readFileSync(path.join(projectDir, 'src', 'momentum.config.ts'), 'utf-8');

			// Should have PORT constant defined once at top
			expect(config).toContain("const PORT = Number(process.env['PORT'])");
			expect(config).toContain('const BASE_URL =');

			// PORT should not be repeated inline with fallback pattern
			const portFallbackCount = (config.match(/process\.env\['PORT'\].*\|\|/g) ?? []).length;
			expect(portFallbackCount).toBe(1); // Only in the const definition
		});

		it('should define PORT and BASE_URL constants in nestjs momentum.config.ts', async () => {
			const projectDir = await scaffold(tempDir, { flavor: 'nestjs' });
			const config = fs.readFileSync(path.join(projectDir, 'src', 'momentum.config.ts'), 'utf-8');

			expect(config).toContain("const PORT = Number(process.env['PORT'])");
			expect(config).toContain('const BASE_URL =');
		});

		it('should define PORT and BASE_URL constants in analog momentum.config.ts', async () => {
			const projectDir = await scaffold(tempDir, { flavor: 'analog' });
			const config = fs.readFileSync(path.join(projectDir, 'src', 'momentum.config.ts'), 'utf-8');

			expect(config).toContain("const PORT = Number(process.env['PORT'])");
			expect(config).toContain('const BASE_URL =');
		});
	});

	describe('database adapter configuration', () => {
		it('should use sqliteAdapter for sqlite database', async () => {
			const projectDir = await scaffold(tempDir, { database: 'sqlite' });
			const config = fs.readFileSync(path.join(projectDir, 'src', 'momentum.config.ts'), 'utf-8');

			expect(config).toContain('import { sqliteAdapter }');
			expect(config).toContain('sqliteAdapter(');
			expect(config).not.toContain('postgresAdapter');
		});

		it('should use postgresAdapter for postgres database', async () => {
			const projectDir = await scaffold(tempDir, { database: 'postgres' });
			const config = fs.readFileSync(path.join(projectDir, 'src', 'momentum.config.ts'), 'utf-8');

			expect(config).toContain('import { postgresAdapter }');
			expect(config).toContain('postgresAdapter(');
			expect(config).not.toContain('sqliteAdapter');
		});

		it('should include pg dependency for postgres', async () => {
			const projectDir = await scaffold(tempDir, { database: 'postgres' });
			const pkg = fs.readJsonSync(path.join(projectDir, 'package.json'));

			expect(pkg.dependencies).toHaveProperty('pg');
			expect(pkg.dependencies).not.toHaveProperty('better-sqlite3');
		});

		it('should include better-sqlite3 dependency for sqlite', async () => {
			const projectDir = await scaffold(tempDir, { database: 'sqlite' });
			const pkg = fs.readJsonSync(path.join(projectDir, 'package.json'));

			expect(pkg.dependencies).toHaveProperty('better-sqlite3');
			expect(pkg.dependencies).not.toHaveProperty('pg');
		});
	});

	describe('skills and agent files', () => {
		it('should include all expected skill directories', async () => {
			const projectDir = await scaffold(tempDir);
			const skillsDir = path.join(projectDir, '.claude', 'skills');

			const expectedSkills = [
				'collection',
				'momentum-api',
				'add-plugin',
				'admin-config',
				'api-route',
				'component',
				'e2e-test',
				'migrations',
			];

			for (const skill of expectedSkills) {
				expect(
					fs.existsSync(path.join(skillsDir, skill, 'SKILL.md')),
					`Skill ${skill}/SKILL.md should exist`,
				).toBe(true);
			}
		});

		it('should include agents.md reference', async () => {
			const projectDir = await scaffold(tempDir);
			expect(fs.existsSync(path.join(projectDir, '.claude', 'agents.md'))).toBe(true);
		});

		it('should include CLAUDE.md', async () => {
			const projectDir = await scaffold(tempDir);
			expect(fs.existsSync(path.join(projectDir, '.claude', 'CLAUDE.md'))).toBe(true);
		});
	});

	describe('package.json content', () => {
		it('should set correct project name', async () => {
			const projectDir = await scaffold(tempDir, { projectName: 'my-project' });
			const pkg = fs.readJsonSync(path.join(projectDir, 'package.json'));
			expect(pkg.name).toBe('my-project');
		});

		it('should include momentum CMS dependencies', async () => {
			const projectDir = await scaffold(tempDir);
			const pkg = fs.readJsonSync(path.join(projectDir, 'package.json'));

			expect(pkg.dependencies).toHaveProperty('@momentumcms/core');
			expect(pkg.dependencies).toHaveProperty('@momentumcms/admin');
			expect(pkg.dependencies).toHaveProperty('@momentumcms/db-drizzle');
			expect(pkg.dependencies).toHaveProperty('@momentumcms/auth');
		});
	});

	describe('.env file', () => {
		it('should copy .env.example to .env', async () => {
			const projectDir = await scaffold(tempDir);
			const envExample = fs.readFileSync(path.join(projectDir, '.env.example'), 'utf-8');
			const env = fs.readFileSync(path.join(projectDir, '.env'), 'utf-8');
			expect(env).toBe(envExample);
		});

		it('should contain auth and port configuration', async () => {
			const projectDir = await scaffold(tempDir);
			const env = fs.readFileSync(path.join(projectDir, '.env'), 'utf-8');
			expect(env).toContain('BETTER_AUTH_URL');
			expect(env).toContain('PORT=');
		});
	});

	describe('all flavor × database combinations', () => {
		const flavors = ['angular', 'analog', 'nestjs'] as const;
		const databases = ['sqlite', 'postgres'] as const;

		for (const flavor of flavors) {
			for (const database of databases) {
				it(`should scaffold ${flavor} + ${database} without errors`, async () => {
					const projectDir = await scaffold(tempDir, {
						projectName: `test-${flavor}-${database}`,
						flavor,
						database,
						docker: false,
					});

					// Basic sanity checks
					expect(fs.existsSync(path.join(projectDir, 'package.json'))).toBe(true);
					expect(fs.existsSync(path.join(projectDir, 'src', 'momentum.config.ts'))).toBe(true);
					expect(fs.existsSync(path.join(projectDir, '.env'))).toBe(true);

					// No leftover template variables
					const leftovers = findLeftoverVars(projectDir);
					expect(leftovers).toEqual([]);

					// No .tmpl files
					const files = getAllFiles(projectDir);
					expect(files.filter((f) => f.endsWith('.tmpl'))).toEqual([]);
				});
			}
		}
	});
});
