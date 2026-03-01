/**
 * Browser-safe admin route definitions for the form builder plugin.
 *
 * Exported via `@momentumcms/plugins-form-builder/admin-routes`.
 */

import type { PluginAdminRouteDescriptor } from '@momentumcms/core';

// Admin routes are currently empty — the forms and form-submissions collections
// already provide sidebar entries via their admin.group configuration.
// A custom aggregate submissions view can be added here in the future.
export const FORM_BUILDER_ADMIN_ROUTES: PluginAdminRouteDescriptor[] = [];
