#!/usr/bin/env npx tsx

/**
 * Unified Test Runner — One Command to Rule Them All
 *
 * Runs all test suites sequentially, captures output to log files,
 * and prints a structured summary with failure context.
 *
 * Usage:
 *   npx tsx scripts/test-all.ts                       # Run everything
 *   npx tsx scripts/test-all.ts --suite angular-e2e   # Run only one suite
 *   npx tsx scripts/test-all.ts --skip cli-scaffold   # Skip a suite
 *   npx tsx scripts/test-all.ts --skip cli-scaffold --skip migration-tests
 *   npx tsx scripts/test-all.ts --log-dir /tmp/my-logs # Custom log directory
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SuiteConfig {
	name: string;
	label: string;
	command: string[];
	logFile: string;
}

interface SuiteResult {
	name: string;
	label: string;
	status: 'PASS' | 'FAIL' | 'SKIP';
	exitCode: number;
	durationMs: number;
	logFile: string;
}

// ─── Suite Definitions ────────────────────────────────────────────────────────

const SUITES: SuiteConfig[] = [
	{
		name: 'unit-tests',
		label: 'Unit Tests',
		command: ['npx', 'nx', 'run-many', '-t', 'test', '--parallel=3'],
		logFile: 'unit-tests.log',
	},
	{
		name: 'angular-e2e',
		label: 'Angular E2E',
		command: ['npx', 'nx', 'e2e', 'example-angular-e2e'],
		logFile: 'angular-e2e.log',
	},
	{
		name: 'analog-e2e',
		label: 'Analog E2E',
		command: ['npx', 'nx', 'e2e', 'example-analog-e2e'],
		logFile: 'analog-e2e.log',
	},
	{
		name: 'migration-tests',
		label: 'Migration Tests',
		command: ['npx', 'nx', 'test', 'migrations'],
		logFile: 'migration-tests.log',
	},
	{
		name: 'cli-scaffold',
		label: 'CLI Scaffold Test',
		command: [
			'npx',
			'tsx',
			'scripts/test-create-app.ts',
			'--flavors',
			'angular,analog',
			'--databases',
			'sqlite',
			'--install-deps',
		],
		logFile: 'cli-scaffold.log',
	},
];

// ─── CLI Argument Parsing ─────────────────────────────────────────────────────

interface CliArgs {
	suiteFilter: string | null;
	skipSuites: Set<string>;
	logDir: string;
}

function parseArgs(): CliArgs {
	const args = process.argv.slice(2);
	let suiteFilter: string | null = null;
	const skipSuites = new Set<string>();
	let logDir = '/tmp/test-all';

	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--suite' && args[i + 1]) {
			suiteFilter = args[++i];
		} else if (args[i] === '--skip' && args[i + 1]) {
			skipSuites.add(args[++i]);
		} else if (args[i] === '--log-dir' && args[i + 1]) {
			logDir = args[++i];
		} else if (args[i] === '--help' || args[i] === '-h') {
			printHelp();
			process.exit(0);
		}
	}

	return { suiteFilter, skipSuites, logDir };
}

function printHelp(): void {
	console.log(`
Usage: npx tsx scripts/test-all.ts [options]

Options:
  --suite <name>    Run only the named suite
  --skip <name>     Skip a suite (can be repeated)
  --log-dir <path>  Override log directory (default: /tmp/test-all)
  --help, -h        Show this help

Available suites:
${SUITES.map((s) => `  ${s.name.padEnd(20)} ${s.label}`).join('\n')}
`);
}

// ─── Suite Runner ─────────────────────────────────────────────────────────────

const ROOT_DIR = path.resolve(
	import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname),
	'..',
);

function runSuite(suite: SuiteConfig, logFilePath: string): Promise<SuiteResult> {
	return new Promise((resolve) => {
		const start = Date.now();
		const logStream = fs.createWriteStream(logFilePath);

		const [cmd, ...args] = suite.command;
		const proc = spawn(cmd, args, {
			cwd: ROOT_DIR,
			stdio: ['ignore', 'pipe', 'pipe'],
			env: { ...process.env, FORCE_COLOR: '0' },
		});

		proc.stdout.pipe(logStream);
		proc.stderr.pipe(logStream);

		// Also stream to console with a prefix so you can see progress
		proc.stdout.on('data', (data: Buffer) => {
			const lines = data.toString().split('\n');
			for (const line of lines) {
				if (line.trim()) {
					process.stdout.write(`  [${suite.name}] ${line}\n`);
				}
			}
		});

		proc.stderr.on('data', (data: Buffer) => {
			const lines = data.toString().split('\n');
			for (const line of lines) {
				if (line.trim()) {
					process.stderr.write(`  [${suite.name}] ${line}\n`);
				}
			}
		});

		proc.on('close', (code) => {
			logStream.end();
			resolve({
				name: suite.name,
				label: suite.label,
				status: code === 0 ? 'PASS' : 'FAIL',
				exitCode: code ?? 1,
				durationMs: Date.now() - start,
				logFile: logFilePath,
			});
		});

		proc.on('error', (err) => {
			logStream.write(`\nProcess error: ${err.message}\n`);
			logStream.end();
			resolve({
				name: suite.name,
				label: suite.label,
				status: 'FAIL',
				exitCode: 1,
				durationMs: Date.now() - start,
				logFile: logFilePath,
			});
		});
	});
}

// ─── Formatting Helpers ───────────────────────────────────────────────────────

function formatDuration(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const remaining = seconds % 60;
	return `${minutes}m ${remaining}s`;
}

function readLastLines(filePath: string, count: number): string {
	try {
		const content = fs.readFileSync(filePath, 'utf-8');
		const lines = content.split('\n');
		return lines.slice(-count).join('\n');
	} catch {
		return `(could not read ${filePath})`;
	}
}

// ─── Summary Printer ──────────────────────────────────────────────────────────

const SEPARATOR = '═'.repeat(72);
const THIN_SEP = '─'.repeat(72);

function printSummary(results: SuiteResult[], totalMs: number): void {
	console.log('\n');
	console.log(SEPARATOR);
	console.log('  MOMENTUM CMS — FULL TEST SUITE RESULTS');
	console.log(SEPARATOR);
	console.log('');

	// Table header
	const nameWidth = 24;
	const statusWidth = 8;
	const durationWidth = 12;
	console.log(
		`  ${'Suite'.padEnd(nameWidth)}${'Status'.padEnd(statusWidth)}${'Duration'.padEnd(durationWidth)}Log File`,
	);
	console.log(
		`  ${'─'.repeat(nameWidth)}${'─'.repeat(statusWidth)}${'─'.repeat(durationWidth)}${'─'.repeat(20)}`,
	);

	for (const r of results) {
		const statusStr = r.status === 'PASS' ? 'PASS' : r.status === 'SKIP' ? 'SKIP' : 'FAIL';
		console.log(
			`  ${r.label.padEnd(nameWidth)}${statusStr.padEnd(statusWidth)}${formatDuration(r.durationMs).padEnd(durationWidth)}${r.logFile}`,
		);
	}

	console.log('');
	console.log(THIN_SEP);

	const passed = results.filter((r) => r.status === 'PASS').length;
	const failed = results.filter((r) => r.status === 'FAIL').length;
	const skipped = results.filter((r) => r.status === 'SKIP').length;
	const total = results.filter((r) => r.status !== 'SKIP').length;

	let resultLine = `  RESULT: ${passed}/${total} PASSED`;
	if (skipped > 0) resultLine += ` (${skipped} skipped)`;
	resultLine += `  |  Total time: ${formatDuration(totalMs)}`;
	console.log(resultLine);
	console.log(SEPARATOR);

	// Print failure details
	if (failed > 0) {
		console.log('');
		console.log(SEPARATOR);
		console.log('  FAILURE DETAILS');
		console.log(SEPARATOR);

		for (const r of results) {
			if (r.status !== 'FAIL') continue;
			console.log('');
			console.log(`  ── ${r.label} (exit code ${r.exitCode}) ──`);
			console.log(`  Log: ${r.logFile}`);
			console.log(THIN_SEP);
			console.log(readLastLines(r.logFile, 50));
			console.log(THIN_SEP);
		}
	}
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const { suiteFilter, skipSuites, logDir } = parseArgs();

	// Validate suite filter
	if (suiteFilter) {
		const valid = SUITES.find((s) => s.name === suiteFilter);
		if (!valid) {
			console.error(
				`Unknown suite: "${suiteFilter}". Available: ${SUITES.map((s) => s.name).join(', ')}`,
			);
			process.exit(1);
		}
	}

	// Validate skip names
	for (const name of skipSuites) {
		if (!SUITES.find((s) => s.name === name)) {
			console.error(
				`Unknown suite to skip: "${name}". Available: ${SUITES.map((s) => s.name).join(', ')}`,
			);
			process.exit(1);
		}
	}

	// Create log directory
	fs.mkdirSync(logDir, { recursive: true });

	console.log(SEPARATOR);
	console.log('  MOMENTUM CMS — RUNNING ALL TEST SUITES');
	console.log(SEPARATOR);
	console.log(`  Log directory: ${logDir}`);
	console.log('');

	const results: SuiteResult[] = [];
	const totalStart = Date.now();

	for (const suite of SUITES) {
		const logFilePath = path.join(logDir, suite.logFile);

		// Check if suite should be skipped
		if (suiteFilter && suite.name !== suiteFilter) {
			results.push({
				name: suite.name,
				label: suite.label,
				status: 'SKIP',
				exitCode: 0,
				durationMs: 0,
				logFile: logFilePath,
			});
			continue;
		}
		if (skipSuites.has(suite.name)) {
			console.log(`  Skipping: ${suite.label}`);
			results.push({
				name: suite.name,
				label: suite.label,
				status: 'SKIP',
				exitCode: 0,
				durationMs: 0,
				logFile: logFilePath,
			});
			continue;
		}

		console.log(`\n  Starting: ${suite.label}`);
		console.log(`  Command:  ${suite.command.join(' ')}`);
		console.log(`  Log:      ${logFilePath}`);
		console.log(THIN_SEP);

		const result = await runSuite(suite, logFilePath);
		results.push(result);

		const icon = result.status === 'PASS' ? 'PASS' : 'FAIL';
		console.log(THIN_SEP);
		console.log(`  ${icon}: ${suite.label} (${formatDuration(result.durationMs)})`);
	}

	const totalMs = Date.now() - totalStart;
	printSummary(results, totalMs);

	const hasFailed = results.some((r) => r.status === 'FAIL');
	process.exit(hasFailed ? 1 : 0);
}

main().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
