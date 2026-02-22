/**
 * Extended coverage tests for RichTextFieldRenderer targeting uncovered statements.
 *
 * The base specs cover: no-formNode paths, toolbar signal defaults, toggle methods
 * with null editor, basic computed properties, formNode integration for stringValue,
 * touchedErrors, onBlur, label, disabled/required states, and fieldId.
 *
 * This file targets the remaining uncovered branches:
 * - mountEditor() initialization and guard clauses
 * - updateToolbarState() setting toolbar signals from editor state
 * - Toggle methods delegating to editor chain commands
 * - onUpdate callback (content sync from editor to formNode)
 * - onBlur callback from editor
 * - External value sync effect (setContent when stringValue changes)
 * - Edge case: empty content normalization (<p></p> -> '')
 * - DestroyRef cleanup
 *
 * Strategy: Mock TipTap Editor using vi.doMock (not vi.mock) to avoid contaminating
 * other test files. The component is dynamically imported after mocks are installed.
 */
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { createMockFieldNodeState, createMockField } from './test-helpers';

// Create a fresh mock chain factory to avoid cross-test contamination
function createMockChain(): Record<string, ReturnType<typeof vi.fn>> {
	const chain: Record<string, ReturnType<typeof vi.fn>> = {};
	const methods = [
		'focus',
		'toggleBold',
		'toggleItalic',
		'toggleUnderline',
		'toggleStrike',
		'toggleHeading',
		'toggleBulletList',
		'toggleOrderedList',
		'toggleBlockquote',
		'toggleCodeBlock',
		'setHorizontalRule',
		'setContent',
		'run',
	];
	for (const method of methods) {
		chain[method] = vi.fn().mockImplementation(() => chain);
	}
	return chain;
}

let latestMockChain: Record<string, ReturnType<typeof vi.fn>>;
let capturedOnUpdate: ((args: { editor: unknown }) => void) | undefined;
let capturedOnBlur: (() => void) | undefined;
let capturedOnSelectionUpdate: ((args: { editor: unknown }) => void) | undefined;
let capturedOnTransaction: ((args: { editor: unknown }) => void) | undefined;
let latestMockEditorInstance: Record<string, unknown>;

let RichTextFieldRenderer: any;

// Use vi.doMock instead of vi.mock to prevent contaminating other test files.
// vi.mock hoists and replaces the module for the ENTIRE worker, but vi.doMock
// only takes effect for subsequent dynamic imports within this file.
beforeAll(async () => {
	vi.resetModules();

	vi.doMock('@tiptap/core', () => {
		class MockEditor {
			[key: string]: unknown;
			isDestroyed = false;
			getHTML = vi.fn().mockReturnValue('<p></p>');
			isActive = vi.fn().mockReturnValue(false);
			chain = vi.fn();
			commands = { setContent: vi.fn() };
			destroy = vi.fn();

			constructor(options: Record<string, unknown>) {
				capturedOnUpdate = options['onUpdate'] as typeof capturedOnUpdate;
				capturedOnBlur = options['onBlur'] as typeof capturedOnBlur;
				capturedOnSelectionUpdate = options[
					'onSelectionUpdate'
				] as typeof capturedOnSelectionUpdate;
				capturedOnTransaction = options['onTransaction'] as typeof capturedOnTransaction;

				latestMockChain = createMockChain();
				this.chain = vi.fn().mockImplementation(() => latestMockChain);

				// eslint-disable-next-line @typescript-eslint/no-this-alias
				latestMockEditorInstance = this;
			}
		}

		return { Editor: MockEditor };
	});

	vi.doMock('@tiptap/starter-kit', () => ({
		default: { configure: vi.fn().mockReturnValue({}) },
	}));

	vi.doMock('@tiptap/extension-underline', () => ({
		default: {},
	}));

	vi.doMock('@tiptap/extension-link', () => ({
		default: { configure: vi.fn().mockReturnValue({}) },
	}));

	vi.doMock('@tiptap/extension-placeholder', () => ({
		default: { configure: vi.fn().mockReturnValue({}) },
	}));

	// Import the component AFTER mocks are installed
	const mod = await import('../rich-text-field.component');
	RichTextFieldRenderer = mod.RichTextFieldRenderer;
});

afterAll(() => {
	vi.doUnmock('@tiptap/core');
	vi.doUnmock('@tiptap/starter-kit');
	vi.doUnmock('@tiptap/extension-underline');
	vi.doUnmock('@tiptap/extension-link');
	vi.doUnmock('@tiptap/extension-placeholder');
	vi.resetModules();
});

