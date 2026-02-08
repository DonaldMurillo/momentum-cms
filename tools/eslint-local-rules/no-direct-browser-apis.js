/**
 * ESLint rule to disallow direct browser API usage in Angular code.
 *
 * Forces SSR-safe patterns:
 * - Use inject(DOCUMENT) instead of `document`
 * - Use inject(DOCUMENT).defaultView instead of `window`
 * - Use inject(DOCUMENT).defaultView?.setTimeout() instead of setTimeout()
 * - etc.
 *
 * Allows usage inside afterNextRender / afterRender / afterRenderEffect callbacks
 * since those only run in the browser.
 */
module.exports = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow direct browser API usage. Use inject(DOCUMENT) and .defaultView for SSR safety.',
			category: 'Best Practices',
			recommended: true,
		},
		messages: {
			noWindow:
				'Do not use `window` directly. Use `inject(DOCUMENT).defaultView` instead for SSR safety.',
			noDocument:
				'Do not use `document` directly. Use `inject(DOCUMENT)` from @angular/common instead.',
			noGlobalThis:
				'Do not use `globalThis` directly. Use `inject(DOCUMENT).defaultView` for SSR safety.',
			noSetTimeout:
				'Do not use `setTimeout` directly. Use `inject(DOCUMENT).defaultView?.setTimeout()` or wrap in afterNextRender().',
			noSetInterval:
				'Do not use `setInterval` directly. Use `inject(DOCUMENT).defaultView?.setInterval()`.',
			noLocalStorage:
				'Do not use `localStorage` directly. Use `inject(DOCUMENT).defaultView?.localStorage`.',
			noSessionStorage:
				'Do not use `sessionStorage` directly. Use `inject(DOCUMENT).defaultView?.sessionStorage`.',
			noNavigator:
				'Do not use `navigator` directly. Use `inject(DOCUMENT).defaultView?.navigator`.',
			noLocation:
				'Do not use `location` directly. Use `inject(DOCUMENT).defaultView?.location` or Angular Router.',
			noRequestAnimationFrame:
				'Do not use `requestAnimationFrame` directly. Use `inject(DOCUMENT).defaultView?.requestAnimationFrame()`.',
		},
		schema: [],
	},
	create(context) {
		// Use Object.create(null) to avoid prototype pollution (e.g., 'constructor' lookup)
		const BANNED_GLOBALS = Object.assign(Object.create(null), {
			window: 'noWindow',
			document: 'noDocument',
			globalThis: 'noGlobalThis',
			setTimeout: 'noSetTimeout',
			setInterval: 'noSetInterval',
			localStorage: 'noLocalStorage',
			sessionStorage: 'noSessionStorage',
			navigator: 'noNavigator',
			location: 'noLocation',
			requestAnimationFrame: 'noRequestAnimationFrame',
		});

		const ALLOWED_WRAPPERS = new Set([
			'afterNextRender',
			'afterRender',
			'afterRenderEffect',
		]);

		/**
		 * Check if the node is inside an afterNextRender/afterRender/afterRenderEffect callback.
		 * Walks up the AST parent chain to find a wrapping CallExpression.
		 */
		function isInsideAllowedWrapper(node) {
			let current = node.parent;
			while (current) {
				if (current.type === 'CallExpression') {
					const callee = current.callee;
					if (callee.type === 'Identifier' && ALLOWED_WRAPPERS.has(callee.name)) {
						return true;
					}
				}
				current = current.parent;
			}
			return false;
		}

		/**
		 * Check if the node is in a typeof expression (e.g., typeof window !== 'undefined').
		 * These SSR guard checks are safe and should be allowed.
		 */
		function isInTypeofExpression(node) {
			return node.parent && node.parent.type === 'UnaryExpression' && node.parent.operator === 'typeof';
		}

		/**
		 * Check if the node is in a type annotation position (TypeScript types).
		 */
		function isInTypePosition(node) {
			let current = node.parent;
			while (current) {
				if (
					current.type === 'TSTypeReference' ||
					current.type === 'TSTypeAnnotation' ||
					current.type === 'TSTypeQuery' ||
					current.type === 'TSQualifiedName'
				) {
					return true;
				}
				current = current.parent;
			}
			return false;
		}

		return {
			Identifier(node) {
				const name = node.name;
				if (!BANNED_GLOBALS[name]) return;

				// Skip property access positions: obj.document, obj.window, etc.
				if (
					node.parent.type === 'MemberExpression' &&
					node.parent.property === node &&
					!node.parent.computed
				) {
					return;
				}

				// Skip destructuring pattern keys: { document: myDoc }
				if (node.parent.type === 'Property' && node.parent.key === node && !node.parent.computed) {
					// Unless it's shorthand: { document } which is both key and value
					if (!node.parent.shorthand) {
						return;
					}
				}

				// Skip class property/method definitions: private readonly document = inject(DOCUMENT)
				if (
					(node.parent.type === 'PropertyDefinition' || node.parent.type === 'MethodDefinition') &&
					node.parent.key === node
				) {
					return;
				}

				// Skip typeof guards: typeof window !== 'undefined'
				if (isInTypeofExpression(node)) return;

				// Skip TypeScript type positions
				if (isInTypePosition(node)) return;

				// Allow inside afterNextRender / afterRender / afterRenderEffect
				if (isInsideAllowedWrapper(node)) return;

				// Skip if variable is locally defined (shadows the global)
				// e.g., const document = inject(DOCUMENT);
				const scope = context.sourceCode
					? context.sourceCode.getScope(node)
					: context.getScope();
				const variable = scope.set && scope.set.get(name);
				if (variable && variable.defs && variable.defs.length > 0) return;

				context.report({
					node,
					messageId: BANNED_GLOBALS[name],
				});
			},
		};
	},
};
