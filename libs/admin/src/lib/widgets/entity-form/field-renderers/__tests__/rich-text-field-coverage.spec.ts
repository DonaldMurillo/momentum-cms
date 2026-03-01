/**
 * Extended coverage tests for RichTextFieldRenderer targeting uncovered statements.
 *
 * Strategy: Instead of mocking TipTap at the module level (vi.mock/vi.doMock,
 * blocked by Angular 21's @nx/angular:unit-test executor), we:
 * 1. Override the template to prevent TipTap initialization
 * 2. Inject mock editor objects via private property access
 * 3. Call private methods directly to test their behavior
 *
 * This tests the same code paths as the original mock-based tests but through
 * direct property injection and method invocation.
 */
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { RichTextFieldRenderer } from '../rich-text-field.component';
import { createMockFieldNodeState, createMockField } from './test-helpers';

@Component({ selector: 'mcms-form-field', template: '' })
class MockFormField {}

/** Create a fluent mock chain for TipTap Editor commands. */
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

/** Create a mock editor object that mimics TipTap Editor's interface. */
function createMockEditor(): {
	editor: Record<string, unknown>;
	chain: Record<string, ReturnType<typeof vi.fn>>;
} {
	const chain = createMockChain();
	const editor: Record<string, unknown> = {
		isDestroyed: false,
		getHTML: vi.fn().mockReturnValue('<p></p>'),
		isActive: vi.fn().mockReturnValue(false),
		chain: vi.fn().mockImplementation(() => chain),
		commands: { setContent: vi.fn() },
		destroy: vi.fn(),
	};
	return { editor, chain };
}

