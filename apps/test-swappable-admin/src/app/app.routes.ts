import type { Route } from '@angular/router';
import { momentumAdminRoutes } from '@momentumcms/admin';
import { adminConfig } from '../generated/momentum.config';

export const appRoutes: Route[] = [...momentumAdminRoutes(adminConfig)];
