import { test, expect, TEST_CREDENTIALS } from '../fixtures';
import { execSync, spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * MCP + Claude Code CLI E2E Test
 *
 * Spawns Claude Code in non-interactive mode (`claude -p`) with an
 * `--mcp-config` pointing at the running CMS's MCP endpoint.
 * Verifies Claude Code can discover and use the MCP tools to interact
 * with real CMS data.
 *
 * Requires `claude` CLI to be installed and available on PATH.
 * Skips gracefully if the CLI is not found.
 */

function isClaudeCliAvailable(): boolean {
	try {
		execSync('claude --version', { stdio: 'pipe', timeout: 5000 });
		return true;
	} catch {
		return false;
	}
}

test.describe('MCP via Claude Code CLI', { tag: ['@mcp', '@integration'] }, () => {
	// Skip entire suite if Claude CLI is not installed
	test.skip(!isClaudeCliAvailable(), 'Claude Code CLI not installed — skipping MCP CLI tests');

	let apiKey: string;
	let tmpDir: string;

	test.beforeAll(async ({ playwright, workerBaseURL }) => {
		// Create API key for MCP access
		const adminCtx = await playwright.request.newContext({
			baseURL: workerBaseURL,
			extraHTTPHeaders: { Origin: workerBaseURL },
		});

		const signIn = await adminCtx.post('/api/auth/sign-in/email', {
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signIn.ok()).toBe(true);

		const keyResponse = await adminCtx.post('/api/auth/api-keys', {
			data: { name: 'Claude Code MCP Key', role: 'admin' },
		});
		expect(keyResponse.status()).toBe(201);
		const keyData = (await keyResponse.json()) as { key: string };
		apiKey = keyData.key;
		await adminCtx.dispose();

		// Create temp dir for MCP config
		tmpDir = mkdtempSync(join(tmpdir(), 'mcp-e2e-'));
	});

	test.afterAll(() => {
		if (tmpDir) {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	test('Claude Code should list CMS collections via MCP tools', async ({ workerBaseURL }) => {
		test.setTimeout(90_000); // Claude Code invocations take time

		// Write MCP config pointing at the running server
		const mcpConfig = {
			mcpServers: {
				'momentum-cms': {
					type: 'http',
					url: `${workerBaseURL}/api/mcp`,
					headers: {
						'X-API-Key': apiKey,
					},
				},
			},
		};
		const configPath = join(tmpDir, 'mcp-config.json');
		writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2));

		// Invoke Claude Code in non-interactive mode
		const result = spawnSync(
			'claude',
			[
				'-p',
				'You MUST call the list_collections MCP tool. Return ONLY the collection slugs as a comma-separated list. Do not explain anything.',
				'--mcp-config',
				configPath,
				'--output-format',
				'text',
				'--model',
				'haiku',
				'--dangerously-skip-permissions',
				'--strict-mcp-config',
			],
			{
				encoding: 'utf-8',
				timeout: 80_000,
				input: '', // avoid stdin warning
				env: {
					...process.env,
					CI: 'true',
				},
			},
		);

		// Check Claude Code ran successfully
		if (result.status !== 0) {
			console.error('Claude CLI stderr:', result.stderr?.substring(0, 2000));
			console.error('Claude CLI stdout:', result.stdout?.substring(0, 2000));
		}
		expect(result.status).toBe(0);
		expect(result.stdout).toBeDefined();

		const output = result.stdout.toLowerCase();

		// The output should contain collection names from the CMS
		// (the example app seeds articles, categories, pages, etc.)
		expect(output).toContain('articles');
		expect(output).toContain('categories');

		// Should NOT contain auth collections (they're filtered out by the MCP plugin)
		expect(output).not.toContain('auth-user');
		expect(output).not.toContain('auth-session');
	});

	test('Claude Code should read documents via MCP tools', async ({ workerBaseURL }) => {
		test.setTimeout(90_000);

		const mcpConfig = {
			mcpServers: {
				'momentum-cms': {
					type: 'http',
					url: `${workerBaseURL}/api/mcp`,
					headers: {
						'X-API-Key': apiKey,
					},
				},
			},
		};
		const configPath = join(tmpDir, 'mcp-config-read.json');
		writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2));

		const result = spawnSync(
			'claude',
			[
				'-p',
				'You MUST call the count_documents MCP tool with collection "articles". Return ONLY the number, nothing else.',
				'--mcp-config',
				configPath,
				'--output-format',
				'text',
				'--model',
				'haiku',
				'--dangerously-skip-permissions',
				'--strict-mcp-config',
			],
			{
				encoding: 'utf-8',
				timeout: 80_000,
				input: '',
				env: { ...process.env, CI: 'true' },
			},
		);

		if (result.status !== 0) {
			console.error('Claude CLI stderr:', result.stderr?.substring(0, 2000));
			console.error('Claude CLI stdout:', result.stdout?.substring(0, 2000));
		}
		expect(result.status).toBe(0);
		expect(result.stdout).toBeDefined();

		// The output should contain a number > 0
		const output = result.stdout.trim();
		const count = parseInt(output, 10);
		expect(count).toBeGreaterThan(0);
	});
});
