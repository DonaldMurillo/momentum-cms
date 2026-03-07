/**
 * ESLint rule: no-silent-test-exit
 *
 * Bans bare `return;` statements inside test callbacks (it/test).
 * An early return in a test body means the remaining assertions are skipped
 * and the test passes silently — a false positive.
 *
 * BAD:  if (!value) return;          // test passes without running assertions
 * GOOD: if (!value) throw new Error('Expected value'); // test fails loudly
 * GOOD: expect(value).toBeDefined(); // assertion already fails
 *
 * If you need to conditionally skip a test, use `test.skip()` at the top.
 */
module.exports = {
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow bare return statements inside test callbacks that silently skip assertions',
			category: 'Best Practices',
			recommended: true,
		},
		messages: {
			noSilentTestExit:
				'Do not use bare `return` inside a test body — this silently passes the test without running remaining assertions. Throw an error or use a failing assertion instead.',
		},
		schema: [],
	},
	create(context) {
		/** Names that define test callbacks. */
		const testFunctionNames = new Set(['it', 'test']);

		/**
		 * Check if a node is inside the immediate callback of it()/test().
		 * Returns true only for the direct callback, not nested functions.
		 */
		function isInsideTestCallback(node) {
			let current = node.parent;
			let depth = 0;

			while (current) {
				// Track function boundaries — we only care about the direct test callback
				if (
					current.type === 'ArrowFunctionExpression' ||
					current.type === 'FunctionExpression'
				) {
					depth++;
					// If we're nested inside another function within the test, skip
					if (depth > 1) return false;

					// Check if this function is the callback of it()/test()
					const parent = current.parent;
					if (
						parent &&
						parent.type === 'CallExpression' &&
						parent.callee.type === 'Identifier' &&
						testFunctionNames.has(parent.callee.name)
					) {
						return true;
					}
					// Also handle it.each / test.each / describe.each style
					if (
						parent &&
						parent.type === 'CallExpression' &&
						parent.callee.type === 'MemberExpression' &&
						parent.callee.object.type === 'Identifier' &&
						testFunctionNames.has(parent.callee.object.name)
					) {
						return true;
					}
				}
				current = current.parent;
			}
			return false;
		}

		return {
			ReturnStatement(node) {
				// Only flag bare returns (no return value)
				if (node.argument !== null) return;

				// Must be inside an if statement (guard pattern)
				// Two shapes: `if (x) return;` (direct consequent) or `if (x) { return; }` (block)
				const parent = node.parent;
				if (!parent) return;
				const isDirectIfConsequent = parent.type === 'IfStatement';
				const isBlockInIf =
					parent.type === 'BlockStatement' &&
					parent.parent &&
					parent.parent.type === 'IfStatement';
				if (!isDirectIfConsequent && !isBlockInIf) return;

				if (isInsideTestCallback(node)) {
					context.report({ node, messageId: 'noSilentTestExit' });
				}
			},
		};
	},
};
