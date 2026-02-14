/**
 * GraphQL Schema Generator for Momentum CMS.
 *
 * Auto-generates a GraphQL schema from Momentum collection configs,
 * including query/mutation types with resolvers that delegate to the MomentumAPI.
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed for field type narrowing (SelectField spread) */

import {
	GraphQLSchema,
	GraphQLObjectType,
	GraphQLInputObjectType,
	GraphQLString,
	GraphQLInt,
	GraphQLFloat,
	GraphQLBoolean,
	GraphQLList,
	GraphQLNonNull,
	GraphQLID,
	GraphQLUnionType,
	GraphQLEnumType,
	type GraphQLOutputType,
	type GraphQLInputType,
	type GraphQLFieldConfig,
	type GraphQLFieldConfigMap,
	type GraphQLInputFieldConfigMap,
} from 'graphql';
import { GraphQLJSON } from './graphql-scalars';
import type { CollectionConfig, UserContext } from '@momentum-cms/core';
import {
	flattenDataFields,
	type Field,
	type SelectField,
	type BlocksField,
} from '@momentum-cms/core';
import { getMomentumAPI } from './momentum-api';

/** Context passed to every GraphQL resolver. */
export interface GraphQLContext {
	user?: UserContext;
}

/**
 * Build a full GraphQL schema from a list of collection configs.
 */