@Component({ selector: 'mcms-form-field', template: '' })
class MockFormField {}

/**
 * Helper to set up the component with a formNode and an editor element ref.
 * Optionally triggers mountEditor manually to get the mock editor assigned.
 */
async function setup(options: {
	fieldOverrides?: Record<string, unknown>;
	initialValue?: unknown;
	formNodeOptions?: {
		errors?: ReadonlyArray<{ kind: string; message?: string }>;
		touched?: boolean;
		dirty?: boolean;
		invalid?: boolean;
	};
	mode?: 'create' | 'edit' | 'view';
	path?: string;
	skipFormNode?: boolean;
	mountEditor?: boolean;
}): Promise<{
	fixture: ComponentFixture<unknown>;
	component: Record<string, unknown>;
	mock: ReturnType<typeof createMockFieldNodeState>;
}> {
	// Reset captured callbacks
	capturedOnUpdate = undefined;
	capturedOnBlur = undefined;
	capturedOnSelectionUpdate = undefined;
	capturedOnTransaction = undefined;

	const mock = createMockFieldNodeState(options.initialValue ?? '', options.formNodeOptions);

	await TestBed.configureTestingModule({
		imports: [RichTextFieldRenderer],
	})
		.overrideComponent(RichTextFieldRenderer, {
			set: {
				imports: [MockFormField],
				// Provide a template with the #editorElement ref
				template: '<div #editorElement></div>',
			},
		})
		.compileComponents();

	const fixture = TestBed.createComponent(RichTextFieldRenderer);
	const component = fixture.componentInstance;

	const field = createMockField('richText', options.fieldOverrides);
	fixture.componentRef.setInput('field', field);
	fixture.componentRef.setInput('path', options.path ?? 'content');

	if (!options.skipFormNode) {
		fixture.componentRef.setInput('formNode', mock.node);
	}

	if (options.mode) {
		fixture.componentRef.setInput('mode', options.mode);
	}

	fixture.detectChanges();

	// Manually call mountEditor if requested (simulating afterNextRender)
	if (options.mountEditor) {
		(component as any).mountEditor();
	}

	return { fixture, component: component as any, mock };
}

