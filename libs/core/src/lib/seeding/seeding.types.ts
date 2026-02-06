/**
 * Seeding Types
 *
 * Type definitions for the Momentum CMS seeding system.
 * Provides declarative data seeding with strict typing and IntelliSense support.
 */

/**
 * Options for individual seed entity creation.
 */
export interface SeedEntityOptions {
	/**
	 * What to do if seedId already exists.
	 * - 'skip': Don't touch existing seed (default)
	 * - 'update': Update if data changed (checksum differs)
	 * - 'error': Throw SeedConflictError
	 */
	onConflict?: 'skip' | 'update' | 'error';

	/**
	 * Skip lifecycle hooks during seeding.
	 * Useful for performance when seeding large amounts of data.
	 * @default false
	 */
	skipHooks?: boolean;

	/**
	 * Skip access control checks during seeding.
	 * Seeds typically run in a trusted context.
	 * @default true
	 */
	skipAccessControl?: boolean;

	/**
	 * Sync with Better Auth when creating this seed.
	 * When true, the seed executor will call auth.api.signUpEmail() to create
	 * a Better Auth user with a hashed password, then link the Momentum user
	 * via the authId field.
	 *
	 * Requires `auth` to be passed to `initializeMomentum` options.
	 * Only applies to new seeds (not on 'skip' or 'update').
	 * @default false
	 */
	syncAuth?: boolean;
}

/**
 * Represents a single seed entity definition.
 */
export interface SeedEntity<TData = Record<string, unknown>> {
	/**
	 * Unique identifier for this seed (user-provided).
	 * Used to track seeding state and prevent duplicates.
	 */
	seedId: string;

	/**
	 * Collection slug to seed into.
	 */
	collection: string;

	/**
	 * Data to create in the collection.
	 */
	data: TData;

	/**
	 * Options for this specific entity.
	 */
	options?: SeedEntityOptions;
}

/**
 * Result of a seeded document operation.
 */
export interface SeededDocument<T = Record<string, unknown>> {
	/**
	 * The actual document ID in the database.
	 */
	id: string;

	/**
	 * The seed ID used to create/identify this seed.
	 */
	seedId: string;

	/**
	 * Collection slug where the document was seeded.
	 */
	collection: string;

	/**
	 * The created/updated document data.
	 */
	data: T;

	/**
	 * What action was taken.
	 * - 'created': New document was created
	 * - 'updated': Existing document was updated (data changed)
	 * - 'skipped': Document already exists and was not modified
	 */
	action: 'created' | 'updated' | 'skipped';
}

/**
 * Typed seed builder for a specific collection.
 * Provides IntelliSense for collection document types.
 */
export interface CollectionSeedBuilder<TDoc> {
	/**
	 * Create a seed entity for this collection.
	 *
	 * @param seedId - Unique identifier for this seed
	 * @param data - Document data to seed
	 * @param options - Optional seed options
	 * @returns Seed entity definition
	 *
	 * @example
	 * ```typescript
	 * collection<PostDoc>('posts').create('welcome-post', {
	 *   title: 'Welcome!',
	 *   status: 'published',
	 * });
	 * ```
	 */
	create: (seedId: string, data: Partial<TDoc>, options?: SeedEntityOptions) => SeedEntity<TDoc>;
}

/**
 * User seed data structure for Better Auth user table.
 */
export interface UserSeedData {
	/**
	 * User's display name.
	 */
	name: string;

	/**
	 * User's email address (unique).
	 */
	email: string;

	/**
	 * User's role.
	 * @default 'user'
	 */
	role?: string;

	/**
	 * Whether email is verified.
	 * @default false
	 */
	emailVerified?: boolean;

	/**
	 * User's avatar image URL.
	 */
	image?: string;
}

/**
 * Admin seed data structure for the first admin user.
 * Same as UserSeedData but with admin-friendly defaults.
 */
export interface AdminSeedData {
	/**
	 * Admin's display name.
	 */
	name: string;

	/**
	 * Admin's email address (unique).
	 */
	email: string;

	/**
	 * Admin's role.
	 * @default 'admin'
	 */
	role?: string;

	/**
	 * Whether email is verified.
	 * @default true (admins are typically pre-verified)
	 */
	emailVerified?: boolean;

	/**
	 * Admin's avatar image URL.
	 */
	image?: string;
}

/**
 * Auth-aware user seed data structure.
 * Creates both a Better Auth user (with hashed password) and a Momentum users collection entry.
 * Use with the `authUser()` helper in seeding defaults.
 */
