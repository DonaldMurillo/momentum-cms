/**
 * Re-export for lazy loading.
 * This file exists to create a separate chunk for the analytics dashboard,
 * avoiding pulling it into the initial bundle via the admin barrel.
 */
// eslint-disable-next-line @nx/enforce-module-boundaries -- lazy-load chunk boundary requires direct path to avoid barrel inclusion in initial bundle
export { AnalyticsDashboardPage } from '../../../../libs/admin/src/lib/pages/analytics/analytics-dashboard.page';
