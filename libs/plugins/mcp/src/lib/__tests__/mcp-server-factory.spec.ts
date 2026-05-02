import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { McpPluginConfig } from '../mcp-plugin.types';
import type { MomentumConfig } from '@momentumcms/core';
import type { MomentumAPI } from '@momentumcms/plugins/core';

// Spy on McpServer.prototype.registerTool to track registrations
const registerToolSpy = vi.fn();
const registerResourceSpy = vi.fn();
const registerPromptSpy = vi.fn();

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
	McpServer: class MockMcpServer {
		registerTool = registerToolSpy;
		registerResource = registerResourceSpy;
		registerPrompt = registerPromptSpy;
		constructor(public _serverInfo: { name: string; version: string }) {}
	},
}));

// Mock resources and prompts registration to isolate tool testing
vi.mock('../resources/schema-resources', () => ({
	registerSchemaResources: vi.fn(),
}));
vi.mock('../prompts/content-prompts', () => ({
	registerContentPrompts: vi.fn(),
}));

// Must import AFTER mocks
const { createMcpServerInstance } = await import('../mcp-server-factory');
const { registerSchemaResources } = await import('../resources/schema-resources');

function makeGetConfig(): () => MomentumConfig {
	return () => ({ collections: [], globals: [] }) as unknown as MomentumConfig;
}

function makeGetApi(): () => MomentumAPI | null {
	return () =>
		({
			collection: vi.fn(),
			global: vi.fn(),
			getConfig: vi.fn().mockReturnValue({ collections: [], globals: [] }),
			setContext: vi.fn().mockReturnThis(),
		}) as unknown as MomentumAPI;
}

const allowAll = () => true;

function getRegisteredToolNames(config: McpPluginConfig): string[] {
	registerToolSpy.mockClear();
	createMcpServerInstance(config, makeGetApi(), makeGetConfig(), allowAll, allowAll);
	return registerToolSpy.mock.calls.map((call: unknown[]) => call[0] as string);
}

