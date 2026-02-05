/**
 * Custom GraphQL scalar types for Momentum CMS.
 */
import { GraphQLScalarType, Kind } from 'graphql';

/** JSON scalar - accepts and returns arbitrary JSON values. */
export const GraphQLJSON = new GraphQLScalarType({
	name: 'JSON',
	description: 'Arbitrary JSON value',

	serialize(value: unknown): unknown {
		return value;
	},

	parseValue(value: unknown): unknown {
		return value;
	},

	parseLiteral(ast): unknown {
		switch (ast.kind) {
			case Kind.STRING:
				return ast.value;
			case Kind.BOOLEAN:
				return ast.value;
			case Kind.INT:
				return parseInt(ast.value, 10);
			case Kind.FLOAT:
				return parseFloat(ast.value);
			case Kind.OBJECT: {
				const value: Record<string, unknown> = {};
				for (const field of ast.fields) {
					value[field.name.value] = GraphQLJSON.parseLiteral(field.value, undefined);
				}
				return value;
			}
			case Kind.LIST:
				return ast.values.map((v) => GraphQLJSON.parseLiteral(v, undefined));
			case Kind.NULL:
				return null;
			default:
				return undefined;
		}
	},
});
