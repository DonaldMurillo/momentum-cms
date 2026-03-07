/**
 * Custom ESLint rules for Momentum CMS
 */
const noLegacyAngularDecorators = require('./no-legacy-angular-decorators');
const noStandaloneTrue = require('./no-standalone-true');
const noDirectBrowserApis = require('./no-direct-browser-apis');
const noCatchSilentFailure = require('./no-catch-silent-failure');
const noOrLogicAssertions = require('./no-or-logic-assertions');
const noNonNullAssertionDisable = require('./no-non-null-assertion-disable');
const noSilentTestExit = require('./no-silent-test-exit');

module.exports = {
	rules: {
		'no-legacy-angular-decorators': noLegacyAngularDecorators,
		'no-standalone-true': noStandaloneTrue,
		'no-direct-browser-apis': noDirectBrowserApis,
		'no-catch-silent-failure': noCatchSilentFailure,
		'no-or-logic-assertions': noOrLogicAssertions,
		'no-non-null-assertion-disable': noNonNullAssertionDisable,
		'no-silent-test-exit': noSilentTestExit,
	},
};
