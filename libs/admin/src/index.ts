// Routes
export * from './lib/routes';

// Services
export { MomentumApiService } from './lib/services/api.service';
export {
	MomentumAuthService,
	type AuthUser,
	type AuthSession,
	type AuthResult,
	type SetupStatus,
} from './lib/services/auth.service';
export {
	CollectionAccessService,
	type CollectionPermissions,
} from './lib/services/collection-access.service';

// Momentum API (unified SSR/Browser)
export {
	injectMomentumAPI,
	provideMomentumAPI,
	MOMENTUM_API,
	MOMENTUM_API_CONTEXT,
	type MomentumClientAPI,
	type MomentumCollectionAPI,
	type MomentumAPIServer,
	type MomentumAPIContext,
	type FindOptions,
	type FindByIdOptions,
	type FindResult,
	type DeleteResult,
	type UserContext,
	// Type-safe API
	injectTypedMomentumAPI,
	type TypedMomentumClientAPI,
	type TypedCollectionAPI,
	type TypedFindOptions,
	type TypedFindByIdOptions,
} from './lib/services/momentum-api.service';

// Guards
export * from './lib/guards';

// UI Components and Services
export * from './lib/ui/theme';

// User Injection Utilities
export {
	injectUser,
	injectUserRole,
	injectIsAuthenticated,
	injectIsAdmin,
	injectHasRole,
	injectHasAnyRole,
	type BaseUser,
} from './lib/utils/inject-user';

// Components (for direct usage in Analog apps)
export { AdminShellComponent } from './lib/components/shell/admin-shell.component';
export { ForgotPasswordFormComponent } from './lib/components/forgot-password-form/forgot-password-form.component';
export { ResetPasswordFormComponent } from './lib/components/reset-password-form/reset-password-form.component';

// Pages
export { DashboardPage } from './lib/pages/dashboard/dashboard.page';
export { CollectionListPage } from './lib/pages/collection-list/collection-list.page';
export { CollectionViewPage } from './lib/pages/collection-view/collection-view.page';
export { CollectionEditPage } from './lib/pages/collection-edit/collection-edit.page';
export { LoginPage } from './lib/pages/login/login.page';
export { SetupPage } from './lib/pages/setup/setup.page';
export { ForgotPasswordPage } from './lib/pages/forgot-password/forgot-password.page';
export { ResetPasswordPage } from './lib/pages/reset-password/reset-password.page';

// Widgets
export { AdminSidebarWidget } from './lib/widgets/admin-sidebar/admin-sidebar.component';
export { CollectionCardWidget } from './lib/widgets/collection-card/collection-card.component';
export { EntityListWidget } from './lib/widgets/entity-list/entity-list.component';
export { EntityFormWidget } from './lib/widgets/entity-form/entity-form.component';
export { EntityViewWidget } from './lib/widgets/entity-view/entity-view.component';
export { FeedbackService } from './lib/widgets/feedback/feedback.service';

// Field Renderers (for custom forms)
export { FieldRenderer } from './lib/widgets/entity-form/field-renderers/field-renderer.component';
export { TextFieldRenderer } from './lib/widgets/entity-form/field-renderers/text-field.component';
export { NumberFieldRenderer } from './lib/widgets/entity-form/field-renderers/number-field.component';
export { SelectFieldRenderer } from './lib/widgets/entity-form/field-renderers/select-field.component';
export { CheckboxFieldRenderer } from './lib/widgets/entity-form/field-renderers/checkbox-field.component';
export { DateFieldRenderer } from './lib/widgets/entity-form/field-renderers/date-field.component';

// Widget Types
export type {
	AdminBranding,
	AdminNavItem,
	AdminNavSection,
	AdminUser,
	CollectionWithCount,
	EntityAction,
	Entity,
} from './lib/widgets/widget.types';

export type {
	EntityListColumn,
	EntityListActionEvent,
	EntityListBulkActionEvent,
	EntityListFindResult,
} from './lib/widgets/entity-list/entity-list.types';

export type {
	EntityFormMode,
	FieldError,
	EntityFormState,
	FieldRendererContext,
	FieldChangeEvent,
	EntityFormSaveResult,
} from './lib/widgets/entity-form/entity-form.types';

export type {
	EntityViewFieldConfig,
	BreadcrumbItem,
	EntityViewActionEvent,
} from './lib/widgets/entity-view/entity-view.types';