export interface AuthUserSeedData {
	[key: string]: unknown;

	/**
	 * User's display name.
	 */
	name: string;

	/**
	 * User's email address (unique).
	 */
	email: string;

	/**
	 * User's password (will be hashed by Better Auth).
	 * Must be at least 8 characters.
	 */
	password: string;

	/**
	 * User's role in the Momentum users collection.
	 * @default 'user'
	 */
	role?: string;

	/**
	 * Whether the user is active.
	 * @default true
	 */
	active?: boolean;
}

/**
 * Default entity helpers with IntelliSense support.
 * Used in the `defaults` function of SeedingConfig.
 */
export interface DefaultEntityHelpers {
	/**
	 * Create the first admin user seed entity.
	 * Pre-configured with admin role and verified email.
	 *
	 * @param seedId - Unique identifier for this seed
	 * @param data - Admin user data
	 * @param options - Optional seed options
	 * @returns Seed entity definition
	 *
	 * @example
	 * ```typescript
	 * admin('first-admin', {
	 *   name: 'System Admin',
	 *   email: 'admin@example.com',
	 * });
	 * ```
	 */
	admin: (
		seedId: string,
		data: AdminSeedData,
		options?: SeedEntityOptions,
	) => SeedEntity<UserSeedData>;

	/**
	 * Create a user seed entity for the Better Auth user table.
	 *
	 * @param seedId - Unique identifier for this seed
	 * @param data - User data
	 * @param options - Optional seed options
	 * @returns Seed entity definition
	 *
	 * @example
	 * ```typescript
	 * user('regular-user', {
	 *   name: 'John Doe',
	 *   email: 'john@example.com',
	 * });
	 * ```
	 */
	user: (
		seedId: string,
		data: UserSeedData,
		options?: SeedEntityOptions,
	) => SeedEntity<UserSeedData>;

	/**
	 * Create a typed collection seed builder.
	 * Provides full IntelliSense for the document type.
	 *
	 * @param slug - Collection slug
	 * @returns Collection seed builder
	 *
	 * @example
	 * ```typescript
	 * collection<PostDoc>('posts').create('welcome', {
	 *   title: 'Welcome!',
	 *   status: 'published',
	 * });
	 * ```
	 */
	collection: <TDoc>(slug: string) => CollectionSeedBuilder<TDoc>;

	/**
	 * Create an auth-aware user seed entity.
	 * Creates a Better Auth user (with hashed password) and a Momentum users collection entry.
	 * The seed executor will call auth.api.signUpEmail() and link via authId.
	 *
	 * @param seedId - Unique identifier for this seed
	 * @param data - User data including password
	 * @param options - Optional seed options
	 * @returns Seed entity definition with syncAuth enabled
	 *
	 * @example
	 * ```typescript
	 * authUser('admin-user', {
	 *   name: 'Admin',
	 *   email: 'admin@example.com',
	 *   password: 'SecurePass123!',
	 *   role: 'admin',
	 * });
	 * ```
	 */
	authUser: (
		seedId: string,
		data: AuthUserSeedData,
		options?: SeedEntityOptions,
	) => SeedEntity<AuthUserSeedData>;
}

/**
 * Context passed to the custom seed function.
 * Provides utilities for seeding with dependency resolution.
 */
export interface SeedContext {
	/**
	 * Get a previously seeded document by its seedId.
	 * Useful for creating relationships between seeded entities.
	 *
	 * @param seedId - The seed ID to look up
	 * @returns The seeded document or null if not found
	 *
	 * @example
	 * ```typescript
	 * const adminUser = await ctx.getSeeded('admin-user');
	 * await ctx.seed({
	 *   seedId: 'admin-post',
	 *   collection: 'posts',
	 *   data: { authorId: adminUser?.id },
	 * });
	 * ```
	 */
	getSeeded: <T = Record<string, unknown>>(seedId: string) => Promise<SeededDocument<T> | null>;

	/**
	 * Create a seed entity with tracking.
	 *
	 * @param entity - Seed entity definition
	 * @returns The seeded document result
	 */
	seed: <T = Record<string, unknown>>(entity: SeedEntity<T>) => Promise<SeededDocument<T>>;

	/**
	 * Log a message (respects quiet mode).
	 *
	 * @param message - Message to log
	 */
	log: (message: string) => void;
}

/**
 * Global seeding options.
 */
export interface SeedingOptions {
	/**
	 * Default conflict handling strategy.
	 * @default 'skip'
	 */
	onConflict?: 'skip' | 'update' | 'error';

