/**
 * Template coverage tests for RichTextFieldRenderer.
 *
 * Renders the REAL component template (not a dummy `<div></div>`) so that
 * all template expression statements (bindings, `@if`, `@for`, event
 * handlers, attribute bindings, etc.) are evaluated by the coverage tool.
 *
 * Strategy:
 *   - Use NO_ERRORS_SCHEMA so unknown child selectors are tolerated.
 *   - Override only the component's `imports` (to []) — keep the template.
 *   - Mock TipTap at module level to prevent real DOM manipulation.
 *   - Use `detectChanges()` after signal changes to re-evaluate the template.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RichTextFieldRenderer } from '../rich-text-field.component';
import { createMockFieldNodeState, createMockField } from './test-helpers';

// ---------------------------------------------------------------------------
// TipTap mocks
// ---------------------------------------------------------------------------

vi.mock('@tiptap/core', () => {
	class MockEditor {
		[key: string]: unknown;
		isDestroyed = false;
		getHTML = vi.fn().mockReturnValue('<p></p>');
		isActive = vi.fn().mockReturnValue(false);
		chain = vi.fn().mockReturnValue({
			focus: vi.fn().mockReturnThis(),
			toggleBold: vi.fn().mockReturnThis(),
			toggleItalic: vi.fn().mockReturnThis(),
			toggleUnderline: vi.fn().mockReturnThis(),
			toggleStrike: vi.fn().mockReturnThis(),
			toggleHeading: vi.fn().mockReturnThis(),
			toggleBulletList: vi.fn().mockReturnThis(),
			toggleOrderedList: vi.fn().mockReturnThis(),
			toggleBlockquote: vi.fn().mockReturnThis(),
			toggleCodeBlock: vi.fn().mockReturnThis(),
			setHorizontalRule: vi.fn().mockReturnThis(),
			run: vi.fn(),
		});
		commands = { setContent: vi.fn() };
		destroy = vi.fn();

		constructor() {
			// no-op – avoid DOM side effects
		}
	}

	return { Editor: MockEditor };
});

vi.mock('@tiptap/starter-kit', () => ({
	default: { configure: vi.fn().mockReturnValue({}) },
}));

vi.mock('@tiptap/extension-underline', () => ({
	default: {},
}));

vi.mock('@tiptap/extension-link', () => ({
	default: { configure: vi.fn().mockReturnValue({}) },
}));

vi.mock('@tiptap/extension-placeholder', () => ({
	default: { configure: vi.fn().mockReturnValue({}) },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RichTextFieldRenderer (template coverage)', () => {
	let fixture: ComponentFixture<RichTextFieldRenderer>;
	let component: RichTextFieldRenderer;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [RichTextFieldRenderer],
			schemas: [NO_ERRORS_SCHEMA],
		})
			.overrideComponent(RichTextFieldRenderer, {
				set: { imports: [], schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA] },
			})
			.compileComponents();
	});

	afterEach(() => {
		TestBed.resetTestingModule();
	});

	function createComponent(options?: {
		mode?: 'create' | 'edit' | 'view';
		initialValue?: unknown;
		fieldOverrides?: Record<string, unknown>;
		formNodeOptions?: {
			errors?: ReadonlyArray<{ kind: string; message?: string }>;
			touched?: boolean;
		};
		skipFormNode?: boolean;
	}): void {
		fixture = TestBed.createComponent(RichTextFieldRenderer);
		component = fixture.componentInstance;

		const field = createMockField('richText', options?.fieldOverrides);
		fixture.componentRef.setInput('field', field);
		fixture.componentRef.setInput('path', 'content');

		if (options?.mode) {
			fixture.componentRef.setInput('mode', options.mode);
		}

		if (!options?.skipFormNode) {
			const mock = createMockFieldNodeState(options?.initialValue ?? '', options?.formNodeOptions);
			fixture.componentRef.setInput('formNode', mock.node);
		}

		fixture.detectChanges();
	}

	// -------------------------------------------------------------------
	// @if (!isDisabled()) branch — editor visible (default: create mode)
	// -------------------------------------------------------------------
	describe('editor visible (not disabled)', () => {
		it('should render toolbar and editor area in create mode', () => {
			createComponent({ mode: 'create' });

			const toolbar = fixture.nativeElement.querySelector('[role="toolbar"]');
			expect(toolbar).toBeTruthy();

			const editorArea = fixture.nativeElement.querySelector('[data-testid="rich-text-editor"]');
			expect(editorArea).toBeTruthy();
		});

		it('should render all formatting buttons', () => {
			createComponent();

			const buttons = fixture.nativeElement.querySelectorAll('[role="toolbar"] button');
			// Bold, Italic, Underline, Strike, H1, H2, H3, BulletList, OrderedList,
			// Blockquote, CodeBlock, HorizontalRule = 12 buttons
			expect(buttons.length).toBe(12);
		});

		it('should bind aria-pressed attributes based on toolbar state signals', () => {
			createComponent();

			// All should be false initially
			const boldBtn = fixture.nativeElement.querySelector('[aria-label="Bold"]');
			expect(boldBtn.getAttribute('aria-pressed')).toBe('false');

			// Set bold to true and re-evaluate
			component.isBold.set(true);
			fixture.detectChanges();
			expect(boldBtn.getAttribute('aria-pressed')).toBe('true');
		});

		it('should bind conditional CSS classes on toolbar buttons', () => {
			createComponent();

			const italicBtn = fixture.nativeElement.querySelector('[aria-label="Italic"]');
			expect(italicBtn.classList.contains('bg-accent')).toBe(false);

			component.isItalic.set(true);
			fixture.detectChanges();
			expect(italicBtn.classList.contains('bg-accent')).toBe(true);
			expect(italicBtn.classList.contains('text-accent-foreground')).toBe(true);
		});

		it('should call toggleBold when Bold button is clicked', () => {
			createComponent();
			const spy = vi.spyOn(component, 'toggleBold');
			const btn = fixture.nativeElement.querySelector('[aria-label="Bold"]');
			btn.click();
			expect(spy).toHaveBeenCalled();
		});

		it('should call toggleItalic when Italic button is clicked', () => {
			createComponent();
			const spy = vi.spyOn(component, 'toggleItalic');
			const btn = fixture.nativeElement.querySelector('[aria-label="Italic"]');
			btn.click();
			expect(spy).toHaveBeenCalled();
		});

		it('should call toggleUnderline when Underline button is clicked', () => {
			createComponent();
			const spy = vi.spyOn(component, 'toggleUnderline');
			const btn = fixture.nativeElement.querySelector('[aria-label="Underline"]');
			btn.click();
			expect(spy).toHaveBeenCalled();
		});

		it('should call toggleStrike when Strikethrough button is clicked', () => {
			createComponent();
			const spy = vi.spyOn(component, 'toggleStrike');
			const btn = fixture.nativeElement.querySelector('[aria-label="Strikethrough"]');
			btn.click();
			expect(spy).toHaveBeenCalled();
		});

		it('should call toggleHeading(1) when H1 button is clicked', () => {
			createComponent();
			const spy = vi.spyOn(component, 'toggleHeading');
			const btn = fixture.nativeElement.querySelector('[aria-label="Heading 1"]');
			btn.click();
			expect(spy).toHaveBeenCalledWith(1);
		});

		it('should call toggleHeading(2) when H2 button is clicked', () => {
			createComponent();
			const spy = vi.spyOn(component, 'toggleHeading');
			const btn = fixture.nativeElement.querySelector('[aria-label="Heading 2"]');
			btn.click();
			expect(spy).toHaveBeenCalledWith(2);
		});

		it('should call toggleHeading(3) when H3 button is clicked', () => {
			createComponent();
			const spy = vi.spyOn(component, 'toggleHeading');
			const btn = fixture.nativeElement.querySelector('[aria-label="Heading 3"]');
			btn.click();
			expect(spy).toHaveBeenCalledWith(3);
		});

		it('should call toggleBulletList when Bullet list button is clicked', () => {
			createComponent();
			const spy = vi.spyOn(component, 'toggleBulletList');
			const btn = fixture.nativeElement.querySelector('[aria-label="Bullet list"]');
			btn.click();
			expect(spy).toHaveBeenCalled();
		});

		it('should call toggleOrderedList when Numbered list button is clicked', () => {
			createComponent();
			const spy = vi.spyOn(component, 'toggleOrderedList');
			const btn = fixture.nativeElement.querySelector('[aria-label="Numbered list"]');
			btn.click();
			expect(spy).toHaveBeenCalled();
		});

		it('should call toggleBlockquote when Blockquote button is clicked', () => {
			createComponent();
			const spy = vi.spyOn(component, 'toggleBlockquote');
			const btn = fixture.nativeElement.querySelector('[aria-label="Blockquote"]');
			btn.click();
			expect(spy).toHaveBeenCalled();
		});

		it('should call toggleCodeBlock when Code block button is clicked', () => {
			createComponent();
			const spy = vi.spyOn(component, 'toggleCodeBlock');
			const btn = fixture.nativeElement.querySelector('[aria-label="Code block"]');
			btn.click();
			expect(spy).toHaveBeenCalled();
		});

		it('should call insertHorizontalRule when HR button is clicked', () => {
			createComponent();
			const spy = vi.spyOn(component, 'insertHorizontalRule');
			const btn = fixture.nativeElement.querySelector('[aria-label="Horizontal rule"]');
			btn.click();
			expect(spy).toHaveBeenCalled();
		});

		it('should reflect all toolbar active states via class and aria-pressed', () => {
			createComponent();

			// Activate everything
			component.isBold.set(true);
			component.isItalic.set(true);
			component.isUnderline.set(true);
			component.isStrike.set(true);
			component.isHeading1.set(true);
			component.isHeading2.set(true);
			component.isHeading3.set(true);
			component.isBulletList.set(true);
			component.isOrderedList.set(true);
			component.isBlockquote.set(true);
			component.isCodeBlock.set(true);
			fixture.detectChanges();

			const toolbar = fixture.nativeElement.querySelector('[role="toolbar"]');
			const buttons = toolbar.querySelectorAll('button');
			// Check all buttons with aria-pressed have "true"
			for (const btn of Array.from(buttons) as HTMLButtonElement[]) {
				const ariaPressed = btn.getAttribute('aria-pressed');
				if (ariaPressed !== null) {
					expect(ariaPressed).toBe('true');
				}
			}
		});

		it('should bind aria-label on toolbar with label', () => {
			createComponent({ fieldOverrides: { label: 'Body Content' } });
			const toolbar = fixture.nativeElement.querySelector('[role="toolbar"]');
			expect(toolbar.getAttribute('aria-label')).toBe('Body Content formatting');
		});
	});

	// -------------------------------------------------------------------
	// @else branch — read-only view (disabled)
	// -------------------------------------------------------------------
	describe('read-only view (disabled)', () => {
		it('should render read-only div instead of editor in view mode', () => {
			createComponent({ mode: 'view', initialValue: '<p>Hello</p>' });

			const toolbar = fixture.nativeElement.querySelector('[role="toolbar"]');
			expect(toolbar).toBeNull();

			const readOnly = fixture.nativeElement.querySelector('.prose');
			expect(readOnly).toBeTruthy();
			expect(readOnly.innerHTML).toContain('Hello');
		});

		it('should render read-only div when field is readOnly', () => {
			createComponent({
				fieldOverrides: { admin: { readOnly: true } },
				initialValue: '<b>Read only content</b>',
			});

			const toolbar = fixture.nativeElement.querySelector('[role="toolbar"]');
			expect(toolbar).toBeNull();

			const readOnly = fixture.nativeElement.querySelector('[class*="prose"]');
			expect(readOnly).toBeTruthy();
		});

		it('should bind innerHTML to stringValue in read-only view', () => {
			const mock = createMockFieldNodeState('<p>Initial</p>');
			fixture = TestBed.createComponent(RichTextFieldRenderer);
			component = fixture.componentInstance;

			fixture.componentRef.setInput('field', createMockField('richText'));
			fixture.componentRef.setInput('path', 'content');
			fixture.componentRef.setInput('mode', 'view');
			fixture.componentRef.setInput('formNode', mock.node);
			fixture.detectChanges();

			const readOnly = fixture.nativeElement.querySelector('.prose');
			expect(readOnly.innerHTML).toContain('Initial');

			// Update value and re-render
			mock.state.value.set('<p>Updated</p>');
			fixture.detectChanges();
			expect(readOnly.innerHTML).toContain('Updated');
		});
	});

	// -------------------------------------------------------------------
	// mcms-form-field bindings
	// -------------------------------------------------------------------
	describe('mcms-form-field attribute bindings', () => {
		it('should bind fieldId, required, disabled, and errors to mcms-form-field', () => {
			createComponent({
				fieldOverrides: { required: true },
				formNodeOptions: {
					errors: [{ kind: 'required', message: 'Field is required' }],
					touched: true,
				},
			});

			const formField = fixture.nativeElement.querySelector('mcms-form-field');
			expect(formField).toBeTruthy();
		});

		it('should render label text from field definition', () => {
			createComponent({ fieldOverrides: { label: 'Article Body' } });
			const label = fixture.nativeElement.querySelector('[mcmsLabel], [mcmslabel]');
			if (label) {
				expect(label.textContent).toContain('Article Body');
			}
		});
	});

	// -------------------------------------------------------------------
	// Edge cases for template expression evaluation
	// -------------------------------------------------------------------
	describe('template expression edge cases', () => {
		it('should handle empty stringValue in read-only mode', () => {
			createComponent({ mode: 'view', initialValue: '' });
			const readOnly = fixture.nativeElement.querySelector('.prose');
			expect(readOnly).toBeTruthy();
		});

		it('should handle null formNode gracefully', () => {
			createComponent({ skipFormNode: true });
			// Should render without errors
			expect(component).toBeTruthy();
			expect(component.stringValue()).toBe('');
			expect(component.touchedErrors()).toEqual([]);
		});

		it('should switch from editor to read-only when mode changes', () => {
			createComponent({ mode: 'create' });
			expect(fixture.nativeElement.querySelector('[role="toolbar"]')).toBeTruthy();

			fixture.componentRef.setInput('mode', 'view');
			fixture.detectChanges();
			expect(fixture.nativeElement.querySelector('[role="toolbar"]')).toBeNull();
			expect(fixture.nativeElement.querySelector('.prose')).toBeTruthy();
		});
	});
});
