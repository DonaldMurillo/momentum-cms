import {
	DEFAULT_PASSWORD_RESET_BLOCKS,
	DEFAULT_VERIFICATION_BLOCKS,
} from '@momentumcms/email/templates';

/**
 * Default seed data for the `email-templates` collection.
 *
 * These system templates are seeded on first run and can be customized
 * by admins through the visual email builder.
 *
 * Usage in app config:
 * ```typescript
 * import { emailTemplateSeedData } from '@momentumcms/plugins/email';
 *
 * seeding: {
 *   collections: {
 *     'email-templates': { data: emailTemplateSeedData, onConflict: 'skip' },
 *   },
 * }
 * ```
 */
export const emailTemplateSeedData: Record<string, unknown>[] = [
	{
		name: 'Password Reset',
		slug: 'password-reset',
		subject: 'Reset your password - {{appName}}',
		emailBlocks: DEFAULT_PASSWORD_RESET_BLOCKS,
		isSystem: true,
	},
	{
		name: 'Email Verification',
		slug: 'verification',
		subject: 'Verify your email - {{appName}}',
		emailBlocks: DEFAULT_VERIFICATION_BLOCKS,
		isSystem: true,
	},
];
