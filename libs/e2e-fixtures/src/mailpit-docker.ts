/* eslint-disable no-console */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const MAILPIT_CONTAINER_NAME = 'e2e-mailpit';
const MAILPIT_API = 'http://localhost:8025/api/v1';
const MARKER_FILE = path.join(os.tmpdir(), 'e2e-mailpit-started-by-tests');

/**
 * Check if Mailpit is running and accessible.
 */
async function isMailpitAvailable(): Promise<boolean> {
	try {
		const response = await fetch(`${MAILPIT_API}/messages`);
		return response.ok;
	} catch {
		return false;
	}
}

/**
 * Check if Docker is available on this machine.
 */
function isDockerAvailable(): boolean {
	try {
		execFileSync('docker', ['--version'], { stdio: 'pipe' });
		return true;
	} catch {
		return false;
	}
}

/**
 * Ensure Mailpit is running for E2E email tests.
 *
 * If Mailpit is already accessible, does nothing.
 * If not, starts it via Docker and waits for it to be ready.
 * Writes a marker file so stopMailpit() knows we started it.
 *
 * Gracefully warns (does not fail) if Docker is unavailable —
 * email tests will skip themselves via their own guards.
 */
export async function ensureMailpit(): Promise<void> {
	if (await isMailpitAvailable()) {
		console.log('[Mailpit] Already running.');
		return;
	}

	if (!isDockerAvailable()) {
		console.warn('[Mailpit] Not running and Docker is not available. Email tests will be skipped.');
		return;
	}

	console.log('[Mailpit] Not running. Starting via Docker...');

	// Remove any stale container with the same name
	try {
		execFileSync('docker', ['rm', '-f', MAILPIT_CONTAINER_NAME], { stdio: 'pipe' });
	} catch {
		// Container didn't exist — that's fine
	}

	// Start Mailpit
	execFileSync(
		'docker',
		[
			'run',
			'-d',
			'--name',
			MAILPIT_CONTAINER_NAME,
			'-p',
			'8025:8025',
			'-p',
			'1025:1025',
			'axllent/mailpit',
		],
		{ stdio: 'pipe' },
	);

	// Write marker so teardown knows we started it
	fs.writeFileSync(MARKER_FILE, String(Date.now()));

	// Wait for Mailpit to become ready
	const startTime = Date.now();
	const timeout = 15000;
	while (Date.now() - startTime < timeout) {
		if (await isMailpitAvailable()) {
			console.log('[Mailpit] Started successfully.');
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	throw new Error(`[Mailpit] Failed to start within ${timeout / 1000} seconds.`);
}

/**
 * Stop Mailpit if it was started by ensureMailpit().
 *
 * Only stops the container if the marker file exists,
 * meaning we started it during global setup.
 * If Mailpit was already running before tests, it's left alone.
 */
export async function stopMailpit(): Promise<void> {
	if (!fs.existsSync(MARKER_FILE)) {
		console.log('[Mailpit] Was not started by tests — leaving it alone.');
		return;
	}

	try {
		fs.unlinkSync(MARKER_FILE);
	} catch {
		// Marker already removed — nothing to do
	}

	try {
		execFileSync('docker', ['rm', '-f', MAILPIT_CONTAINER_NAME], { stdio: 'pipe' });
		console.log('[Mailpit] Stopped container.');
	} catch {
		console.warn('[Mailpit] Failed to stop container (may have already been removed).');
	}
}
