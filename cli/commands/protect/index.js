module.exports = protect;

var Promise = require('es6-promise').Promise; // jshint ignore:line

var debug = require('debug')('snyk');
var snyk = require('../../../lib/');
var protect = require('../../../lib/protect');
var analytics = require('../../../lib/analytics');

function protect(options) {
  if (!options) {
    options = {};
  }

  if (options.interactive) {
    // silently fail
    return Promise.reject(new Error('Snyk protect interactive mode ' +
      'has moved. Please run `snyk wizard`'));
  }

  if (options['dry-run']) {
    debug('*** dry run ****');
  } else {
    debug('~~~~ LIVE RUN ~~~~');
  }

  return snyk.policy.load().catch(function (error) {
    if (error.code === 'ENOENT') {
      error.code = 'MISSING_DOTFILE';
    }

    throw error;
  }).then(function (policy) {
    if (policy.patch) {
      return patch(policy, options);
    }
    return 'Nothing to do';
  });
}

function patch(policy, options) {
  return snyk.test(process.cwd(), {
    policy: policy,
    vulnEndpoint: '/vuln/npm/patches',
  }).then(function (res) {
    if (!res.vulnerabilities) {
      var e = new Error('Code is already patched');
      e.code = 'ALREADY_PATCHED';
      throw e;
    }
    return protect.patch(res, !options['dry-run']);
  }).then(function () {
    analytics.add('success', true);
    return 'Successfully applied Snyk patches';
  }).catch(function (e) {
    if (e.code === 'ALREADY_PATCHED') {
      analytics.add('success', true);
      return e.message + ', nothing to do';
    }

    analytics.add('success', false);

    throw e;
  });
}
