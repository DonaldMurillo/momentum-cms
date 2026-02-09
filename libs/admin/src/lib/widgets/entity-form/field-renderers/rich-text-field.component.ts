import {
	afterNextRender,
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	effect,
	ElementRef,
	inject,
	input,
	signal,
	viewChild,
} from '@angular/core';
import { McmsFormField } from '@momentum-cms/ui';
import type { ValidationError } from '@momentum-cms/ui';
import { humanizeFieldName } from '@momentum-cms/core';
import type { Field } from '@momentum-cms/core';
import type { EntityFormMode } from '../entity-form.types';
import { getFieldNodeState } from '../entity-form.types';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';

/**
 * Rich text field renderer using TipTap editor.
 * Provides a toolbar with formatting options and stores content as HTML.
 *
 * Uses Angular Signal Forms bridge pattern: reads/writes value via
 * a FieldTree node's FieldState rather than event-based I/O.
 */
@Component({
	selector: 'mcms-rich-text-field-renderer',
	imports: [McmsFormField],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		<mcms-form-field
			[id]="fieldId()"
			[required]="required()"
			[disabled]="isDisabled()"
			[errors]="touchedErrors()"
		>
			<span mcmsLabel>{{ label() }}</span>

			@if (!isDisabled()) {
				<div
					class="rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
				>
					<!-- Toolbar -->
					<div
						class="flex flex-wrap items-center gap-0.5 border-b border-input px-1 py-1"
						role="toolbar"
						[attr.aria-label]="label() + ' formatting'"
					>
						<button
							type="button"
							class="inline-flex h-8 w-8 items-center justify-center rounded text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
							[class.bg-accent]="isBold()"
							[class.text-accent-foreground]="isBold()"
							title="Bold (Ctrl+B)"
							aria-label="Bold"
							[attr.aria-pressed]="isBold()"
							(click)="toggleBold()"
						>
							<svg
								aria-hidden="true"
								class="h-4 w-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="3"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
								<path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
							</svg>
						</button>

						<button
							type="button"
							class="inline-flex h-8 w-8 items-center justify-center rounded text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
							[class.bg-accent]="isItalic()"
							[class.text-accent-foreground]="isItalic()"
							title="Italic (Ctrl+I)"
							aria-label="Italic"
							[attr.aria-pressed]="isItalic()"
							(click)="toggleItalic()"
						>
							<svg
								aria-hidden="true"
								class="h-4 w-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<line x1="19" y1="4" x2="10" y2="4" />
								<line x1="14" y1="20" x2="5" y2="20" />
								<line x1="15" y1="4" x2="9" y2="20" />
							</svg>
						</button>

						<button
							type="button"
							class="inline-flex h-8 w-8 items-center justify-center rounded text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
							[class.bg-accent]="isUnderline()"
							[class.text-accent-foreground]="isUnderline()"
							title="Underline (Ctrl+U)"
							aria-label="Underline"
							[attr.aria-pressed]="isUnderline()"
							(click)="toggleUnderline()"
						>
							<svg
								aria-hidden="true"
								class="h-4 w-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" />
								<line x1="4" y1="21" x2="20" y2="21" />
							</svg>
						</button>

						<button
							type="button"
							class="inline-flex h-8 w-8 items-center justify-center rounded text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
							[class.bg-accent]="isStrike()"
							[class.text-accent-foreground]="isStrike()"
							title="Strikethrough"
							aria-label="Strikethrough"
							[attr.aria-pressed]="isStrike()"
							(click)="toggleStrike()"
						>
							<svg
								aria-hidden="true"
								class="h-4 w-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M16 4H9a3 3 0 0 0-2.83 4" />
								<path d="M14 12a4 4 0 0 1 0 8H6" />
								<line x1="4" y1="12" x2="20" y2="12" />
							</svg>
						</button>

						<div class="mx-1 h-6 w-px bg-border" role="separator"></div>

						<button
							type="button"
							class="inline-flex h-8 w-8 items-center justify-center rounded text-sm font-bold transition-colors hover:bg-accent hover:text-accent-foreground"
							[class.bg-accent]="isHeading1()"
							[class.text-accent-foreground]="isHeading1()"
							title="Heading 1"
							aria-label="Heading 1"
							[attr.aria-pressed]="isHeading1()"
							(click)="toggleHeading(1)"
						>
							H1
						</button>

						<button
							type="button"
							class="inline-flex h-8 w-8 items-center justify-center rounded text-sm font-bold transition-colors hover:bg-accent hover:text-accent-foreground"
							[class.bg-accent]="isHeading2()"
							[class.text-accent-foreground]="isHeading2()"
							title="Heading 2"
							aria-label="Heading 2"
							[attr.aria-pressed]="isHeading2()"
							(click)="toggleHeading(2)"
						>
							H2
						</button>

						<button
							type="button"
							class="inline-flex h-8 w-8 items-center justify-center rounded text-sm font-bold transition-colors hover:bg-accent hover:text-accent-foreground"
							[class.bg-accent]="isHeading3()"
							[class.text-accent-foreground]="isHeading3()"
							title="Heading 3"
							aria-label="Heading 3"
							[attr.aria-pressed]="isHeading3()"
							(click)="toggleHeading(3)"
						>
							H3
						</button>

						<div class="mx-1 h-6 w-px bg-border" role="separator"></div>

						<button
							type="button"
							class="inline-flex h-8 w-8 items-center justify-center rounded text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
							[class.bg-accent]="isBulletList()"
							[class.text-accent-foreground]="isBulletList()"
							title="Bullet List"
							aria-label="Bullet list"
							[attr.aria-pressed]="isBulletList()"
							(click)="toggleBulletList()"
						>
							<svg
								aria-hidden="true"
								class="h-4 w-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<line x1="8" y1="6" x2="21" y2="6" />
								<line x1="8" y1="12" x2="21" y2="12" />
								<line x1="8" y1="18" x2="21" y2="18" />
								<line x1="3" y1="6" x2="3.01" y2="6" />
								<line x1="3" y1="12" x2="3.01" y2="12" />
								<line x1="3" y1="18" x2="3.01" y2="18" />
							</svg>
						</button>

						<button
							type="button"
							class="inline-flex h-8 w-8 items-center justify-center rounded text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
							[class.bg-accent]="isOrderedList()"
							[class.text-accent-foreground]="isOrderedList()"
							title="Numbered List"
							aria-label="Numbered list"
							[attr.aria-pressed]="isOrderedList()"
							(click)="toggleOrderedList()"
						>
							<svg
								aria-hidden="true"
								class="h-4 w-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<line x1="10" y1="6" x2="21" y2="6" />
								<line x1="10" y1="12" x2="21" y2="12" />
								<line x1="10" y1="18" x2="21" y2="18" />
								<path d="M4 6h1v4" />
								<path d="M4 10h2" />
								<path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
							</svg>
						</button>

						<div class="mx-1 h-6 w-px bg-border" role="separator"></div>

						<button
							type="button"
							class="inline-flex h-8 w-8 items-center justify-center rounded text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
							[class.bg-accent]="isBlockquote()"
							[class.text-accent-foreground]="isBlockquote()"
							title="Blockquote"
							aria-label="Blockquote"
							[attr.aria-pressed]="isBlockquote()"
							(click)="toggleBlockquote()"
						>
							<svg aria-hidden="true" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
								<path
									d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z"
								/>
							</svg>
						</button>

						<button
							type="button"
							class="inline-flex h-8 w-8 items-center justify-center rounded text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
							[class.bg-accent]="isCodeBlock()"
							[class.text-accent-foreground]="isCodeBlock()"
							title="Code Block"
							aria-label="Code block"
							[attr.aria-pressed]="isCodeBlock()"
							(click)="toggleCodeBlock()"
						>
							<svg
								aria-hidden="true"
								class="h-4 w-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<polyline points="16 18 22 12 16 6" />
								<polyline points="8 6 2 12 8 18" />
							</svg>
						</button>

						<button
							type="button"
							class="inline-flex h-8 w-8 items-center justify-center rounded text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
							title="Horizontal Rule"
							aria-label="Horizontal rule"
							(click)="insertHorizontalRule()"
						>
							<svg
								aria-hidden="true"
								class="h-4 w-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
							>
								<line x1="3" y1="12" x2="21" y2="12" />
							</svg>
						</button>
					</div>

					<!-- Editor content area -->
					<div
						#editorElement
						class="tiptap-editor prose prose-sm dark:prose-invert max-w-none px-3 py-2"
						data-testid="rich-text-editor"
					></div>
				</div>
			} @else {
				<!-- Read-only view -->
				<div
					class="prose prose-sm dark:prose-invert max-w-none rounded-md border border-input bg-muted/50 px-3 py-2"
					[innerHTML]="stringValue()"
				></div>
			}
		</mcms-form-field>
	`,
	styles: `
		:host ::ng-deep .tiptap-editor {
			min-height: 200px;
			outline: none;
		}

		:host ::ng-deep .tiptap-editor .ProseMirror {
			outline: none;
			min-height: 200px;
		}

		:host ::ng-deep .tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
			content: attr(data-placeholder);
			float: left;
			color: hsl(var(--mcms-muted-foreground));
			pointer-events: none;
			height: 0;
		}

		:host ::ng-deep .tiptap-editor .ProseMirror h1 {
			font-size: 1.5em;
			font-weight: 700;
			margin: 0.5em 0;
		}

		:host ::ng-deep .tiptap-editor .ProseMirror h2 {
			font-size: 1.25em;
			font-weight: 600;
			margin: 0.5em 0;
		}

		:host ::ng-deep .tiptap-editor .ProseMirror h3 {
			font-size: 1.1em;
			font-weight: 600;
			margin: 0.5em 0;
		}

		:host ::ng-deep .tiptap-editor .ProseMirror ul {
			list-style: disc;
			padding-left: 1.5em;
		}

		:host ::ng-deep .tiptap-editor .ProseMirror ol {
			list-style: decimal;
			padding-left: 1.5em;
		}

		:host ::ng-deep .tiptap-editor .ProseMirror blockquote {
			border-left: 3px solid hsl(var(--mcms-border));
			padding-left: 1em;
			margin-left: 0;
			color: hsl(var(--mcms-muted-foreground));
		}

		:host ::ng-deep .tiptap-editor .ProseMirror pre {
			background: hsl(var(--mcms-muted));
			border-radius: 0.375rem;
			padding: 0.75em;
			font-family: monospace;
			font-size: 0.875em;
		}

		:host ::ng-deep .tiptap-editor .ProseMirror code {
			background: hsl(var(--mcms-muted));
			border-radius: 0.25rem;
			padding: 0.125em 0.25em;
			font-size: 0.875em;
		}

		:host ::ng-deep .tiptap-editor .ProseMirror hr {
			border: none;
			border-top: 1px solid hsl(var(--mcms-border));
			margin: 1em 0;
		}

		:host ::ng-deep .tiptap-editor .ProseMirror a {
			color: hsl(var(--mcms-primary));
			text-decoration: underline;
		}

		:host ::ng-deep .tiptap-editor .ProseMirror p {
			margin: 0.25em 0;
		}
	`,
})
export class RichTextFieldRenderer {
	private readonly destroyRef = inject(DestroyRef);

	/** Field definition */
	readonly field = input.required<Field>();

	/** Signal forms FieldTree node for this field */
	readonly formNode = input<unknown>(null);

	/** Form mode */
	readonly mode = input<EntityFormMode>('create');

	/** Field path */
	readonly path = input.required<string>();

	/** Bridge: extract FieldState from formNode */
	private readonly nodeState = computed(() => getFieldNodeState(this.formNode()));

	/** Editor container element */
	readonly editorRef = viewChild<ElementRef<HTMLElement>>('editorElement');

	/** TipTap editor instance */
	private editor: Editor | null = null;

	/** Whether we're currently updating from external value (prevents feedback loops) */
	private updatingFromExternal = false;

	/** Whether the editor has been initialized (browser only) */
	readonly editorReady = signal(false);

	/** Toolbar state signals */
	readonly isBold = signal(false);
	readonly isItalic = signal(false);
	readonly isUnderline = signal(false);
	readonly isStrike = signal(false);
	readonly isHeading1 = signal(false);
	readonly isHeading2 = signal(false);
	readonly isHeading3 = signal(false);
	readonly isBulletList = signal(false);
	readonly isOrderedList = signal(false);
	readonly isBlockquote = signal(false);
	readonly isCodeBlock = signal(false);

	/** Unique field ID */
	readonly fieldId = computed(() => `field-${this.path().replace(/\./g, '-')}`);

	/** Computed label */
	readonly label = computed(() => this.field().label || humanizeFieldName(this.field().name));

	/** Whether the field is required */
	readonly required = computed(() => this.field().required ?? false);

	/** Whether the field is disabled */
	readonly isDisabled = computed(() => {
		return this.mode() === 'view' || (this.field().admin?.readOnly ?? false);
	});

	/** String value from FieldState */
	readonly stringValue = computed(() => {
		const state = this.nodeState();
		if (!state) return '';
		const val = state.value();
		return val === null || val === undefined ? '' : String(val);
	});

	/** Validation errors shown only when field is touched */
	readonly touchedErrors = computed((): readonly ValidationError[] => {
		const state = this.nodeState();
		if (!state || !state.touched()) return [];
		return state.errors().map((e) => ({ kind: e.kind, message: e.message }));
	});

	constructor() {
		// Mount editor after first browser render (SSR-safe).
		afterNextRender(() => {
			this.mountEditor();
		});

		// Sync external value changes into the editor
		effect(() => {
			const val = this.stringValue();
			if (this.editor && !this.editor.isDestroyed) {
				const currentHtml = this.editor.getHTML();
				if (val !== currentHtml && !(val === '' && currentHtml === '<p></p>')) {
					this.updatingFromExternal = true;
					this.editor.commands.setContent(val || '', { emitUpdate: false });
					this.updatingFromExternal = false;
				}
			}
		});

		this.destroyRef.onDestroy(() => {
			this.editor?.destroy();
			this.editor = null;
		});
	}

	/**
	 * Handle blur from editor.
	 */
	onBlur(): void {
		const state = this.nodeState();
		if (state) state.markAsTouched();
	}

	private mountEditor(): void {
		const el = this.editorRef();
		if (!el || this.isDisabled() || this.editor) return;

		this.editor = new Editor({
			element: el.nativeElement,
			editorProps: {
				attributes: {
					role: 'textbox',
					'aria-multiline': 'true',
					'aria-label': this.label() + ' editor',
				},
			},
			extensions: [
				StarterKit.configure({
					heading: { levels: [1, 2, 3] },
				}),
				Underline,
				Link.configure({
					openOnClick: false,
					HTMLAttributes: {
						rel: 'noopener noreferrer nofollow',
					},
				}),
				Placeholder.configure({
					placeholder: this.field().admin?.placeholder || 'Start writing...',
				}),
			],
			content: this.stringValue() || '',
			editable: true,
			onUpdate: ({ editor }) => {
				if (!this.updatingFromExternal) {
					const html = editor.getHTML();
					const value = html === '<p></p>' ? '' : html;
					const state = this.nodeState();
					if (state) state.value.set(value);
				}
			},
			onSelectionUpdate: ({ editor }) => {
				this.updateToolbarState(editor);
			},
			onTransaction: ({ editor }) => {
				this.updateToolbarState(editor);
			},
			onBlur: () => {
				this.onBlur();
			},
		});

		this.editorReady.set(true);
	}

	private updateToolbarState(editor: Editor): void {
		this.isBold.set(editor.isActive('bold'));
		this.isItalic.set(editor.isActive('italic'));
		this.isUnderline.set(editor.isActive('underline'));
		this.isStrike.set(editor.isActive('strike'));
		this.isHeading1.set(editor.isActive('heading', { level: 1 }));
		this.isHeading2.set(editor.isActive('heading', { level: 2 }));
		this.isHeading3.set(editor.isActive('heading', { level: 3 }));
		this.isBulletList.set(editor.isActive('bulletList'));
		this.isOrderedList.set(editor.isActive('orderedList'));
		this.isBlockquote.set(editor.isActive('blockquote'));
		this.isCodeBlock.set(editor.isActive('codeBlock'));
	}

	toggleBold(): void {
		this.editor?.chain().focus().toggleBold().run();
	}

	toggleItalic(): void {
		this.editor?.chain().focus().toggleItalic().run();
	}

	toggleUnderline(): void {
		this.editor?.chain().focus().toggleUnderline().run();
	}

	toggleStrike(): void {
		this.editor?.chain().focus().toggleStrike().run();
	}

	toggleHeading(level: 1 | 2 | 3): void {
		this.editor?.chain().focus().toggleHeading({ level }).run();
	}

	toggleBulletList(): void {
		this.editor?.chain().focus().toggleBulletList().run();
	}

	toggleOrderedList(): void {
		this.editor?.chain().focus().toggleOrderedList().run();
	}

	toggleBlockquote(): void {
		this.editor?.chain().focus().toggleBlockquote().run();
	}

	toggleCodeBlock(): void {
		this.editor?.chain().focus().toggleCodeBlock().run();
	}

	insertHorizontalRule(): void {
		this.editor?.chain().focus().setHorizontalRule().run();
	}
}