describe('RichTextFieldRenderer (coverage - editor integration)', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	// ------------------------------------------------------------------
	// mountEditor guard: should NOT mount when disabled (view mode)
	// ------------------------------------------------------------------
	describe('mountEditor guard - disabled state', () => {
		it('should not create editor when in view mode', async () => {
			const { component } = await setup({ mode: 'view', mountEditor: true });
			expect((component as Record<string, () => boolean>)['editorReady']()).toBe(false);
		});

		it('should not create editor when field is readOnly', async () => {
			const { component } = await setup({
				fieldOverrides: { admin: { readOnly: true } },
				mountEditor: true,
			});
			expect((component as Record<string, () => boolean>)['editorReady']()).toBe(false);
		});

		it('should set editorReady to true when mountEditor succeeds', async () => {
			const { component } = await setup({ mountEditor: true });
			expect((component as Record<string, () => boolean>)['editorReady']()).toBe(true);
		});

		it('should not mount twice if called again', async () => {
			const { component } = await setup({ mountEditor: true });
			expect((component as Record<string, () => boolean>)['editorReady']()).toBe(true);

			// Store reference to current editor
			const firstEditor = latestMockEditorInstance;

			// Call mountEditor again - should return early because editor already exists

			(component as any).mountEditor();

			// latestMockEditorInstance should not change since no new Editor was created
			expect(latestMockEditorInstance).toBe(firstEditor);
		});
	});

	// ------------------------------------------------------------------
	// Toggle methods with mounted editor
	// ------------------------------------------------------------------
	describe('toggle methods delegating to editor chain', () => {
		it('toggleBold should call editor chain focus toggleBold run', async () => {
			const { component } = await setup({ mountEditor: true });
			(component as Record<string, () => void>)['toggleBold']();
			expect(latestMockChain['focus']).toHaveBeenCalled();
			expect(latestMockChain['toggleBold']).toHaveBeenCalled();
			expect(latestMockChain['run']).toHaveBeenCalled();
		});

		it('toggleItalic should call editor chain', async () => {
			const { component } = await setup({ mountEditor: true });
			(component as Record<string, () => void>)['toggleItalic']();
			expect(latestMockChain['toggleItalic']).toHaveBeenCalled();
		});

		it('toggleUnderline should call editor chain', async () => {
			const { component } = await setup({ mountEditor: true });
			(component as Record<string, () => void>)['toggleUnderline']();
			expect(latestMockChain['toggleUnderline']).toHaveBeenCalled();
		});

		it('toggleStrike should call editor chain', async () => {
			const { component } = await setup({ mountEditor: true });
			(component as Record<string, () => void>)['toggleStrike']();
			expect(latestMockChain['toggleStrike']).toHaveBeenCalled();
		});

		it('toggleHeading should call editor chain with level', async () => {
			const { component } = await setup({ mountEditor: true });
			(component as Record<string, (level: number) => void>)['toggleHeading'](2);
			expect(latestMockChain['toggleHeading']).toHaveBeenCalledWith({ level: 2 });
		});

		it('toggleBulletList should call editor chain', async () => {
			const { component } = await setup({ mountEditor: true });
			(component as Record<string, () => void>)['toggleBulletList']();
			expect(latestMockChain['toggleBulletList']).toHaveBeenCalled();
		});

		it('toggleOrderedList should call editor chain', async () => {
			const { component } = await setup({ mountEditor: true });
			(component as Record<string, () => void>)['toggleOrderedList']();
			expect(latestMockChain['toggleOrderedList']).toHaveBeenCalled();
		});

		it('toggleBlockquote should call editor chain', async () => {
			const { component } = await setup({ mountEditor: true });
			(component as Record<string, () => void>)['toggleBlockquote']();
			expect(latestMockChain['toggleBlockquote']).toHaveBeenCalled();
		});

		it('toggleCodeBlock should call editor chain', async () => {
			const { component } = await setup({ mountEditor: true });
			(component as Record<string, () => void>)['toggleCodeBlock']();
			expect(latestMockChain['toggleCodeBlock']).toHaveBeenCalled();
		});

		it('insertHorizontalRule should call editor chain', async () => {
			const { component } = await setup({ mountEditor: true });
			(component as Record<string, () => void>)['insertHorizontalRule']();
			expect(latestMockChain['setHorizontalRule']).toHaveBeenCalled();
		});
	});

	// ------------------------------------------------------------------
	// onUpdate callback: content sync from editor to formNode
	// ------------------------------------------------------------------
	describe('onUpdate: editor content synced to formNode', () => {
		it('should set non-empty HTML on formNode value', async () => {
			const { mock } = await setup({ initialValue: '', mountEditor: true });

			expect(capturedOnUpdate).toBeDefined();
			if (capturedOnUpdate) {
				const fakeEditor = {
					getHTML: vi.fn().mockReturnValue('<p>Hello world</p>'),
				};
				capturedOnUpdate({ editor: fakeEditor });
				expect(mock.state.value()).toBe('<p>Hello world</p>');
			}
		});

		it('should normalize <p></p> to empty string', async () => {
			const { mock } = await setup({ initialValue: '<p>Initial</p>', mountEditor: true });

			expect(capturedOnUpdate).toBeDefined();
			if (capturedOnUpdate) {
				const fakeEditor = {
					getHTML: vi.fn().mockReturnValue('<p></p>'),
				};
				capturedOnUpdate({ editor: fakeEditor });
				expect(mock.state.value()).toBe('');
			}
		});

		it('should not update formNode when updatingFromExternal is true', async () => {
			const { component, mock } = await setup({ initialValue: 'original', mountEditor: true });

			(component as any).updatingFromExternal = true;

			expect(capturedOnUpdate).toBeDefined();
			if (capturedOnUpdate) {
				const fakeEditor = {
					getHTML: vi.fn().mockReturnValue('<p>Should not update</p>'),
				};
				capturedOnUpdate({ editor: fakeEditor });
				expect(mock.state.value()).toBe('original');
			}
		});
	});

	// ------------------------------------------------------------------
	// onBlur callback from editor
	// ------------------------------------------------------------------
	describe('onBlur callback from editor', () => {
		it('should call markAsTouched when editor fires blur', async () => {
			const { mock } = await setup({ mountEditor: true });

			expect(capturedOnBlur).toBeDefined();
			if (capturedOnBlur) {
				capturedOnBlur();
				expect(mock.state.markAsTouched).toHaveBeenCalled();
			}
		});
	});

	// ------------------------------------------------------------------
	// updateToolbarState: sets all toolbar signals from editor
	// ------------------------------------------------------------------
	describe('updateToolbarState via onSelectionUpdate', () => {
		it('should update all toolbar signals based on editor isActive', async () => {
			const { component } = await setup({ mountEditor: true });

			const fakeEditor = {
				isActive: vi.fn().mockImplementation((type: string, opts?: Record<string, unknown>) => {
					if (type === 'bold') return true;
					if (type === 'italic') return true;
					if (type === 'heading' && opts?.['level'] === 1) return true;
					if (type === 'bulletList') return true;
					if (type === 'blockquote') return true;
					return false;
				}),
			};

			expect(capturedOnSelectionUpdate).toBeDefined();
			if (capturedOnSelectionUpdate) {
				capturedOnSelectionUpdate({ editor: fakeEditor });
				expect((component as Record<string, () => boolean>)['isBold']()).toBe(true);
				expect((component as Record<string, () => boolean>)['isItalic']()).toBe(true);
				expect((component as Record<string, () => boolean>)['isUnderline']()).toBe(false);
				expect((component as Record<string, () => boolean>)['isStrike']()).toBe(false);
				expect((component as Record<string, () => boolean>)['isHeading1']()).toBe(true);
				expect((component as Record<string, () => boolean>)['isHeading2']()).toBe(false);
				expect((component as Record<string, () => boolean>)['isHeading3']()).toBe(false);
				expect((component as Record<string, () => boolean>)['isBulletList']()).toBe(true);
				expect((component as Record<string, () => boolean>)['isOrderedList']()).toBe(false);
				expect((component as Record<string, () => boolean>)['isBlockquote']()).toBe(true);
				expect((component as Record<string, () => boolean>)['isCodeBlock']()).toBe(false);
			}
		});
	});

	describe('updateToolbarState via onTransaction', () => {
		it('should update toolbar signals on transaction', async () => {
			const { component } = await setup({ mountEditor: true });

			const fakeEditor = {
				isActive: vi.fn().mockImplementation((type: string) => {
					if (type === 'underline') return true;
					if (type === 'strike') return true;
					if (type === 'orderedList') return true;
					if (type === 'codeBlock') return true;
					return false;
				}),
			};

			expect(capturedOnTransaction).toBeDefined();
			if (capturedOnTransaction) {
				capturedOnTransaction({ editor: fakeEditor });
				expect((component as Record<string, () => boolean>)['isBold']()).toBe(false);
				expect((component as Record<string, () => boolean>)['isUnderline']()).toBe(true);
				expect((component as Record<string, () => boolean>)['isStrike']()).toBe(true);
				expect((component as Record<string, () => boolean>)['isOrderedList']()).toBe(true);
				expect((component as Record<string, () => boolean>)['isCodeBlock']()).toBe(true);
			}
		});

		it('should update heading2 and heading3 states', async () => {
			const { component } = await setup({ mountEditor: true });

			const fakeEditor = {
				isActive: vi.fn().mockImplementation((type: string, opts?: Record<string, unknown>) => {
					if (type === 'heading' && opts?.['level'] === 2) return true;
					if (type === 'heading' && opts?.['level'] === 3) return true;
					return false;
				}),
			};

			expect(capturedOnTransaction).toBeDefined();
			if (capturedOnTransaction) {
				capturedOnTransaction({ editor: fakeEditor });
				expect((component as Record<string, () => boolean>)['isHeading1']()).toBe(false);
				expect((component as Record<string, () => boolean>)['isHeading2']()).toBe(true);
				expect((component as Record<string, () => boolean>)['isHeading3']()).toBe(true);
			}
		});
	});

	// ------------------------------------------------------------------
	// stringValue with formNode (additional edge cases)
	// ------------------------------------------------------------------
	describe('stringValue edge cases', () => {
		it('should return empty string when formNode is null', async () => {
			const { component } = await setup({ skipFormNode: true });
			expect((component as Record<string, () => string>)['stringValue']()).toBe('');
		});
	});

	// ------------------------------------------------------------------
	// Destroy cleanup
	// ------------------------------------------------------------------
	describe('editor destroy on component destroy', () => {
		it('should destroy editor when component is destroyed', async () => {
			const { fixture } = await setup({ mountEditor: true });
			const destroyFn = latestMockEditorInstance['destroy'] as ReturnType<typeof vi.fn>;

			fixture.destroy();
			expect(destroyFn).toHaveBeenCalled();
		});
	});
});
