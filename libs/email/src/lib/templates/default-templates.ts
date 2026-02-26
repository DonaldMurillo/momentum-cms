import type { EmailBlock } from '../../types';

/**
 * Default email blocks for the password reset template.
 *
 * Uses `{{variable}}` syntax for dynamic values:
 * - `{{greeting}}` — "Hi Name," or "Hi,"
 * - `{{url}}` — Password reset URL
 * - `{{expiresIn}}` — Expiration time (e.g., "1 hour")
 * - `{{appName}}` — Application name
 */
export const DEFAULT_PASSWORD_RESET_BLOCKS: EmailBlock[] = [
	{
		id: 'pr-header',
		type: 'header',
		data: {
			title: 'Reset Your Password',
			subtitle: '',
			alignment: 'left',
		},
	},
	{
		id: 'pr-greeting',
		type: 'text',
		data: {
			content: '{{greeting}}',
			fontSize: 16,
			color: '#3f3f46',
			alignment: 'left',
		},
	},
	{
		id: 'pr-body',
		type: 'text',
		data: {
			content:
				'We received a request to reset your password. Click the button below to choose a new password:',
			fontSize: 16,
			color: '#3f3f46',
			alignment: 'left',
		},
	},
	{
		id: 'pr-button',
		type: 'button',
		data: {
			label: 'Reset Password',
			href: '{{url}}',
			backgroundColor: '#18181b',
			color: '#ffffff',
			alignment: 'center',
		},
	},
	{
		id: 'pr-expiry',
		type: 'text',
		data: {
			content: 'This link will expire in {{expiresIn}}.',
			fontSize: 14,
			color: '#71717a',
			alignment: 'left',
		},
	},
	{
		id: 'pr-ignore',
		type: 'text',
		data: {
			content:
				"If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.",
			fontSize: 14,
			color: '#71717a',
			alignment: 'left',
		},
	},
	{
		id: 'pr-divider',
		type: 'divider',
		data: {
			color: '#e4e4e7',
			margin: '24px 0',
		},
	},
	{
		id: 'pr-footer',
		type: 'footer',
		data: {
			text: 'The {{appName}} Team',
			color: '#71717a',
		},
	},
];

/**
 * Default email blocks for the email verification template.
 *
 * Uses `{{variable}}` syntax for dynamic values:
 * - `{{greeting}}` — "Hi Name," or "Hi,"
 * - `{{url}}` — Verification URL
 * - `{{expiresIn}}` — Expiration time (e.g., "24 hours")
 * - `{{appName}}` — Application name
 */
export const DEFAULT_VERIFICATION_BLOCKS: EmailBlock[] = [
	{
		id: 'ev-header',
		type: 'header',
		data: {
			title: 'Verify Your Email',
			subtitle: '',
			alignment: 'left',
		},
	},
	{
		id: 'ev-greeting',
		type: 'text',
		data: {
			content: '{{greeting}}',
			fontSize: 16,
			color: '#3f3f46',
			alignment: 'left',
		},
	},
	{
		id: 'ev-body',
		type: 'text',
		data: {
			content:
				'Welcome to {{appName}}! Please verify your email address by clicking the button below:',
			fontSize: 16,
			color: '#3f3f46',
			alignment: 'left',
		},
	},
	{
		id: 'ev-button',
		type: 'button',
		data: {
			label: 'Verify Email',
			href: '{{url}}',
			backgroundColor: '#18181b',
			color: '#ffffff',
			alignment: 'center',
		},
	},
	{
		id: 'ev-expiry',
		type: 'text',
		data: {
			content: 'This link will expire in {{expiresIn}}.',
			fontSize: 14,
			color: '#71717a',
			alignment: 'left',
		},
	},
	{
		id: 'ev-ignore',
		type: 'text',
		data: {
			content: "If you didn't create an account, you can safely ignore this email.",
			fontSize: 14,
			color: '#71717a',
			alignment: 'left',
		},
	},
	{
		id: 'ev-divider',
		type: 'divider',
		data: {
			color: '#e4e4e7',
			margin: '24px 0',
		},
	},
	{
		id: 'ev-footer',
		type: 'footer',
		data: {
			text: 'The {{appName}} Team',
			color: '#71717a',
		},
	},
];
