/**
 * GraphQL HTTP handler for Momentum CMS.
 *
 * Provides a framework-agnostic handler that executes GraphQL queries
 * against the auto-generated schema. Can be used by Express, h3, etc.
 */
import { graphql, parse, validate, type GraphQLSchema } from 'graphql';
import type { GraphQLContext } from './graphql-schema';
import type { UserContext } from '@momentum-cms/core';

/** Maximum allowed query depth to prevent DoS via deeply nested queries. */
const MAX_QUERY_DEPTH = 7;

/**
 * Simple depth-limit validation rule for GraphQL queries.
 * Returns an error if the query exceeds the maximum nesting depth.
 */
function depthLimitRule(maxDepth: number): (ctx: import('graphql').ValidationContext) => import('graphql').ASTVisitor {
	return (context) => {
		return {
			Document: {
				enter(node): void {
					checkDepth(node, 0, maxDepth, context);
				},
			},
		};
	};
}

function checkDepth(
	node: import('graphql').ASTNode,
	currentDepth: number,
	maxDepth: number,
	context: import('graphql').ValidationContext,
): void {
	if (node.kind === 'Field') {
		if (currentDepth > maxDepth) {
			context.reportError(
				new (require('graphql').GraphQLError)(
					`Query depth of ${currentDepth} exceeds maximum allowed depth of ${maxDepth}`,
					{ nodes: [node] },
				),
			);
			return;
		}
	}

	if ('selectionSet' in node && node.selectionSet) {
		const nextDepth = node.kind === 'Field' ? currentDepth + 1 : currentDepth;
		for (const selection of node.selectionSet.selections) {
			checkDepth(selection, nextDepth, maxDepth, context);
		}
	}

	if ('definitions' in node && node.definitions) {
		for (const def of node.definitions) {
			checkDepth(def, currentDepth, maxDepth, context);
		}
	}
}

/** Parsed GraphQL request body. */
export interface GraphQLRequestBody {
	query: string;
	variables?: Record<string, unknown>;
	operationName?: string;
}

/** Result from executeGraphQL. */
export interface GraphQLResult {
	status: number;
	body: unknown;
}

/**
 * Execute a GraphQL request against the provided schema.
 */
export async function executeGraphQL(
	schema: GraphQLSchema,
	requestBody: GraphQLRequestBody,
	context: {
		user?: UserContext;
	},
): Promise<GraphQLResult> {
	if (!requestBody.query) {
		return {
			status: 400,
			body: { errors: [{ message: 'Query is required' }] },
		};
	}

	// Parse and validate query depth before execution
	let document: import('graphql').DocumentNode;
	try {
		document = parse(requestBody.query);
	} catch {
		return {
			status: 400,
			body: { errors: [{ message: 'Query parsing failed' }] },
		};
	}

	const depthErrors = validate(schema, document, [depthLimitRule(MAX_QUERY_DEPTH)]);
	if (depthErrors.length > 0) {
		return {
			status: 400,
			body: { errors: depthErrors.map((e) => ({ message: e.message })) },
		};
	}

	const contextValue: GraphQLContext = {
		user: context.user,
	};

	const result = await graphql({
		schema,
		source: requestBody.query,
		variableValues: requestBody.variables,
		operationName: requestBody.operationName,
		contextValue,
	});

	return { status: 200, body: result };
}
