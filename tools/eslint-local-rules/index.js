/**
 * Custom ESLint rules for Momentum CMS
 */
const noLegacyAngularDecorators = require('./no-legacy-angular-decorators');
const noStandaloneTrue = require('./no-standalone-true');
const noDirectBrowserApis = require('./no-direct-browser-apis');
const noCatchSilentFailure = require('./no-catch-silent-failure');
const noOrLogicAssertions = require('./no-or-logic-assertions');

module.exports = {
	rules: {
		'no-legacy-angular-decorators': noLegacyAngularDecorators,
		'no-standalone-true': noStandaloneTrue,
		'no-direct-browser-apis': noDirectBrowserApis,
		'no-catch-silent-failure': noCatchSilentFailure,
		'no-or-logic-assertions': noOrLogicAssertions,
	},
};