export function buildGraphQLSchema(collections: CollectionConfig[]): GraphQLSchema {
	const typeCache = new Map<string, GraphQLObjectType>();
	const inputCache = new Map<string, GraphQLInputObjectType>();
	const enumCache = new Map<string, GraphQLEnumType>();

	// ---------- helpers ----------

	function pascalCase(slug: string): string {
		return slug
			.split(/[-_\s]+/)
			.filter(Boolean)
			.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
			.join('');
	}

	/** Simple English singularization for GraphQL type names. */
	function singularize(word: string): string {
		if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
		if (word.endsWith('ses') || word.endsWith('xes') || word.endsWith('zes'))
			return word.slice(0, -2);
		if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
		return word;
	}

	function getSingularName(col: CollectionConfig): string {
		if (col.graphQL?.singularName) return col.graphQL.singularName;
		if (col.labels?.singular) return pascalCase(col.labels.singular);
		return singularize(pascalCase(col.slug));
	}

	function getPluralName(col: CollectionConfig): string {
		return col.graphQL?.pluralName ?? pascalCase(col.slug);
	}

	function getOrCreateEnum(field: SelectField, parentName: string): GraphQLEnumType {
		const key = `${parentName}_${field.name}`;
		if (enumCache.has(key)) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			return enumCache.get(key)!;
		}

		const values: Record<string, { value: string | number }> = {};
		for (const opt of field.options) {
			// GraphQL enum values must be valid identifiers
			const enumKey = String(opt.value)
				.replace(/[^A-Za-z0-9_]/g, '_')
				.toUpperCase();
			values[enumKey || `_${opt.value}`] = { value: opt.value };
		}

		const enumType = new GraphQLEnumType({
			name: `${parentName}_${pascalCase(field.name)}Enum`,
			values,
		});
		enumCache.set(key, enumType);
		return enumType;
	}

	/** Map a Momentum field to a GraphQL output type. */
	function fieldToGraphQLType(field: Field, parentName: string): GraphQLOutputType | null {
		switch (field.type) {
			case 'text':
			case 'textarea':
			case 'richText':
			case 'email':
			case 'password':
			case 'slug':
			case 'date':
				return GraphQLString;
			case 'number':
				return field.step && field.step % 1 !== 0 ? GraphQLFloat : GraphQLInt;
			case 'checkbox':
				return GraphQLBoolean;
			case 'json':
			case 'point':
				return GraphQLJSON;
			case 'select': {
				const enumType = getOrCreateEnum(field, parentName);
				return field.hasMany ? new GraphQLList(enumType) : enumType;
			}
			case 'radio': {
				// Radio is single-select, reuse enum logic
				const radioEnum = getOrCreateEnum(
					{ ...field, type: 'select', hasMany: false } as SelectField,
					parentName,
				);
				return radioEnum;
			}
			case 'upload':
				return field.hasMany ? new GraphQLList(GraphQLString) : GraphQLString;
			case 'relationship':
				return field.hasMany ? new GraphQLList(GraphQLID) : GraphQLID;
			case 'group':
				return getOrCreateObjectType(field.fields, `${parentName}_${pascalCase(field.name)}`);
			case 'array':
				return new GraphQLList(
					getOrCreateObjectType(field.fields, `${parentName}_${pascalCase(field.name)}Item`),
				);
			case 'blocks':
				return new GraphQLList(buildBlocksUnionType(field, parentName));
			// Layout fields don't produce output types
			case 'tabs':
			case 'collapsible':
			case 'row':
				return null;
			default:
				return GraphQLString;
		}
	}

	/** Map a Momentum field to a GraphQL input type. */
	function fieldToGraphQLInputType(field: Field, parentName: string): GraphQLInputType | null {
		switch (field.type) {
			case 'text':
			case 'textarea':
			case 'richText':
			case 'email':
			case 'password':
			case 'slug':
			case 'date':
				return GraphQLString;
			case 'number':
				return field.step && field.step % 1 !== 0 ? GraphQLFloat : GraphQLInt;
			case 'checkbox':
				return GraphQLBoolean;
			case 'json':
			case 'point':
				return GraphQLJSON;
			case 'select': {
				const enumType = getOrCreateEnum(field, parentName);
				return field.hasMany ? new GraphQLList(enumType) : enumType;
			}
			case 'radio': {
				const radioEnum = getOrCreateEnum(
					{ ...field, type: 'select', hasMany: false } as SelectField,
					parentName,
				);
				return radioEnum;
			}
			case 'upload':
				return field.hasMany ? new GraphQLList(GraphQLString) : GraphQLString;
			case 'relationship':
				return field.hasMany ? new GraphQLList(GraphQLID) : GraphQLID;
			case 'group':
				return getOrCreateInputType(field.fields, `${parentName}_${pascalCase(field.name)}`);
			case 'array':
				return new GraphQLList(
					getOrCreateInputType(field.fields, `${parentName}_${pascalCase(field.name)}Item`),
				);
			case 'blocks':
				return GraphQLJSON; // blocks input is complex; accept JSON
			case 'tabs':
			case 'collapsible':
			case 'row':
				return null;
			default:
				return GraphQLString;
		}
	}

	/** Build or retrieve a cached GraphQLObjectType for a set of fields. */
	function getOrCreateObjectType(fields: Field[], typeName: string): GraphQLObjectType {
		if (typeCache.has(typeName)) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			return typeCache.get(typeName)!;
		}

		const objType = new GraphQLObjectType({
			name: typeName,
			fields: () => {
				const gqlFields: GraphQLFieldConfigMap<unknown, GraphQLContext> = {};
				const dataFields = flattenDataFields(fields);
				for (const f of dataFields) {
					const gqlType = fieldToGraphQLType(f, typeName);
					if (gqlType) {
						gqlFields[f.name] = { type: gqlType };
					}
				}
				return gqlFields;
			},
		});

		typeCache.set(typeName, objType);
		return objType;
	}

	/** Build or retrieve a cached GraphQLInputObjectType. */
	function getOrCreateInputType(fields: Field[], typeName: string): GraphQLInputObjectType {
		const inputName = `${typeName}Input`;
		if (inputCache.has(inputName)) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			return inputCache.get(inputName)!;
		}

		const inputType = new GraphQLInputObjectType({
			name: inputName,
			fields: () => {
				const gqlFields: GraphQLInputFieldConfigMap = {};
				const dataFields = flattenDataFields(fields);
				for (const f of dataFields) {
					const gqlType = fieldToGraphQLInputType(f, typeName);
					if (gqlType) {
						gqlFields[f.name] = { type: gqlType };
					}
				}
				return gqlFields;
			},
		});

		inputCache.set(inputName, inputType);
		return inputType;
	}

	/** Build a union type for blocks field. */
	function buildBlocksUnionType(field: BlocksField, parentName: string): GraphQLUnionType {
		const types = field.blocks.map((block) => {
			const blockTypeName = `${parentName}_${pascalCase(field.name)}_${pascalCase(block.slug)}`;
			const blockObjType = new GraphQLObjectType({
				name: blockTypeName,
				fields: () => {
					const gqlFields: GraphQLFieldConfigMap<unknown, GraphQLContext> = {
						blockType: { type: GraphQLString },
					};
					const dataFields = flattenDataFields(block.fields);
					for (const f of dataFields) {
						const gqlType = fieldToGraphQLType(f, blockTypeName);
						if (gqlType) {
							gqlFields[f.name] = { type: gqlType };
						}
					}
					return gqlFields;
				},
			});
			return blockObjType;
		});

		return new GraphQLUnionType({
			name: `${parentName}_${pascalCase(field.name)}Block`,
			types,
			resolveType: (value: Record<string, unknown>) => {
				const blockType = value['blockType'];
				if (typeof blockType === 'string') {
					return `${parentName}_${pascalCase(field.name)}_${pascalCase(blockType)}`;
				}
				return types[0]?.name;
			},
		});
	}

	// ---------- Find result wrapper ----------

	/** Create a paginated result type for a collection. */
	function createFindResultType(
		col: CollectionConfig,
		docType: GraphQLObjectType,
	): GraphQLObjectType {
		const name = `${getPluralName(col)}Result`;
		return new GraphQLObjectType({
			name,
			fields: {
				docs: { type: new GraphQLList(new GraphQLNonNull(docType)) },
				totalDocs: { type: GraphQLInt },
				totalPages: { type: GraphQLInt },
				page: { type: GraphQLInt },
				limit: { type: GraphQLInt },
				hasNextPage: { type: GraphQLBoolean },
				hasPrevPage: { type: GraphQLBoolean },
			},
		});
	}

	// ---------- build queries & mutations ----------

	const queryFields: GraphQLFieldConfigMap<unknown, GraphQLContext> = {};
	const mutationFields: GraphQLFieldConfigMap<unknown, GraphQLContext> = {};

	for (const col of collections) {
		const singular = getSingularName(col);
		const plural = getPluralName(col);

		// Build doc object type with id + timestamps
		const docType = new GraphQLObjectType({
			name: singular,
			fields: () => {
				const fields: GraphQLFieldConfigMap<unknown, GraphQLContext> = {
					id: { type: new GraphQLNonNull(GraphQLID) },
				};

				const dataFields = flattenDataFields(col.fields);
				for (const f of dataFields) {
					const gqlType = fieldToGraphQLType(f, singular);
					if (gqlType) {
						fields[f.name] = { type: f.required ? new GraphQLNonNull(gqlType) : gqlType };
					}
				}

				// Timestamps
				if (col.timestamps !== false) {
					fields['createdAt'] = { type: GraphQLString };
					fields['updatedAt'] = { type: GraphQLString };
				}

				return fields;
			},
		});

		typeCache.set(singular, docType);

		// Build input type for mutations
		const inputType = new GraphQLInputObjectType({
			name: `${singular}Input`,
			fields: () => {
				const fields: GraphQLInputFieldConfigMap = {};
				const dataFields = flattenDataFields(col.fields);
				for (const f of dataFields) {
					// Skip auto-generated fields from mutation input
					if (f.type === 'password' && f.name === 'password') continue;
					const gqlType = fieldToGraphQLInputType(f, singular);
					if (gqlType) {
						fields[f.name] = { type: gqlType };
					}
				}
				return fields;
			},
		});

		inputCache.set(`${singular}Input`, inputType);

		const resultType = createFindResultType(col, docType);

		// --- Queries ---
		if (!col.graphQL?.disableQueries) {
			// findById
			queryFields[singular.charAt(0).toLowerCase() + singular.slice(1)] = {
				type: docType,
				args: {
					id: { type: new GraphQLNonNull(GraphQLID) },
				},
				resolve: async (
					_root: unknown,
					args: { id: string },
					context: GraphQLContext,
				): Promise<Record<string, unknown> | null> => {
					const api = getMomentumAPI();
					const ctx = buildAPIContext(context);
					const contextApi = Object.keys(ctx).length > 0 ? api.setContext(ctx) : api;
					return contextApi.collection(col.slug).findById(args.id);
				},
			} satisfies GraphQLFieldConfig<unknown, GraphQLContext>;

			// find (list)
			queryFields[plural.charAt(0).toLowerCase() + plural.slice(1)] = {
				type: resultType,
				args: {
					limit: { type: GraphQLInt },
					page: { type: GraphQLInt },
					sort: { type: GraphQLString },
				},
				resolve: async (
					_root: unknown,
					args: { limit?: number; page?: number; sort?: string },
					context: GraphQLContext,
				): Promise<unknown> => {
					const api = getMomentumAPI();
					const ctx = buildAPIContext(context);
					const contextApi = Object.keys(ctx).length > 0 ? api.setContext(ctx) : api;
					return contextApi.collection(col.slug).find({
						limit: args.limit,
						page: args.page,
						sort: args.sort,
					});
				},
			} satisfies GraphQLFieldConfig<unknown, GraphQLContext>;
		}

		// --- Mutations ---
		if (!col.graphQL?.disableMutations && !col.managed) {
			// create
			mutationFields[`create${singular}`] = {
				type: docType,
				args: {
					data: { type: new GraphQLNonNull(inputType) },
				},
				resolve: async (
					_root: unknown,
					args: { data: Record<string, unknown> },
					context: GraphQLContext,
				): Promise<unknown> => {
					const api = getMomentumAPI();
					const ctx = buildAPIContext(context);
					const contextApi = Object.keys(ctx).length > 0 ? api.setContext(ctx) : api;
					return contextApi.collection(col.slug).create(args.data);
				},
			} satisfies GraphQLFieldConfig<unknown, GraphQLContext>;

			// update
			mutationFields[`update${singular}`] = {
				type: docType,
				args: {
					id: { type: new GraphQLNonNull(GraphQLID) },
					data: { type: new GraphQLNonNull(inputType) },
				},
				resolve: async (
					_root: unknown,
					args: { id: string; data: Record<string, unknown> },
					context: GraphQLContext,
				): Promise<unknown> => {
					const api = getMomentumAPI();
					const ctx = buildAPIContext(context);
					const contextApi = Object.keys(ctx).length > 0 ? api.setContext(ctx) : api;
					return contextApi.collection(col.slug).update(args.id, args.data);
				},
			} satisfies GraphQLFieldConfig<unknown, GraphQLContext>;

			// delete
			mutationFields[`delete${singular}`] = {
				type: new GraphQLObjectType({
					name: `Delete${singular}Result`,
					fields: {
						id: { type: GraphQLID },
						deleted: { type: GraphQLBoolean },
					},
				}),
				args: {
					id: { type: new GraphQLNonNull(GraphQLID) },
				},
				resolve: async (
					_root: unknown,
					args: { id: string },
					context: GraphQLContext,
				): Promise<unknown> => {
					const api = getMomentumAPI();
					const ctx = buildAPIContext(context);
					const contextApi = Object.keys(ctx).length > 0 ? api.setContext(ctx) : api;
					return contextApi.collection(col.slug).delete(args.id);
				},
			} satisfies GraphQLFieldConfig<unknown, GraphQLContext>;
		}
	}

	// Build the schema
	const query = new GraphQLObjectType({
		name: 'Query',
		fields:
			Object.keys(queryFields).length > 0
				? queryFields
				: {
						_empty: {
							type: GraphQLString,
							resolve: (): string => 'No collections with queries enabled',
						},
					},
	});

	const mutation =
		Object.keys(mutationFields).length > 0
			? new GraphQLObjectType({ name: 'Mutation', fields: mutationFields })
			: undefined;

	return new GraphQLSchema({ query, mutation });
}

/** Build MomentumAPI context from GraphQL context. */
function buildAPIContext(context: GraphQLContext): Record<string, unknown> {
	const ctx: Record<string, unknown> = {};
	if (context.user) {
		ctx['user'] = context.user;
	}
	return ctx;
}
