/**
 * Central Icon Provider for the Admin UI
 *
 * Provides ALL heroicons/outline so that any collection, global, or plugin route
 * can reference any `hero*` icon name without manual registration.
 *
 * This is provided at the admin route level via `momentumAdminRoutes()`,
 * making icons available to the entire admin shell and all child components.
 */
import { provideIcons } from '@ng-icons/core';
import * as heroOutline from '@ng-icons/heroicons/outline';

/**
 * Provides all Heroicons outline icons to the admin UI.
 * Called once at the admin route level — individual components
 * do NOT need their own `provideIcons()` for sidebar/navigation icons.
 */
export function provideAdminIcons(): ReturnType<typeof provideIcons> {
	return provideIcons(heroOutline);
}
