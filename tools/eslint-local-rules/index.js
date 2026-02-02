/**
 * Custom ESLint rules for Momentum CMS
 */
const noLegacyAngularDecorators = require('./no-legacy-angular-decorators');
const noStandaloneTrue = require('./no-standalone-true');

module.exports = {
	rules: {
		'no-legacy-angular-decorators': noLegacyAngularDecorators,
		'no-standalone-true': noStandaloneTrue,
	},
};
