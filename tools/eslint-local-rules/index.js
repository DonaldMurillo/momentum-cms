/**
 * Custom ESLint rules for Momentum CMS
 */
const noLegacyAngularDecorators = require('./no-legacy-angular-decorators');

module.exports = {
	rules: {
		'no-legacy-angular-decorators': noLegacyAngularDecorators,
	},
};
