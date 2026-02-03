/* eslint-disable no-console */
import type { FullConfig } from '@playwright/test';

const MAX_WAIT_TIME = 60000; // 60 seconds max wait for seeds
const POLL_INTERVAL = 1000; // Poll every second

/**
 * Global setup for Seeding E2E tests.
 *
 * Waits for the seeding process to complete before running tests.
 * This ensures all seeded data is available for test assertions.
 */
async function globalSetup(config: FullConfig): Promise<void> {
	const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:4001';

	console.log('[Seeding E2E] Waiting for server and seeds to be ready...');

	const startTime = Date.now();
	let lastError: Error | null = null;

	while (Date.now() - startTime < MAX_WAIT_TIME) {
		try {
			const response = await fetch(`${baseURL}/api/health?checkSeeds=true`);

			if (response.ok) {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Type assertion needed for response validation
				const data = (await response.json()) as {
					status: string;
					seeds?: { completed: number; expected: number; ready: boolean };
				};

				if (data.seeds?.ready) {
					console.log(
						`[Seeding E2E] Seeds ready: ${data.seeds.completed}/${data.seeds.expected} seeds completed`,
					);
					return;
				}

				console.log(
					`[Seeding E2E] Seeds not ready yet: ${data.seeds?.completed ?? 0}/${data.seeds?.expected ?? 0}`,
				);
			} else {
				console.log(`[Seeding E2E] Health check returned ${response.status}, retrying...`);
			}
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			console.log(`[Seeding E2E] Server not ready yet: ${lastError.message}`);
		}

		await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
	}

	throw new Error(
		`[Seeding E2E] Timed out waiting for seeds to complete after ${MAX_WAIT_TIME}ms. Last error: ${lastError?.message}`,
	);
}

export default globalSetup;
