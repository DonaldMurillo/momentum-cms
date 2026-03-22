/**
 * Momentum CMS Unified Code Generator
 *
 * Single-pass generator that reads momentum.config.ts and produces output files:
 * 1. Types file (--types): TypeScript interfaces for all collections + globals
 * 2. Admin config file (--config): Browser-safe Angular config with inlined, stripped collections
 * 3. Client SDK file (--client): Framework-agnostic fetch-based API client (optional)
 *
 * Usage:
 *   npx tsx generator.ts <configPath> --types <typesOutput> --config <configOutput> [--client <clientOutput>] [--watch]
 */

/* eslint-disable no-console, local/no-direct-browser-apis -- CLI tool: console output and Node.js setTimeout are legitimate */
import { writeFileSync, mkdirSync, watch } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

// Re-export everything from submodules so existing import paths still work
export type {
	FieldDefinition,
	CollectionDefinition,
	GlobalDefinition,
	MomentumConfig,
	GeneratorOptions,
} from './generator-types';
export { computeRelativeImport } from './generator-types';
export { generateTypes } from './generate-types';
export { generateClientCode } from './generate-client';
export { generateAdminConfig } from './generate-admin-config';
export {
	serializeValue,
	serializeField,
	serializeCollection,
	serializeGlobal,
} from './serialization';

// Local imports for the CLI runner
import type { GeneratorOptions } from './generator-types';
import { loadConfig, computeRelativeImport } from './generator-types';
import { generateTypes } from './generate-types';
import { generateClientCode } from './generate-client';
import { generateAdminConfig } from './generate-admin-config';

// ============================================
// CLI Runner
// ============================================

export function parseArgs(args: string[]): GeneratorOptions {
	const configPath = args[0];
	let typesOutputPath = '';
	let configOutputPath = '';
	let clientOutputPath: string | undefined;
	let watchMode = false;

	for (let i = 1; i < args.length; i++) {
		if (args[i] === '--types' && args[i + 1]) {
			typesOutputPath = args[++i];
		} else if (args[i] === '--config' && args[i + 1]) {
			configOutputPath = args[++i];
		} else if (args[i] === '--client' && args[i + 1]) {
			clientOutputPath = args[++i];
		} else if (args[i] === '--watch') {
			watchMode = true;
		}
	}

	if (!configPath) {
		console.error(
			'Usage: npx tsx generator.ts <config-path> --types <types-output> --config <config-output> [--client <client-output>] [--watch]',
		);
		process.exit(1);
	}

	if (!typesOutputPath) {
		typesOutputPath = 'src/generated/momentum.types.ts';
	}
	if (!configOutputPath) {
		configOutputPath = 'src/generated/momentum.config.ts';
	}

	return { configPath, typesOutputPath, configOutputPath, clientOutputPath, watch: watchMode };
}

/**
 * Format generated files with prettier to match pre-commit hook formatting.
 * Uses the project's .prettierrc so generated output is commit-ready.
 */
function formatWithPrettier(...filePaths: string[]): void {
	try {
		execFileSync('npx', ['prettier', '--write', ...filePaths], {
			stdio: 'pipe',
		});
	} catch {
		console.warn('prettier not available — skipping formatting of generated files');
	}
}

export default async function runGenerator(
	options: GeneratorOptions,
): Promise<{ success: boolean }> {
	const configPath = resolve(options.configPath);
	const typesOutputPath = resolve(options.typesOutputPath);
	const configOutputPath = resolve(options.configOutputPath);
	const clientOutputPath = options.clientOutputPath ? resolve(options.clientOutputPath) : undefined;

	console.info(`Generating from: ${configPath}`);
	console.info(`Types output: ${typesOutputPath}`);
	console.info(`Config output: ${configOutputPath}`);
	if (clientOutputPath) {
		console.info(`Client output: ${clientOutputPath}`);
	}

	// Compute relative import path from config output to types output
	const typesRelPath = computeRelativeImport(configOutputPath, typesOutputPath);

	async function generate(): Promise<void> {
		try {
			const config = await loadConfig(configPath);

			// Generate types
			const typesContent = generateTypes(config);
			mkdirSync(dirname(typesOutputPath), { recursive: true });
			writeFileSync(typesOutputPath, typesContent, 'utf-8');
			console.info(`Types generated: ${typesOutputPath}`);

			// Generate admin config (inlined, stripped)
			const adminConfigContent = generateAdminConfig(
				config,
				typesRelPath,
				configPath,
				configOutputPath,
			);
			mkdirSync(dirname(configOutputPath), { recursive: true });
			writeFileSync(configOutputPath, adminConfigContent, 'utf-8');
			console.info(`Admin config generated: ${configOutputPath}`);

			// Generate client SDK (optional)
			const filesToFormat = [typesOutputPath, configOutputPath];
			if (clientOutputPath) {
				const clientTypesRelPath = computeRelativeImport(clientOutputPath, typesOutputPath);
				const clientContent = generateClientCode(config, clientTypesRelPath);
				mkdirSync(dirname(clientOutputPath), { recursive: true });
				writeFileSync(clientOutputPath, clientContent, 'utf-8');
				console.info(`Client SDK generated: ${clientOutputPath}`);
				filesToFormat.push(clientOutputPath);
			}

			// Format with prettier so output matches pre-commit formatting
			formatWithPrettier(...filesToFormat);
		} catch (error) {
			console.error(`Error generating:`, error);
			throw error;
		}
	}

	await generate();

	if (options.watch) {
		console.info(`Watching for changes...`);
		const configDir = dirname(configPath);

		// Debounce timer to coalesce rapid file changes into a single regeneration
		let debounceTimer: ReturnType<typeof setTimeout> | null = null;

		watch(configDir, { recursive: true }, (_eventType, filename) => {
			if (!filename?.endsWith('.ts')) return;

			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				debounceTimer = null;
				console.info(`Change detected: ${filename}`);

				// Spawn a fresh child process so the ESM module cache is clean.
				// Node.js (and tsx) caches ESM modules by URL for the lifetime of a process,
				// so re-importing the same config file in-process always returns the stale module.
				try {
					const childArgs = [
						...process.execArgv,
						process.argv[1],
						configPath,
						'--types',
						typesOutputPath,
						'--config',
						configOutputPath,
					];
					if (clientOutputPath) {
						childArgs.push('--client', clientOutputPath);
					}
					execFileSync(process.execPath, childArgs, { stdio: 'inherit' });
				} catch {
					// Continue watching on error
				}
			}, 100);
		});

		// Keep process alive
		return new Promise(() => {
			// Never resolves in watch mode
		});
	}

	return { success: true };
}

// CLI entry point
if (
	process.argv[1]?.endsWith('generator.ts') ||
	process.argv[1]?.endsWith('generator.js') ||
	process.argv[1]?.endsWith('generator.cjs')
) {
	const options = parseArgs(process.argv.slice(2));
	runGenerator(options).then(
		() => process.exit(0),
		(err) => {
			console.error(err);
			process.exit(1);
		},
	);
}
