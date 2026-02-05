/**
 * Escape HTML special characters to prevent XSS in email templates.
 */
function escapeHtml(unsafe: string): string {
	return unsafe
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

/**
 * Email template options.
 */
interface EmailTemplateOptions {
	/** Recipient's name */
	name?: string;
	/** Action URL (reset link, verification link, etc.) */
	url: string;
	/** Application name (default: 'Momentum CMS') */
	appName?: string;
	/** Expiration time for the link (e.g., '1 hour') */
	expiresIn?: string;
}

/**
 * Base email wrapper with consistent styling.
 */
function wrapEmail(content: string, safeAppName: string): string {
	return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeAppName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px;">
              ${content}
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; margin: 20px auto 0;">
          <tr>
            <td style="text-align: center; color: #71717a; font-size: 12px;">
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} ${safeAppName}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

/**
 * Generate password reset email content.
 *
 * @example
 * ```typescript
 * const { subject, text, html } = getPasswordResetEmail({
 *   name: 'John',
 *   url: 'https://example.com/admin/reset-password?token=abc123',
 *   expiresIn: '1 hour',
 * });
 * ```
 */
export function getPasswordResetEmail(options: EmailTemplateOptions): {
	subject: string;
	text: string;
	html: string;
} {
	const { name, url, appName = 'Momentum CMS', expiresIn = '1 hour' } = options;
	const greeting = name ? `Hi ${name},` : 'Hi,';

	const subject = `Reset your password - ${appName}`;

	const text = `
${greeting}

We received a request to reset your password. Click the link below to choose a new password:

${url}

This link will expire in ${expiresIn}.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

Thanks,
The ${appName} Team
`.trim();

	// Escape user-supplied values for safe HTML interpolation
	const safeGreeting = name ? `Hi ${escapeHtml(name)},` : 'Hi,';
	const safeUrl = escapeHtml(url);
	const safeAppName = escapeHtml(appName);
	const safeExpiresIn = escapeHtml(expiresIn);

	const html = wrapEmail(
		`
      <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 600; color: #18181b;">Reset your password</h1>
      <p style="margin: 0 0 16px; color: #3f3f46;">${safeGreeting}</p>
      <p style="margin: 0 0 24px; color: #3f3f46;">We received a request to reset your password. Click the button below to choose a new password:</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 0 0 24px;">
            <a href="${safeUrl}" style="display: inline-block; padding: 12px 24px; background-color: #18181b; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">Reset Password</a>
          </td>
        </tr>
      </table>
      <p style="margin: 0 0 8px; color: #71717a; font-size: 14px;">This link will expire in ${safeExpiresIn}.</p>
      <p style="margin: 0 0 24px; color: #71717a; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;">
      <p style="margin: 0; color: #71717a; font-size: 12px;">If the button doesn't work, copy and paste this URL into your browser:</p>
      <p style="margin: 8px 0 0; color: #71717a; font-size: 12px; word-break: break-all;">${safeUrl}</p>
    `,
		safeAppName,
	);

	return { subject, text, html };
}

/**
 * Generate email verification email content.
 *
 * @example
 * ```typescript
 * const { subject, text, html } = getVerificationEmail({
 *   name: 'John',
 *   url: 'https://example.com/admin/verify-email?token=abc123',
 *   expiresIn: '24 hours',
 * });
 * ```
 */
export function getVerificationEmail(options: EmailTemplateOptions): {
	subject: string;
	text: string;
	html: string;
} {
	const { name, url, appName = 'Momentum CMS', expiresIn = '24 hours' } = options;
	const greeting = name ? `Hi ${name},` : 'Hi,';

	const subject = `Verify your email - ${appName}`;

	const text = `
${greeting}

Welcome to ${appName}! Please verify your email address by clicking the link below:

${url}

This link will expire in ${expiresIn}.

If you didn't create an account, you can safely ignore this email.

Thanks,
The ${appName} Team
`.trim();

	// Escape user-supplied values for safe HTML interpolation
	const safeGreeting = name ? `Hi ${escapeHtml(name)},` : 'Hi,';
	const safeUrl = escapeHtml(url);
	const safeAppName = escapeHtml(appName);
	const safeExpiresIn = escapeHtml(expiresIn);

	const html = wrapEmail(
		`
      <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 600; color: #18181b;">Verify your email</h1>
      <p style="margin: 0 0 16px; color: #3f3f46;">${safeGreeting}</p>
      <p style="margin: 0 0 24px; color: #3f3f46;">Welcome to ${safeAppName}! Please verify your email address by clicking the button below:</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 0 0 24px;">
            <a href="${safeUrl}" style="display: inline-block; padding: 12px 24px; background-color: #18181b; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">Verify Email</a>
          </td>
        </tr>
      </table>
      <p style="margin: 0 0 8px; color: #71717a; font-size: 14px;">This link will expire in ${safeExpiresIn}.</p>
      <p style="margin: 0 0 24px; color: #71717a; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;">
      <p style="margin: 0; color: #71717a; font-size: 12px;">If the button doesn't work, copy and paste this URL into your browser:</p>
      <p style="margin: 8px 0 0; color: #71717a; font-size: 12px; word-break: break-all;">${safeUrl}</p>
    `,
		safeAppName,
	);

	return { subject, text, html };
}
