import type { PasswordResetEmailData } from './email-components/password-reset-email.component';
import type { VerificationEmailData } from './email-components/verification-email.component';

/**
 * Result of looking up an email template from the database.
 * Returned by `findEmailTemplate` callbacks.
 */
export interface DbEmailTemplate {
	subject?: string;
	emailBlocks?: unknown[];
}

/**
 * Callback type for looking up email templates from the database.
 * Returns null if no template is found (falls back to Angular SSR rendering).
 */
export type FindEmailTemplateFn = (slug: string) => Promise<DbEmailTemplate | null>;

/**
 * Email template options.
 */
export interface EmailTemplateOptions {
	/** Recipient's name */
	name?: string;
	/** Action URL (reset link, verification link, etc.) */
	url: string;
	/** Application name (default: 'Momentum CMS') */
	appName?: string;
	/** Expiration time for the link (e.g., '1 hour') */
	expiresIn?: string;
	/** Optional callback to look up templates from the database (DB-first). */
	findEmailTemplate?: FindEmailTemplateFn;
}

/**
 * Render an email from DB-stored blocks with variable substitution.
 * Returns null if the template has no blocks (falls back to Angular SSR).
 */
async function renderFromDbTemplate(
	template: DbEmailTemplate,
	variables: Record<string, string>,
	defaultSubject: string,
	defaultText: string,
): Promise<{ subject: string; text: string; html: string } | null> {
	if (
		!template.emailBlocks ||
		!Array.isArray(template.emailBlocks) ||
		template.emailBlocks.length === 0
	) {
		return null;
	}

	const { renderEmailFromBlocks, replaceVariables, blocksToPlainText } = await import(
		'@momentumcms/email'
	);

	const subject = template.subject ? replaceVariables(template.subject, variables) : defaultSubject;

	const blocks = template.emailBlocks; // already validated as non-empty array
	const html = renderEmailFromBlocks(
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- DB blocks stored as unknown[], narrowed by array check above
		{ blocks: blocks as never[] },
		{ variables },
	);

	// Auto-generate plain text from the rendered blocks, fall back to default
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- DB blocks stored as unknown[], narrowed by array check above
	const generatedText = blocksToPlainText(blocks as never[]);
	const text = generatedText ? replaceVariables(generatedText, variables) : defaultText;

	return { subject, text, html };
}

/**
 * Generate password reset email content.
 *
 * If `findEmailTemplate` is provided, queries the DB for a 'password-reset' template first.
 * Falls back to Angular SSR rendering if no DB template is found.
 *
 * @example
 * ```typescript
 * const { subject, text, html } = await getPasswordResetEmail({
 *   name: 'John',
 *   url: 'https://example.com/admin/reset-password?token=abc123',
 *   expiresIn: '1 hour',
 * });
 * ```
 */
export async function getPasswordResetEmail(options: EmailTemplateOptions): Promise<{
	subject: string;
	text: string;
	html: string;
}> {
	const { name, url, appName = 'Momentum CMS', expiresIn = '1 hour' } = options;
	const greeting = name ? `Hi ${name},` : 'Hi,';

	const defaultSubject = `Reset your password - ${appName}`;

	const defaultText = `
${greeting}

We received a request to reset your password. Click the link below to choose a new password:

${url}

This link will expire in ${expiresIn}.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

Thanks,
The ${appName} Team
`.trim();

	// Try DB-first if a template finder is provided
	if (options.findEmailTemplate) {
		try {
			const template = await options.findEmailTemplate('password-reset');
			if (template) {
				const variables = { greeting, url, appName, expiresIn };
				const result = await renderFromDbTemplate(template, variables, defaultSubject, defaultText);
				if (result) return result;
			}
		} catch (error) {
			console.warn(
				'[momentum:email] Failed to render DB template for password-reset, falling back to SSR:',
				error,
			);
		}
	}

	// Dynamic imports to avoid loading Angular decorators at module evaluation time.
	// The generator (tsx) loads momentum.config.ts → auth → this file, and Angular
	// JIT is not available in that context.
	const { renderEmail } = await import('@momentumcms/email');
	const { PasswordResetEmailComponent } = await import(
		'./email-components/password-reset-email.component'
	);

	const data: PasswordResetEmailData = { name, url, appName, expiresIn };
	const html = await renderEmail(PasswordResetEmailComponent, data);

	return { subject: defaultSubject, text: defaultText, html };
}

/**
 * Generate email verification email content.
 *
 * If `findEmailTemplate` is provided, queries the DB for a 'verification' template first.
 * Falls back to Angular SSR rendering if no DB template is found.
 *
 * @example
 * ```typescript
 * const { subject, text, html } = await getVerificationEmail({
 *   name: 'John',
 *   url: 'https://example.com/admin/verify-email?token=abc123',
 *   expiresIn: '24 hours',
 * });
 * ```
 */
export async function getVerificationEmail(options: EmailTemplateOptions): Promise<{
	subject: string;
	text: string;
	html: string;
}> {
	const { name, url, appName = 'Momentum CMS', expiresIn = '24 hours' } = options;
	const greeting = name ? `Hi ${name},` : 'Hi,';

	const defaultSubject = `Verify your email - ${appName}`;

	const defaultText = `
${greeting}

Welcome to ${appName}! Please verify your email address by clicking the link below:

${url}

This link will expire in ${expiresIn}.

If you didn't create an account, you can safely ignore this email.

Thanks,
The ${appName} Team
`.trim();

	// Try DB-first if a template finder is provided
	if (options.findEmailTemplate) {
		try {
			const template = await options.findEmailTemplate('verification');
			if (template) {
				const variables = { greeting, url, appName, expiresIn };
				const result = await renderFromDbTemplate(template, variables, defaultSubject, defaultText);
				if (result) return result;
			}
		} catch (error) {
			console.warn(
				'[momentum:email] Failed to render DB template for verification, falling back to SSR:',
				error,
			);
		}
	}

	const { renderEmail } = await import('@momentumcms/email');
	const { VerificationEmailComponent } = await import(
		'./email-components/verification-email.component'
	);

	const data: VerificationEmailData = { name, url, appName, expiresIn };
	const html = await renderEmail(VerificationEmailComponent, data);

	return { subject: defaultSubject, text: defaultText, html };
}