describe('createMcpServerInstance', () => {
	beforeEach(() => {
		registerToolSpy.mockClear();
		registerResourceSpy.mockClear();
		registerPromptSpy.mockClear();
	});

	it('should always register schema tools', () => {
		const tools = getRegisteredToolNames({});
		expect(tools).toContain('list_collections');
		expect(tools).toContain('get_collection_schema');
	});

	it('should register read tools by default', () => {
		const tools = getRegisteredToolNames({});
		expect(tools).toContain('find_documents');
		expect(tools).toContain('get_document');
		expect(tools).toContain('search_documents');
		expect(tools).toContain('count_documents');
	});

	it('should NOT register read tools when read is disabled', () => {
		const tools = getRegisteredToolNames({ tools: { read: false } });
		expect(tools).not.toContain('find_documents');
		expect(tools).not.toContain('get_document');
		expect(tools).not.toContain('search_documents');
		expect(tools).not.toContain('count_documents');
	});

	it('should NOT register write tools by default', () => {
		const tools = getRegisteredToolNames({});
		expect(tools).not.toContain('create_document');
		expect(tools).not.toContain('update_document');
		expect(tools).not.toContain('delete_document');
	});

	it('should register write tools when explicitly enabled', () => {
		const tools = getRegisteredToolNames({ tools: { write: true } });
		expect(tools).toContain('create_document');
		expect(tools).toContain('update_document');
		expect(tools).toContain('delete_document');
	});

	it('should register global tools by default', () => {
		const tools = getRegisteredToolNames({});
		expect(tools).toContain('list_globals');
		expect(tools).toContain('get_global');
	});

	it('should NOT register global tools when disabled', () => {
		const tools = getRegisteredToolNames({ tools: { globals: false } });
		expect(tools).not.toContain('list_globals');
		expect(tools).not.toContain('get_global');
	});

	it('should register update_global only when both globals and write are enabled', () => {
		const globalsOnly = getRegisteredToolNames({ tools: { globals: true } });
		expect(globalsOnly).not.toContain('update_global');

		const both = getRegisteredToolNames({ tools: { globals: true, write: true } });
		expect(both).toContain('update_global');
	});

	it('should use custom server name and version', () => {
		const server = createMcpServerInstance(
			{ serverName: 'my-cms', serverVersion: '1.0.0' },
			makeGetApi(),
			makeGetConfig(),
			allowAll,
			allowAll,
		);
		const info = (server as unknown as { _serverInfo: { name: string; version: string } })
			._serverInfo;
		expect(info.name).toBe('my-cms');
		expect(info.version).toBe('1.0.0');
	});

	it('should set readOnlyHint annotation for read tools', () => {
		getRegisteredToolNames({});
		const findCall = registerToolSpy.mock.calls.find((c: unknown[]) => c[0] === 'find_documents');
		const opts = findCall?.[1] as { annotations?: { readOnlyHint?: boolean } };
		expect(opts?.annotations?.readOnlyHint).toBe(true);
	});

	it('should set destructiveHint annotation for delete tool', () => {
		getRegisteredToolNames({ tools: { write: true } });
		const deleteCall = registerToolSpy.mock.calls.find(
			(c: unknown[]) => c[0] === 'delete_document',
		);
		const opts = deleteCall?.[1] as { annotations?: { destructiveHint?: boolean } };
		expect(opts?.annotations?.destructiveHint).toBe(true);
	});

	it('should set destructiveHint annotation for update_global (singleton overwrite)', () => {
		getRegisteredToolNames({ tools: { globals: true, write: true } });
		const updateGlobalCall = registerToolSpy.mock.calls.find(
			(c: unknown[]) => c[0] === 'update_global',
		);
		const opts = updateGlobalCall?.[1] as { annotations?: { destructiveHint?: boolean } };
		expect(opts?.annotations?.destructiveHint).toBe(true);
	});

	it('should set destructiveHint annotation for update_document (overwrites existing fields)', () => {
		getRegisteredToolNames({ tools: { write: true } });
		const updateDocCall = registerToolSpy.mock.calls.find(
			(c: unknown[]) => c[0] === 'update_document',
		);
		if (!updateDocCall) throw new Error('update_document tool was not registered');
		const opts = updateDocCall[1] as unknown as { annotations?: { destructiveHint?: boolean } };
		expect(opts.annotations?.destructiveHint).toBe(true);
	});

	it('should NOT mark create_document as destructive (purely additive)', () => {
		getRegisteredToolNames({ tools: { write: true } });
		const createDocCall = registerToolSpy.mock.calls.find(
			(c: unknown[]) => c[0] === 'create_document',
		);
		if (!createDocCall) throw new Error('create_document tool was not registered');
		const opts = createDocCall[1] as unknown as { annotations?: { destructiveHint?: boolean } };
		expect(opts.annotations?.destructiveHint).toBe(false);
	});

	it('should pass globalsEnabled: true to schema resources by default', () => {
		createMcpServerInstance({}, makeGetApi(), makeGetConfig(), allowAll, allowAll);
		const lastCall = vi.mocked(registerSchemaResources).mock.calls.at(-1);
		expect(lastCall?.[5]).toEqual({ globalsEnabled: true });
	});

	it('should pass globalsEnabled: false to schema resources when globals tool is disabled', () => {
		createMcpServerInstance(
			{ tools: { globals: false } },
			makeGetApi(),
			makeGetConfig(),
			allowAll,
			allowAll,
		);
		const lastCall = vi.mocked(registerSchemaResources).mock.calls.at(-1);
		expect(lastCall?.[5]).toEqual({ globalsEnabled: false });
	});

	it('should forward isGlobalAllowed to schema resources', () => {
		const isGlobalAllowed = vi.fn(() => true);
		createMcpServerInstance({}, makeGetApi(), makeGetConfig(), allowAll, isGlobalAllowed);
		const lastCall = vi.mocked(registerSchemaResources).mock.calls.at(-1);
		expect(lastCall?.[4]).toBe(isGlobalAllowed);
	});
});
