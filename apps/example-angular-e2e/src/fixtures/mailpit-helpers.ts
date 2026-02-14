/**
 * Shared Mailpit helpers for E2E tests that involve email flows.
 *
 * NOTE: This file is intentionally duplicated between E2E apps since they
 * are separate Playwright projects that cannot share code via imports.
 * The canonical version is in seeding-test-app-e2e/src/fixtures/mailpit-helpers.ts.
 */

// Mailpit API endpoint
const MAILPIT_API = 'http://localhost:8025/api/v1';

// Mailpit types
export interface MailpitAddress {
	Name: string;
	Address: string;
}

export interface MailpitMessage {
	ID: string;
	MessageID: string;
	From: MailpitAddress;
	To: MailpitAddress[];
	Subject: string;
	Created: string;
}

export interface MailpitMessagesResponse {
	total: number;
	unread: number;
	messages: MailpitMessage[];
}

export interface MailpitMessageDetail {
	ID: string;
	MessageID: string;
	From: MailpitAddress;
	To: MailpitAddress[];
	Subject: string;
	Text: string;
	HTML: string;
}

/**
 * Check if Mailpit is running and accessible.
 * Returns true if Mailpit is reachable, false otherwise.
 */
export async function isMailpitAvailable(): Promise<boolean> {
	try {
		const response = await fetch(`${MAILPIT_API}/messages`);
		return response.ok;
	} catch {
		return false;
	}
}

/**
 * Check if Mailpit is running and accessible.
 * Throws an error if Mailpit is not available.
 */
export async function checkMailpitHealth(): Promise<void> {
	const available = await isMailpitAvailable();
	if (!available) {
		throw new Error(
			`Mailpit is not running at ${MAILPIT_API}. ` +
				`Start it with: docker run -d -p 8025:8025 -p 1025:1025 axllent/mailpit`,
		);
	}
}

/**
 * Clear all emails from Mailpit.
 */
export async function clearMailpit(): Promise<void> {
	try {
		await fetch(`${MAILPIT_API}/messages`, { method: 'DELETE' });
	} catch (err) {
		throw new Error(`Failed to clear Mailpit messages: ${err}`);
	}
}

/**
 * Get all emails from Mailpit.
 */
export async function getEmails(): Promise<MailpitMessage[]> {
	const response = await fetch(`${MAILPIT_API}/messages`);
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Mailpit API response
	const data = (await response.json()) as MailpitMessagesResponse;
	return data.messages || [];
}

/**
 * Get a specific email by ID.
 */
export async function getEmailById(id: string): Promise<MailpitMessageDetail> {
	const response = await fetch(`${MAILPIT_API}/message/${id}`);
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Mailpit API response
	return (await response.json()) as MailpitMessageDetail;
}

/**
 * Wait for an email to arrive matching the given criteria.
 */
export async function waitForEmail(
	toEmail: string,
	subjectContains: string,
	timeout = 10000,
): Promise<MailpitMessage> {
	const startTime = Date.now();

	while (Date.now() - startTime < timeout) {
		const emails = await getEmails();
		const email = emails.find(
			(e) =>
				e.To.some((t) => t.Address === toEmail) &&
				e.Subject.toLowerCase().includes(subjectContains.toLowerCase()),
		);

		if (email) {
			return email;
		}

		// eslint-disable-next-line local/no-direct-browser-apis -- Node.js Playwright helper, not Angular
		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	throw new Error(
		`Timeout waiting for email to ${toEmail} with subject containing "${subjectContains}"`,
	);
}

/**
 * Extract reset URL from email body and validate it has a token.
 * Better Auth generates URLs in format: {baseURL}/reset-password/{token}?callbackURL=...
 * The token is in the path, not query params. Returns the full URL for navigation.
 */
export function extractResetUrl(htmlBody: string): string | null {
	// Look for the reset URL in the HTML
	const match = htmlBody.match(/href="([^"]*reset-password[^"]*)"/);
	if (match) {
		const url = match[1];
		try {
			const urlObj = new URL(url);
			const pathMatch = urlObj.pathname.match(/\/reset-password\/([a-zA-Z0-9_-]+)/);
			if (pathMatch || urlObj.searchParams.has('token')) {
				return url;
			}
		} catch {
			// Invalid URL, try next pattern
		}
	}

	// Also try plain text URL pattern
	const textMatch = htmlBody.match(/(https?:\/\/[^\s<>"]*reset-password[^\s<>"]*)/);
	if (textMatch) {
		const url = textMatch[1];
		try {
			const urlObj = new URL(url);
			const pathMatch = urlObj.pathname.match(/\/reset-password\/([a-zA-Z0-9_-]+)/);
			if (pathMatch || urlObj.searchParams.has('token')) {
				return url;
			}
		} catch {
			// Invalid URL
		}
	}

	return null;
}
