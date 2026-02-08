/**
 * Custom ESLint rules for Momentum CMS
 */
const noLegacyAngularDecorators = require('./no-legacy-angular-decorators');
const noStandaloneTrue = require('./no-standalone-true');
const noDirectBrowserApis = require('./no-direct-browser-apis');

module.exports = {
	rules: {
		'no-legacy-angular-decorators': noLegacyAngularDecorators,
		'no-standalone-true': noStandaloneTrue,
		'no-direct-browser-apis': noDirectBrowserApis,
	},
};
