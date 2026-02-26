export { HeaderBlockEditorComponent } from './header-block-editor.component';
export { TextBlockEditorComponent } from './text-block-editor.component';
export { ButtonBlockEditorComponent } from './button-block-editor.component';
export { ImageBlockEditorComponent } from './image-block-editor.component';
export { DividerBlockEditorComponent } from './divider-block-editor.component';
export { SpacerBlockEditorComponent } from './spacer-block-editor.component';
export { ColumnsBlockEditorComponent } from './columns-block-editor.component';
export { FooterBlockEditorComponent } from './footer-block-editor.component';

import type { Type } from '@angular/core';
import { HeaderBlockEditorComponent } from './header-block-editor.component';
import { TextBlockEditorComponent } from './text-block-editor.component';
import { ButtonBlockEditorComponent } from './button-block-editor.component';
import { ImageBlockEditorComponent } from './image-block-editor.component';
import { DividerBlockEditorComponent } from './divider-block-editor.component';
import { SpacerBlockEditorComponent } from './spacer-block-editor.component';
import { ColumnsBlockEditorComponent } from './columns-block-editor.component';
import { FooterBlockEditorComponent } from './footer-block-editor.component';

/** Map of block type slug → editor component class. */
export const BLOCK_EDITOR_MAP: Record<string, Type<unknown>> = {
	header: HeaderBlockEditorComponent,
	text: TextBlockEditorComponent,
	button: ButtonBlockEditorComponent,
	image: ImageBlockEditorComponent,
	divider: DividerBlockEditorComponent,
	spacer: SpacerBlockEditorComponent,
	columns: ColumnsBlockEditorComponent,
	footer: FooterBlockEditorComponent,
};