async function setup(options: {
	fieldOverrides?: Record<string, unknown>;
	initialValue?: unknown;
	formNodeOptions?: {
		errors?: ReadonlyArray<{ kind: string; message?: string }>;
		touched?: boolean;
	};
	mode?: 'create' | 'edit' | 'view';
	path?: string;
	skipFormNode?: boolean;
	injectEditor?: boolean;
	template?: string;
}): Promise<{
	fixture: ComponentFixture<RichTextFieldRenderer>;
	component: RichTextFieldRenderer;
	mock: ReturnType<typeof createMockFieldNodeState>;
	mockEditor?: ReturnType<typeof createMockEditor>;
}> {
	const mock = createMockFieldNodeState(options.initialValue ?? '', options.formNodeOptions);

	await TestBed.configureTestingModule({
		imports: [RichTextFieldRenderer],
	})
		.overrideComponent(RichTextFieldRenderer, {
			set: {
				imports: [MockFormField],
				template: options.template ?? '<div></div>',
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

	let mockEditor: ReturnType<typeof createMockEditor> | undefined;
	if (options.injectEditor) {
		mockEditor = createMockEditor();
		(component as any).editor = mockEditor.editor;
	}

	return { fixture, component, mock, mockEditor };
}

describe('RichTextFieldRenderer (coverage - editor integration)', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	/** Setup with injectEditor: true, asserting mockEditor is defined. */
	async function setupWithEditor(
		options?: Omit<Parameters<typeof setup>[0], 'injectEditor'>,
	): Promise<{
		fixture: ComponentFixture<RichTextFieldRenderer>;
		component: RichTextFieldRenderer;
		mock: ReturnType<typeof createMockFieldNodeState>;
		mockEditor: ReturnType<typeof createMockEditor>;
	}> {
		const result = await setup({ ...options, injectEditor: true });
		// injectEditor: true guarantees mockEditor is set

		return result as typeof result & { mockEditor: ReturnType<typeof createMockEditor> };
	}

	// ------------------------------------------------------------------
	// mountEditor guard: should NOT mount when disabled (view mode)
	// ------------------------------------------------------------------
	describe('mountEditor guard - disabled state', () => {
		it('should not create editor when in view mode', async () => {
			const { component } = await setup({
				mode: 'view',
				template: '<div #editorElement></div>',
			});
			// afterNextRender fired, mountEditor was called, but isDisabled() is true
			// so it returned early without creating an editor
			expect(component.editorReady()).toBe(false);
		});

		it('should not create editor when field is readOnly', async () => {
			const { component } = await setup({
				fieldOverrides: { admin: { readOnly: true } },
				template: '<div #editorElement></div>',
			});
			expect(component.editorReady()).toBe(false);
		});

		it('should not replace existing editor on repeated mountEditor calls', async () => {
			const { component, mockEditor } = await setupWithEditor();
			const firstEditor = mockEditor.editor;

			// Call mountEditor again — returns early (editorRef undefined in default template,
			// AND editor already exists). Either guard prevents re-creation.
			(component as any).mountEditor();

			// Editor should still be the same mock we injected
			expect((component as any).editor).toBe(firstEditor);
		});

		it('should return early when editorRef is undefined', async () => {
			// Template has no #editorElement, so editorRef() is undefined
			const { component } = await setup({});
			// mountEditor was called by afterNextRender but returned early
			expect(component.editorReady()).toBe(false);
		});
	});

	// ------------------------------------------------------------------
	// Toggle methods with mounted editor
	// ------------------------------------------------------------------
	describe('toggle methods delegating to editor chain', () => {
		it('toggleBold should call editor chain focus toggleBold run', async () => {
			const { component, mockEditor } = await setupWithEditor();
			component.toggleBold();
			expect(mockEditor.chain['focus']).toHaveBeenCalled();
			expect(mockEditor.chain['toggleBold']).toHaveBeenCalled();
			expect(mockEditor.chain['run']).toHaveBeenCalled();
		});

		it('toggleItalic should call editor chain', async () => {
			const { component, mockEditor } = await setupWithEditor();
			component.toggleItalic();
			expect(mockEditor.chain['toggleItalic']).toHaveBeenCalled();
		});

		it('toggleUnderline should call editor chain', async () => {
			const { component, mockEditor } = await setupWithEditor();
			component.toggleUnderline();
			expect(mockEditor.chain['toggleUnderline']).toHaveBeenCalled();
		});

		it('toggleStrike should call editor chain', async () => {
			const { component, mockEditor } = await setupWithEditor();
			component.toggleStrike();
			expect(mockEditor.chain['toggleStrike']).toHaveBeenCalled();
		});

		it('toggleHeading should call editor chain with level', async () => {
			const { component, mockEditor } = await setupWithEditor();
			component.toggleHeading(2);
			expect(mockEditor.chain['toggleHeading']).toHaveBeenCalledWith({ level: 2 });
		});

		it('toggleBulletList should call editor chain', async () => {
			const { component, mockEditor } = await setupWithEditor();
			component.toggleBulletList();
			expect(mockEditor.chain['toggleBulletList']).toHaveBeenCalled();
		});

		it('toggleOrderedList should call editor chain', async () => {
			const { component, mockEditor } = await setupWithEditor();
			component.toggleOrderedList();
			expect(mockEditor.chain['toggleOrderedList']).toHaveBeenCalled();
		});

		it('toggleBlockquote should call editor chain', async () => {
			const { component, mockEditor } = await setupWithEditor();
			component.toggleBlockquote();
			expect(mockEditor.chain['toggleBlockquote']).toHaveBeenCalled();
		});

		it('toggleCodeBlock should call editor chain', async () => {
			const { component, mockEditor } = await setupWithEditor();
			component.toggleCodeBlock();
			expect(mockEditor.chain['toggleCodeBlock']).toHaveBeenCalled();
		});

		it('insertHorizontalRule should call editor chain', async () => {
			const { component, mockEditor } = await setupWithEditor();
			component.insertHorizontalRule();
			expect(mockEditor.chain['setHorizontalRule']).toHaveBeenCalled();
		});
	});

	// ------------------------------------------------------------------
	// updateToolbarState: sets all toolbar signals from editor
	// ------------------------------------------------------------------
	describe('updateToolbarState via direct invocation', () => {
		it('should update all toolbar signals based on editor isActive', async () => {
			const { component } = await setup({});

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

			(component as any).updateToolbarState(fakeEditor);

			expect(component.isBold()).toBe(true);
			expect(component.isItalic()).toBe(true);
			expect(component.isUnderline()).toBe(false);
			expect(component.isStrike()).toBe(false);
			expect(component.isHeading1()).toBe(true);
			expect(component.isHeading2()).toBe(false);
			expect(component.isHeading3()).toBe(false);
			expect(component.isBulletList()).toBe(true);
			expect(component.isOrderedList()).toBe(false);
			expect(component.isBlockquote()).toBe(true);
			expect(component.isCodeBlock()).toBe(false);
		});

		it('should set underline, strike, orderedList, codeBlock states', async () => {
			const { component } = await setup({});

			const fakeEditor = {
				isActive: vi.fn().mockImplementation((type: string) => {
					if (type === 'underline') return true;
					if (type === 'strike') return true;
					if (type === 'orderedList') return true;
					if (type === 'codeBlock') return true;
					return false;
				}),
			};

			(component as any).updateToolbarState(fakeEditor);

			expect(component.isBold()).toBe(false);
			expect(component.isUnderline()).toBe(true);
			expect(component.isStrike()).toBe(true);
			expect(component.isOrderedList()).toBe(true);
			expect(component.isCodeBlock()).toBe(true);
		});

		it('should update heading2 and heading3 states', async () => {
			const { component } = await setup({});

			const fakeEditor = {
				isActive: vi.fn().mockImplementation((type: string, opts?: Record<string, unknown>) => {
					if (type === 'heading' && opts?.['level'] === 2) return true;
					if (type === 'heading' && opts?.['level'] === 3) return true;
					return false;
				}),
			};

			(component as any).updateToolbarState(fakeEditor);

			expect(component.isHeading1()).toBe(false);
			expect(component.isHeading2()).toBe(true);
			expect(component.isHeading3()).toBe(true);
		});
	});

	// ------------------------------------------------------------------
	// onBlur with formNode and injected editor
	// ------------------------------------------------------------------
	describe('onBlur with editor present', () => {
		it('should call markAsTouched when onBlur is called', async () => {
			const { component, mock } = await setupWithEditor();
			component.onBlur();
			expect(mock.state.markAsTouched).toHaveBeenCalled();
		});
	});

	// ------------------------------------------------------------------
	// stringValue edge cases
	// ------------------------------------------------------------------
	describe('stringValue edge cases', () => {
		it('should return empty string when formNode is null', async () => {
			const { component } = await setup({ skipFormNode: true });
			expect(component.stringValue()).toBe('');
		});
	});

	// ------------------------------------------------------------------
	// Destroy cleanup
	// ------------------------------------------------------------------
	describe('editor destroy on component destroy', () => {
		it('should destroy editor when component is destroyed', async () => {
			const { fixture, mockEditor } = await setupWithEditor();
			const destroyFn = mockEditor.editor['destroy'] as ReturnType<typeof vi.fn>;

			fixture.destroy();
			expect(destroyFn).toHaveBeenCalled();
		});

		it('should set editor to null after destroy', async () => {
			const { fixture, component } = await setupWithEditor();
			expect((component as any).editor).not.toBeNull();

			fixture.destroy();
			expect((component as any).editor).toBeNull();
		});
	});
});
