import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Email configuration options.
 */
export interface EmailConfig {
	/** SMTP server hostname (default: localhost) */
	host?: string;
	/** SMTP server port (default: 1025 for Mailpit) */
	port?: number;
	/** Sender email address */
	from?: string;
	/** Use TLS/SSL (default: false for local dev) */
	secure?: boolean;
	/** SMTP authentication credentials */
	auth?: {
		user: string;
		pass: string;
	};
}

/**
 * Options for sending an email.
 */
export interface SendEmailOptions {
	/** Recipient email address */
	to: string;
	/** Email subject line */
	subject: string;
	/** Plain text body */
	text: string;
	/** HTML body (optional) */
	html?: string;
}

/**
 * Email service for sending transactional emails.
 */
export interface EmailService {
	/**
	 * Send an email.
	 * @param options Email options (to, subject, text, html)
	 */
	sendEmail(options: SendEmailOptions): Promise<void>;
}

/**
 * Get email configuration from environment variables.
 */
function getEnvConfig(): Partial<EmailConfig> {
	const config: Partial<EmailConfig> = {};

	if (process.env['SMTP_HOST']) {
		config.host = process.env['SMTP_HOST'];
	}
	if (process.env['SMTP_PORT']) {
		config.port = parseInt(process.env['SMTP_PORT'], 10);
	}
	if (process.env['SMTP_FROM']) {
		config.from = process.env['SMTP_FROM'];
	}
	if (process.env['SMTP_SECURE']) {
		config.secure = process.env['SMTP_SECURE'] === 'true';
	}
	if (process.env['SMTP_USER'] && process.env['SMTP_PASS']) {
		config.auth = {
			user: process.env['SMTP_USER'],
			pass: process.env['SMTP_PASS'],
		};
	}

	return config;
}

/**
 * Create an email service with SMTP transport.
 *
 * Configuration is merged in order of priority:
 * 1. Explicit config passed to this function
 * 2. Environment variables (SMTP_HOST, SMTP_PORT, etc.)
 * 3. Default values (Mailpit on localhost:1025)
 *
 * @example
 * ```typescript
 * // Use environment variables or defaults
 * const emailService = createEmailService();
 *
 * // Or provide explicit config
 * const emailService = createEmailService({
 *   host: 'smtp.example.com',
 *   port: 587,
 *   secure: true,
 *   auth: { user: 'apikey', pass: 'your-api-key' },
 *   from: 'noreply@example.com',
 * });
 *
 * await emailService.sendEmail({
 *   to: 'user@example.com',
 *   subject: 'Password Reset',
 *   text: 'Click here to reset your password...',
 *   html: '<p>Click <a href="...">here</a> to reset your password.</p>',
 * });
 * ```
 */
export function createEmailService(config?: EmailConfig): EmailService {
	const envConfig = getEnvConfig();

	// Merge configs: explicit > env > defaults
	const finalConfig: Required<Omit<EmailConfig, 'auth'>> & Pick<EmailConfig, 'auth'> = {
		host: config?.host ?? envConfig.host ?? 'localhost',
		port: config?.port ?? envConfig.port ?? 1025,
		from: config?.from ?? envConfig.from ?? 'noreply@momentum.local',
		secure: config?.secure ?? envConfig.secure ?? false,
		auth: config?.auth ?? envConfig.auth,
	};

	// Create nodemailer transporter with SMTP options
	interface SMTPTransportOptions {
		host: string;
		port: number;
		secure: boolean;
		auth?: { user: string; pass: string };
	}

	const transportOptions: SMTPTransportOptions = {
		host: finalConfig.host,
		port: finalConfig.port,
		secure: finalConfig.secure,
	};

	// Only add auth if credentials are provided
	if (finalConfig.auth) {
		transportOptions.auth = finalConfig.auth;
	}

	const transporter: Transporter = nodemailer.createTransport(transportOptions);

	return {
		async sendEmail(options: SendEmailOptions): Promise<void> {
			await transporter.sendMail({
				from: finalConfig.from,
				to: options.to,
				subject: options.subject,
				text: options.text,
				html: options.html,
			});
		},
	};
}

/**
 * Type for the email service instance.
 */
export type MomentumEmailService = ReturnType<typeof createEmailService>;
