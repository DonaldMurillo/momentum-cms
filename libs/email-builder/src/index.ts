// Services
export {
	EmailBuilderStateService,
	generateBlockId,
} from './lib/services/email-builder-state.service';
export {
	EmailBlockRegistryService,
	EMAIL_BLOCK_DEFINITIONS,
	DEFAULT_EMAIL_BLOCK_DEFINITIONS,
	provideEmailBlocks,
} from './lib/services/email-block-registry.service';

// Providers
export {
	provideEmailBuilder,
	type EmailBuilderOptions,
} from './lib/providers/provide-email-builder';

// Default builder
export { EmailBuilderComponent } from './lib/email-builder.component';

// Editor components
export { EmailEditorPanelComponent } from './lib/editor/email-editor-panel.component';
export { BlockWrapperComponent } from './lib/editor/block-wrapper.component';
export { BlockInserterComponent } from './lib/editor/block-inserter.component';
export {
	HeaderBlockEditorComponent,
	TextBlockEditorComponent,
	ButtonBlockEditorComponent,
	ImageBlockEditorComponent,
	DividerBlockEditorComponent,
	SpacerBlockEditorComponent,
	ColumnsBlockEditorComponent,
	FooterBlockEditorComponent,
	BLOCK_EDITOR_MAP,
} from './lib/editor/block-editors/index';

// Preview components
export { EmailPreviewPanelComponent } from './lib/preview/email-preview-panel.component';
export { blocksToPreviewHtml } from './lib/preview/preview-renderer';

// Studio page — safe to export (no @momentumcms/admin dependency)
export { EmailBuilderStudioPage } from './lib/admin/email-builder-studio.page';

// Field renderer — for embedding email builder in entity forms
export { EmailBuilderFieldRendererComponent } from './lib/admin/email-builder-field-renderer.component';

// Admin routes — imported via @momentumcms/email-builder/admin-routes (tsconfig sub-path)
// Not re-exported from barrel to avoid pulling @momentumcms/core into ng-packagr build.
// See: libs/email-builder/src/lib/admin/email-builder-admin-routes.ts