	/**
	 * When to run seeding on server start.
	 * - 'development': Only when NODE_ENV is 'development'
	 * - 'always': Run on every server start
	 * - true: Same as 'always'
	 * - false: Never run automatically (can be triggered via CLI)
	 * @default 'development'
	 */
	runOnStart?: boolean | 'development' | 'always';

	/**
	 * Suppress seeding log messages.
	 * @default false
	 */
	quiet?: boolean;
}

/**
 * Seeding configuration for Momentum CMS.
 */
export interface SeedingConfig {
	/**
	 * Default entities to seed first (in order).
	 * Uses helper methods for strict typing.
	 *
	 * @param helpers - Typed entity helpers
	 * @returns Array of seed entities to create
	 *
	 * @example
	 * ```typescript
	 * defaults: ({ user, collection }) => [
	 *   user('admin', { name: 'Admin', email: 'admin@example.com', role: 'admin' }),
	 *   collection<PostDoc>('posts').create('welcome', { title: 'Welcome!' }),
	 * ]
	 * ```
	 */
	defaults?: (helpers: DefaultEntityHelpers) => SeedEntity[];

	/**
	 * Custom seed function for complex scenarios.
	 * Runs after defaults, has access to SeedContext for dependency resolution.
	 *
	 * @param ctx - Seeding context with utilities
	 *
	 * @example
	 * ```typescript
	 * seed: async (ctx) => {
	 *   const admin = await ctx.getSeeded('admin');
	 *   await ctx.seed({
	 *     seedId: 'admin-post',
	 *     collection: 'posts',
	 *     data: { authorId: admin?.id },
	 *   });
	 * }
	 * ```
	 */
	seed?: (ctx: SeedContext) => Promise<void>;

	/**
	 * Global seeding options.
	 */
	options?: SeedingOptions;
}

/**
 * Internal seed tracking document stored in _momentum_seeds table.
 */
export interface SeedTrackingDocument {
	/**
	 * Primary key (auto-generated UUID).
	 */
	id: string;

	/**
	 * User-provided unique seed identifier.
	 */
	seedId: string;

	/**
	 * Collection the entity was seeded into.
	 */
	collection: string;

	/**
	 * Actual document ID in the target collection.
	 */
	documentId: string;

	/**
	 * SHA-256 hash of the seed data for change detection.
	 */
	checksum: string;

	/**
	 * When this seed was first created.
	 */
	createdAt: string;

	/**
	 * When this seed was last updated.
	 */
	updatedAt: string;
}

/**
 * Slug for the internal seed tracking collection.
 */
export const SEED_TRACKING_COLLECTION_SLUG = '_momentum_seeds';

/**
 * Error thrown when a seed conflict occurs with onConflict: 'error'.
 */
export class SeedConflictError extends Error {
	readonly seedId: string;
	readonly collection: string;

	constructor(seedId: string, collection: string) {
		super(`Seed conflict: seedId "${seedId}" already exists in collection "${collection}"`);
		this.name = 'SeedConflictError';
		this.seedId = seedId;
		this.collection = collection;
	}
}

/**
 * Information about a seed that was rolled back.
 */
export interface RolledBackSeed {
	/** The seed ID that was rolled back */
	seedId: string;
	/** The collection the seed was in */
	collection: string;
	/** The document ID that was deleted */
	documentId: string;
}

/**
 * Error thrown when seeding fails and rollback is performed.
 * Contains the original error and information about rolled back seeds.
 */
export class SeedRollbackError extends Error {
	/** The original error that caused the rollback */
	readonly originalError: Error;
	/** Seeds that were successfully rolled back */
	readonly rolledBackSeeds: RolledBackSeed[];
	/** Seeds that failed to roll back */
	readonly rollbackFailures: Array<{ seed: RolledBackSeed; error: Error }>;

	constructor(
		originalError: Error,
		rolledBackSeeds: RolledBackSeed[],
		rollbackFailures: Array<{ seed: RolledBackSeed; error: Error }>,
	) {
		const rollbackStatus =
			rollbackFailures.length > 0
				? `Rollback partially failed: ${rolledBackSeeds.length} rolled back, ${rollbackFailures.length} failed`
				: `Rollback successful: ${rolledBackSeeds.length} seeds removed`;

		super(`Seeding failed: ${originalError.message}. ${rollbackStatus}`);
		this.name = 'SeedRollbackError';
		this.originalError = originalError;
		this.rolledBackSeeds = rolledBackSeeds;
		this.rollbackFailures = rollbackFailures;
	}
}
