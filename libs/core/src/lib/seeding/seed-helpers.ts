/**
 * Seed Helpers
 *
 * Factory functions for creating typed seed entity definitions.
 * Provides IntelliSense support for common entity types.
 */

import type {
	DefaultEntityHelpers,
	SeedEntity,
	SeedEntityOptions,
	UserSeedData,
	AdminSeedData,
	AuthUserSeedData,
	CollectionSeedBuilder,
} from './seeding.types';

/**
 * Creates the default entity helpers with full type safety.
 * Used internally by the seeding system to provide the `helpers` parameter.
 *
 * @returns Default entity helpers object
 *
 * @example
 * ```typescript
 * const helpers = createSeedHelpers();
 * const adminSeed = helpers.admin('first-admin', { name: 'Admin', email: 'admin@example.com' });
 * const userSeed = helpers.user('regular-user', { name: 'John', email: 'john@example.com' });
 * const postSeed = helpers.collection<PostDoc>('posts').create('welcome', { title: 'Hello' });
 * ```
 */
export function createSeedHelpers(): DefaultEntityHelpers {
	return {
		admin(
			seedId: string,
			data: AdminSeedData,
			options?: SeedEntityOptions,
		): SeedEntity<UserSeedData> {
			return {
				seedId,
				collection: 'user', // Better Auth user table
				data: {
					role: 'admin', // Admin role by default
					emailVerified: true, // Admins are pre-verified
					...data,
				},
				options,
			};
		},

		user(
			seedId: string,
			data: UserSeedData,
			options?: SeedEntityOptions,
		): SeedEntity<UserSeedData> {
			return {
				seedId,
				collection: 'user', // Better Auth user table
				data: {
					role: 'user', // Default role
					emailVerified: false, // Default not verified
					...data,
				},
				options,
			};
		},

		authUser(
			seedId: string,
			data: AuthUserSeedData,
			options?: SeedEntityOptions,
		): SeedEntity<AuthUserSeedData> {
			return {
				seedId,
				collection: 'user', // Better Auth user table (auth-user collection with dbName: 'user')
				data: {
					role: 'user',
					emailVerified: true,
					...data,
				},
				options: {
					...options,
					useAuthSignup: true,
				},
			};
		},

		collection<TDoc>(slug: string): CollectionSeedBuilder<TDoc> {
			return {
				create(seedId: string, data: Partial<TDoc>, options?: SeedEntityOptions): SeedEntity<TDoc> {
					return {
						seedId,
						collection: slug,
						// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- User provides partial data that will be merged with defaults during seeding
						data: data as TDoc,
						options,
					};
				},
			};
		},
	};
}
