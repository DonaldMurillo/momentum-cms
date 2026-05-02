/**
 * MCP Prompts — AI-friendly prompt templates for content operations.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MomentumConfig } from '@momentumcms/core';
import type { MomentumAPI } from '@momentumcms/plugins/core';
import { serializeCollection } from '../schema-serializer';

export function registerContentPrompts(
	server: McpServer,
	getConfig: () => MomentumConfig,
	getApi: () => MomentumAPI | null,
	isCollectionAllowed: (slug: string) => boolean,
): void {
	server.registerPrompt(
		'create_content',
		{
			description: 'Generate content for a CMS collection based on its field schema',
			argsSchema: {
				collection: z.string().describe('Collection slug to create content for'),
				topic: z.string().optional().describe('Topic or subject for the content'),
				tone: z.string().optional().describe('Desired tone (e.g. "formal", "casual", "technical")'),
			},
		},
		(args) => {
			const config = getConfig();

			if (!isCollectionAllowed(args.collection)) {
				return {
					messages: [
						{
							role: 'user',
							content: {
								type: 'text',
								text: `Collection "${args.collection}" is not accessible via MCP`,
							},
						},
					],
				};
			}

			const collection = (config.collections ?? []).find((c) => c.slug === args.collection);
			if (!collection) {
				return {
					messages: [
						{
							role: 'user',
							content: { type: 'text', text: `Collection "${args.collection}" not found` },
						},
					],
				};
			}

			const schema = serializeCollection(collection);
			const topicLine = args.topic ? `\nTopic: ${args.topic}` : '';
			const toneLine = args.tone ? `\nTone: ${args.tone}` : '';

			return {
				messages: [
					{
						role: 'user',
						content: {
							type: 'text',
							text: `Create content for the "${args.collection}" collection in a CMS.${topicLine}${toneLine}

Here is the collection schema — generate a JSON object matching these fields:

${JSON.stringify(schema, null, 2)}

Return ONLY the JSON document data (no markdown, no explanation). The JSON should be valid input for the create_document tool.`,
						},
					},
				],
			};
		},
	);

	server.registerPrompt(
		'translate_content',
		{
			description: 'Translate a CMS document into another language',
			argsSchema: {
				collection: z.string().describe('Collection slug'),
				id: z.string().describe('Document ID to translate'),
				targetLanguage: z
					.string()
					.describe('Target language (e.g. "Spanish", "French", "Japanese")'),
			},
		},
		async (args) => {
			const api = getApi();
			if (!api) {
				return {
					messages: [
						{
							role: 'user',
							content: { type: 'text', text: 'CMS API not ready' },
						},
					],
				};
			}

			if (!isCollectionAllowed(args.collection)) {
				return {
					messages: [
						{
							role: 'user',
							content: {
								type: 'text',
								text: `Collection "${args.collection}" is not accessible via MCP`,
							},
						},
					],
				};
			}

			try {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- MomentumAPI.collection() returns dynamic shape
				const ops = api.collection(args.collection) as {
					findById(id: string, opts: Record<string, unknown>): Promise<unknown>;
				};
				const doc = await ops.findById(args.id, { depth: 0 });

				return {
					messages: [
						{
							role: 'user',
							content: {
								type: 'text',
								text: `Translate the following CMS document content into ${args.targetLanguage}.

Original document (collection: "${args.collection}"):
${JSON.stringify(doc, null, 2)}

Translate all text content fields (text, textarea, richText) while preserving:
- Field names (keys) unchanged
- Non-text values (numbers, booleans, IDs, dates) unchanged
- JSON structure intact

Return ONLY the translated JSON document data.`,
							},
						},
					],
				};
			} catch (err) {
				return {
					messages: [
						{
							role: 'user',
							content: {
								type: 'text',
								text: `Error fetching document: ${err instanceof Error ? err.message : String(err)}`,
							},
						},
					],
				};
			}
		},
	);
}
