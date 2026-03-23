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
 * Returns null if no template is found (falls back to plain HTML rendering).
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
 * Returns null if the template has no blocks (falls back to plain HTML).
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
		'@momentumcms/email/server'
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

/** Shared email wrapper for plain HTML fallback templates. */
function emailWrapper(body: string): string {
	return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f4f5"><table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;padding:40px">${body}</table></td></tr></table></body></html>`;
}

function generatePasswordResetHtml(
	escape: (s: string) => string,
	opts: { name?: string; url: string; appName: string; expiresIn: string },
): string {
	const greeting = opts.name ? `Hi ${escape(opts.name)},` : 'Hi,';
	return emailWrapper(`
<tr><td style="font-size:16px;line-height:1.6;color:#1a1a1a">
<p>${greeting}</p>
<p>We received a request to reset your password. Click the button below to choose a new password:</p>
<p style="text-align:center;padding:20px 0"><a href="${escape(opts.url)}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">Reset Password</a></p>
<p style="font-size:14px;color:#6b7280">This link will expire in ${escape(opts.expiresIn)}.</p>
<p style="font-size:14px;color:#6b7280">If you didn&rsquo;t request a password reset, you can safely ignore this email.</p>
<p>Thanks,<br>The ${escape(opts.appName)} Team</p>
</td></tr>`);
}

function generateVerificationHtml(
	escape: (s: string) => string,
	opts: { name?: string; url: string; appName: string; expiresIn: string },
): string {
	const greeting = opts.name ? `Hi ${escape(opts.name)},` : 'Hi,';
	return emailWrapper(`
<tr><td style="font-size:16px;line-height:1.6;color:#1a1a1a">
<p>${greeting}</p>
<p>Welcome to ${escape(opts.appName)}! Please verify your email address by clicking the button below:</p>
<p style="text-align:center;padding:20px 0"><a href="${escape(opts.url)}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">Verify Email</a></p>
<p style="font-size:14px;color:#6b7280">This link will expire in ${escape(opts.expiresIn)}.</p>
<p style="font-size:14px;color:#6b7280">If you didn&rsquo;t create an account, you can safely ignore this email.</p>
<p>Thanks,<br>The ${escape(opts.appName)} Team</p>
</td></tr>`);
}

/**
 * Generate password reset email content.
 *
 * If `findEmailTemplate` is provided, queries the DB for a 'password-reset' template first.
 * Falls back to plain HTML rendering if no DB template is found.
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
				'[momentum:email] Failed to render DB template for password-reset, falling back:',
				error,
			);
		}
	}

	// Fallback: generate plain HTML without Angular SSR.
	// Angular SSR (renderEmail) requires @angular/compiler which is not available
	// in Nitro/Rollup server builds. Use server-safe utilities instead.
	const { escapeHtml } = await import('@momentumcms/email/server');
	const html = generatePasswordResetHtml(escapeHtml, { name, url, appName, expiresIn });

	return { subject: defaultSubject, text: defaultText, html };
}

/**
 * Generate email verification email content.
 *
 * If `findEmailTemplate` is provided, queries the DB for a 'verification' template first.
 * Falls back to plain HTML rendering if no DB template is found.
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
				'[momentum:email] Failed to render DB template for verification, falling back:',
				error,
			);
		}
	}

	// Fallback: generate plain HTML without Angular SSR.
	// Angular SSR (renderEmail) requires @angular/compiler which is not available
	// in Nitro/Rollup server builds. Use server-safe utilities instead.
	const { escapeHtml } = await import('@momentumcms/email/server');
	const html = generateVerificationHtml(escapeHtml, { name, url, appName, expiresIn });

	return { subject: defaultSubject, text: defaultText, html };
}
