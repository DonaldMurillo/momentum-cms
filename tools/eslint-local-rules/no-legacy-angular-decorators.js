/**
 * ESLint rule to disallow legacy Angular decorators in favor of signal-based APIs.
 *
 * Banned decorators:
 * - @Input() -> use input()
 * - @Output() -> use output()
 * - @ViewChild() -> use viewChild()
 * - @ViewChildren() -> use viewChildren()
 * - @ContentChild() -> use contentChild()
 * - @ContentChildren() -> use contentChildren()
 * - @HostBinding() -> use host property in @Component
 * - @HostListener() -> use host property in @Component
 */
module.exports = {
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow legacy Angular decorators in favor of new signal-based APIs',
			category: 'Best Practices',
			recommended: true,
		},
		messages: {
			noInput:
				'Use input() instead of @Input(). Example: title = input<string>() or title = input.required<string>()',
			noOutput:
				'Use output() instead of @Output(). Example: clicked = output<void>() or clicked = output<MouseEvent>()',
			noViewChild:
				'Use viewChild() instead of @ViewChild(). Example: el = viewChild<ElementRef>("el") or el = viewChild.required<ElementRef>("el")',
			noViewChildren:
				'Use viewChildren() instead of @ViewChildren(). Example: items = viewChildren<ElementRef>("item")',
			noContentChild:
				'Use contentChild() instead of @ContentChild(). Example: content = contentChild<TemplateRef>("content")',
			noContentChildren:
				'Use contentChildren() instead of @ContentChildren(). Example: items = contentChildren<ElementRef>(ItemDirective)',
			noHostBinding:
				'Use host property in @Component instead of @HostBinding(). Example: @Component({ host: { "[class.active]": "isActive()" } })',
			noHostListener:
				'Use host property in @Component instead of @HostListener(). Example: @Component({ host: { "(click)": "onClick($event)" } })',
		},
		schema: [],
	},
	create(context) {
		const bannedDecorators = {
			Input: 'noInput',
			Output: 'noOutput',
			ViewChild: 'noViewChild',
			ViewChildren: 'noViewChildren',
			ContentChild: 'noContentChild',
			ContentChildren: 'noContentChildren',
			HostBinding: 'noHostBinding',
			HostListener: 'noHostListener',
		};

		return {
			Decorator(node) {
				// Handle @DecoratorName() or @DecoratorName
				let decoratorName = null;

				if (node.expression.type === 'CallExpression') {
					// @Decorator()
					if (node.expression.callee.type === 'Identifier') {
						decoratorName = node.expression.callee.name;
					}
				} else if (node.expression.type === 'Identifier') {
					// @Decorator (without parentheses - less common but valid)
					decoratorName = node.expression.name;
				}

				if (decoratorName && bannedDecorators[decoratorName]) {
					context.report({
						node,
						messageId: bannedDecorators[decoratorName],
					});
				}
			},
		};
	},
};
