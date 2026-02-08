/**
 * Lightweight User-Agent Parser
 *
 * Extracts device type, browser name, and OS from a user-agent string.
 * Uses simple regex patterns — no external dependencies.
 */

export interface ParsedUserAgent {
	/** Device type: 'mobile', 'tablet', or 'desktop' */
	device: string;
	/** Browser name (e.g., 'Chrome', 'Firefox', 'Safari') */
	browser: string;
	/** Operating system (e.g., 'Windows', 'macOS', 'Linux', 'iOS', 'Android') */
	os: string;
}

/**
 * Parse a user-agent string into device, browser, and OS components.
 *
 * @param ua - The user-agent string to parse
 * @returns Parsed components with sensible defaults for unknown values
 */
export function parseUserAgent(ua: string | undefined): ParsedUserAgent {
	if (!ua) {
		return { device: 'unknown', browser: 'unknown', os: 'unknown' };
	}

	return {
		device: detectDevice(ua),
		browser: detectBrowser(ua),
		os: detectOS(ua),
	};
}

function detectDevice(ua: string): string {
	if (/iPad|tablet|Kindle|PlayBook/i.test(ua)) return 'tablet';
	if (/Mobile|Android.*Mobile|iPhone|iPod|Opera Mini|IEMobile/i.test(ua)) return 'mobile';
	return 'desktop';
}

function detectBrowser(ua: string): string {
	// Order matters: check more specific patterns first
	if (/Edg\//i.test(ua)) return 'Edge';
	if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return 'Opera';
	if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
	if (/UCBrowser/i.test(ua)) return 'UC Browser';
	if (/Firefox\//i.test(ua)) return 'Firefox';
	if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return 'Chrome';
	if (/Chromium\//i.test(ua)) return 'Chromium';
	if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
	if (/MSIE|Trident/i.test(ua)) return 'IE';
	return 'unknown';
}

function detectOS(ua: string): string {
	if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
	if (/Android/i.test(ua)) return 'Android';
	if (/Windows NT/i.test(ua)) return 'Windows';
	if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
	if (/CrOS/i.test(ua)) return 'ChromeOS';
	if (/Linux/i.test(ua)) return 'Linux';
	return 'unknown';
}
