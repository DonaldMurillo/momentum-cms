/**
 * Vitest globalSetup — ensures MinIO is available for S3 integration tests.
 *
 * 1. Probes MinIO health endpoint (already running?)
 * 2. If not, tries `docker compose up -d minio` and polls for readiness
 * 3. Sets MINIO_AVAILABLE and MINIO_ENDPOINT env vars for the test suite
 */

/* eslint-disable local/no-direct-browser-apis */
import { execFileSync } from 'node:child_process';

const DEFAULT_ENDPOINT = 'http://localhost:9000';
const HEALTH_PATH = '/minio/health/live';
const MAX_RETRIES = 15;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isMinioHealthy(endpoint: string): Promise<boolean> {
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 2000);
		const res = await fetch(`${endpoint}${HEALTH_PATH}`, { signal: controller.signal });
		clearTimeout(timeout);
		return res.ok;
	} catch {
		return false;
	}
}

async function waitForMinio(endpoint: string): Promise<boolean> {
	for (let i = 0; i < MAX_RETRIES; i++) {
		if (await isMinioHealthy(endpoint)) {
			return true;
		}
		await sleep(RETRY_DELAY_MS);
	}
	return false;
}

export async function setup(): Promise<void> {
	const endpoint = process.env['MINIO_ENDPOINT'] ?? DEFAULT_ENDPOINT;

	// 1. Check if MinIO is already running
	if (await isMinioHealthy(endpoint)) {
		process.env['MINIO_AVAILABLE'] = 'true';
		process.env['MINIO_ENDPOINT'] = endpoint;
		return;
	}

	// 2. Try to start MinIO via docker compose (no shell, safe args)
	try {
		execFileSync('docker', ['compose', 'up', '-d', 'minio'], {
			cwd: process.env['NX_WORKSPACE_ROOT'] ?? process.cwd(),
			stdio: 'pipe',
			timeout: 30_000,
		});
	} catch {
		// Docker not available or compose failed — skip S3 tests
		process.env['MINIO_AVAILABLE'] = 'false';
		return;
	}

	// 3. Poll for readiness
	const healthy = await waitForMinio(endpoint);
	process.env['MINIO_AVAILABLE'] = healthy ? 'true' : 'false';
	process.env['MINIO_ENDPOINT'] = endpoint;
}
