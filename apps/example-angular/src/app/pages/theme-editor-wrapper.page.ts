/**
 * Thin wrapper that re-exports ThemeEditorPage from theme-editor.
 *
 * This separate file keeps the lazy route import isolated from
 * headless-styling-lab.page.ts which statically imports @momentumcms/headless.
 */
import { ThemeEditorPage } from '@momentumcms/theme-editor';

export const ThemeEditorWrapperPage = ThemeEditorPage;
