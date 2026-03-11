/**
 * Thin wrapper that re-exports ThemeEditorPage from headless.
 *
 * This separate file avoids an Nx module boundary conflict:
 * headless-styling-lab.page.ts statically imports @momentumcms/headless,
 * so a lazy route in app.routes.ts cannot also import from headless directly.
 * By isolating the lazy import in this file, both coexist.
 */
import { ThemeEditorPage } from '@momentumcms/headless';

export const ThemeEditorWrapperPage = ThemeEditorPage;
