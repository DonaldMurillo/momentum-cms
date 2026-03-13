import { describe, expect, it, vi } from 'vitest';
import type { EmailPluginInstance } from './email-plugin-config.types';
import { createFindEmailTemplate } from './create-find-email-template';

describe('createFindEmailTemplate', () => {
	it('uses overrideAccess when reading system email templates', async () => {
		const find = vi.fn().mockResolvedValue({
			docs: [{ subject: 'Verify {{appName}}', emailBlocks: [{ type: 'text' }] }],
		});
		const collection = vi.fn().mockReturnValue({ find });
		const setContext = vi.fn().mockReturnValue({ collection });
		const getApi = vi.fn().mockReturnValue({ setContext, collection });

		const lookup = createFindEmailTemplate({
			getApi,
		} as EmailPluginInstance);

		const result = await lookup('verification');

		expect(setContext).toHaveBeenCalledWith({ overrideAccess: true });
		expect(collection).toHaveBeenCalledWith('email-templates');
		expect(find).toHaveBeenCalledWith({
			where: { slug: { equals: 'verification' } },
			limit: 1,
		});
		expect(result).toEqual({
			subject: 'Verify {{appName}}',
			emailBlocks: [{ type: 'text' }],
		});
	});
});
