/**
 * Auto-generated types from Momentum CMS collection definitions.
 * DO NOT EDIT - This file is regenerated when collections change.
 * Generated at: 2026-02-03T00:01:05.838Z
 */

/**
 * Document type for the "posts" collection.
 */
export interface Posts {
	/** Unique document identifier */
	id: string;
	title: string;
	slug: string;
	content?: string;
	status?: 'draft' | 'published' | 'archived';
	featured?: boolean;
	/** Document creation timestamp */
	createdAt: string;
	/** Document last update timestamp */
	updatedAt: string;
}

/**
 * Document type for the "users" collection.
 */
export interface Users {
	/** Unique document identifier */
	id: string;
	name: string;
	email: string;
	authId?: string;
	role: 'admin' | 'editor' | 'viewer';
	active?: boolean;
	/** Document creation timestamp */
	createdAt: string;
	/** Document last update timestamp */
	updatedAt: string;
}

/**
 * Where clause type for querying the "posts" collection.
 */
export interface PostsWhereClause {
	id?: string | { equals?: string; not?: string; in?: string[] };
	title?: string | { equals?: string; not?: string; contains?: string; in?: string[] };
	slug?: string | { equals?: string; not?: string; contains?: string; in?: string[] };
	content?: string | { equals?: string; not?: string; contains?: string; in?: string[] };
	status?:
		| 'draft'
		| 'published'
		| 'archived'
		| {
				equals?: 'draft' | 'published' | 'archived';
				not?: 'draft' | 'published' | 'archived';
				in?: ('draft' | 'published' | 'archived')[];
		  };
	featured?: boolean | { equals?: boolean };
	createdAt?: string | { equals?: string; gt?: string; gte?: string; lt?: string; lte?: string };
	updatedAt?: string | { equals?: string; gt?: string; gte?: string; lt?: string; lte?: string };
}

/**
 * Where clause type for querying the "users" collection.
 */
export interface UsersWhereClause {
	id?: string | { equals?: string; not?: string; in?: string[] };
	name?: string | { equals?: string; not?: string; contains?: string; in?: string[] };
	email?: string | { equals?: string; not?: string; contains?: string; in?: string[] };
	authId?: string | { equals?: string; not?: string; contains?: string; in?: string[] };
	role?:
		| 'admin'
		| 'editor'
		| 'viewer'
		| {
				equals?: 'admin' | 'editor' | 'viewer';
				not?: 'admin' | 'editor' | 'viewer';
				in?: ('admin' | 'editor' | 'viewer')[];
		  };
	active?: boolean | { equals?: boolean };
	createdAt?: string | { equals?: string; gt?: string; gte?: string; lt?: string; lte?: string };
	updatedAt?: string | { equals?: string; gt?: string; gte?: string; lt?: string; lte?: string };
}

/**
 * All collection slugs in this Momentum CMS instance.
 */
export type CollectionSlug = 'posts' | 'users';

/**
 * Mapping from collection slug to document type.
 */
export interface MomentumCollections {
	posts: Posts;
	users: Users;
}

/**
 * Type-safe collection mapping for use with injectTypedMomentumAPI().
 * Includes both document types and where clause types.
 *
 * @example
 * ```typescript
 * import { injectTypedMomentumAPI } from '@momentum-cms/admin';
 * import type { TypedMomentumCollections } from './types/momentum.generated';
 *
 * const api = injectTypedMomentumAPI<TypedMomentumCollections>();
 * const posts = await api.posts.find({ where: { status: 'published' } });
 * ```
 */
export type TypedMomentumCollections = {
	posts: { doc: Posts; where: PostsWhereClause };
	users: { doc: Users; where: UsersWhereClause };
};

/**
 * Helper type for getting document type from collection slug.
 */
export type DocumentType<S extends CollectionSlug> = MomentumCollections[S];

/**
 * Helper type for getting where clause type from collection slug.
 */
export type WhereClauseType<S extends CollectionSlug> = TypedMomentumCollections[S]['where'];
