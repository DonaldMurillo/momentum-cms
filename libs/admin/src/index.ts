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

// Guards
export * from './lib/guards';

// UI Components and Services
export * from './lib/ui/theme';

// Components (for direct usage in Analog apps)
export { AdminShellComponent } from './lib/components/shell/admin-shell.component';
export { DashboardPage } from './lib/pages/dashboard/dashboard.page';
export { CollectionListPage } from './lib/pages/collection-list/collection-list.page';
export { CollectionEditPage } from './lib/pages/collection-edit/collection-edit.page';
export { LoginPage } from './lib/pages/login/login.page';
export { SetupPage } from './lib/pages/setup/setup.page';
