'use strict';

import { expect } from 'chai';
import { resolveTrustProxyHops } from '../../../src/utils/trust-proxy.js';

// Pure-function spec for the TRUST_PROXY config resolver. Lives under
// tests/v2/integration so it runs in the V2 mocha bucket, but the helper
// itself is version-agnostic.
//
// The behaviour matters because the previous implementation used
// `parseInt(rawValue, 10)`, which silently produced `NaN` for booleans
// and non-numeric strings. `app.set('trust proxy', NaN)` is treated as
// falsy by Express, so an operator who set `TRUST_PROXY=true` thinking
// they were enabling proxy trust would actually disable it without any
// log message.
describe('resolveTrustProxyHops', function () {
  const makeLog = () => {
    const warnings = [];
    return {
      warnings,
      logger: {
        warn: (msg) => warnings.push(msg),
      },
    };
  };

  describe('valid integer inputs (no warning)', function () {
    const validCases = [
      { label: '0 (number)', input: 0, expected: 0 },
      { label: '1 (number)', input: 1, expected: 1 },
      { label: '2 (number)', input: 2, expected: 2 },
      { label: '"0" (string)', input: '0', expected: 0 },
      { label: '"1" (string)', input: '1', expected: 1 },
      { label: '"  2  " (padded string)', input: '  2  ', expected: 2 },
      { label: '10 (large hop count)', input: 10, expected: 10 },
    ];

    validCases.forEach(({ label, input, expected }) => {
      it(`returns ${expected} for ${label}`, function () {
        const { logger, warnings } = makeLog();
        expect(resolveTrustProxyHops(input, logger)).to.equal(expected);
        expect(warnings, 'no warnings expected for valid input').to.have.length(0);
      });
    });
  });

  describe('empty / unset inputs default to 0 silently', function () {
    [
      { label: 'undefined', input: undefined },
      { label: 'null', input: null },
      { label: '"" (empty string)', input: '' },
      { label: '"   " (whitespace-only string)', input: '   ' },
    ].forEach(({ label, input }) => {
      it(`returns 0 for ${label} with no warning`, function () {
        const { logger, warnings } = makeLog();
        expect(resolveTrustProxyHops(input, logger)).to.equal(0);
        expect(warnings, 'no warnings expected for unset input').to.have.length(0);
      });
    });
  });

  describe('boolean inputs fall back to 0 with a warning', function () {
    // Booleans are the practical regression we are fixing: docker-entrypoint.sh
    // converts the env strings "true"/"false" to YAML booleans, and the
    // previous parseInt() produced NaN for both.
    [true, false].forEach((input) => {
      it(`returns 0 and warns for boolean \`${input}\``, function () {
        const { logger, warnings } = makeLog();
        expect(resolveTrustProxyHops(input, logger)).to.equal(0);
        expect(warnings).to.have.length(1);
        expect(warnings[0]).to.match(/TRUST_PROXY/);
        expect(warnings[0]).to.include(String(input));
      });
    });
  });

  describe('invalid number inputs fall back to 0 with a warning', function () {
    [
      { label: 'NaN', input: Number.NaN },
      { label: 'Infinity', input: Number.POSITIVE_INFINITY },
      { label: '-Infinity', input: Number.NEGATIVE_INFINITY },
      { label: '-1 (negative)', input: -1 },
      { label: '1.5 (non-integer)', input: 1.5 },
    ].forEach(({ label, input }) => {
      it(`returns 0 and warns for ${label}`, function () {
        const { logger, warnings } = makeLog();
        expect(resolveTrustProxyHops(input, logger)).to.equal(0);
        expect(warnings).to.have.length(1);
        expect(warnings[0]).to.match(/TRUST_PROXY/);
      });
    });
  });

  describe('non-integer string inputs fall back to 0 with a warning', function () {
    [
      'true',
      'false',
      'loopback',
      'linklocal',
      '10.0.0.1',
      '1.5',
      '+2',
      '-1',
      '2 hops',
      'two',
    ].forEach((input) => {
      it(`returns 0 and warns for "${input}"`, function () {
        const { logger, warnings } = makeLog();
        expect(resolveTrustProxyHops(input, logger)).to.equal(0);
        expect(warnings).to.have.length(1);
        expect(warnings[0]).to.match(/TRUST_PROXY/);
        expect(warnings[0]).to.include(input);
      });
    });
  });

  describe('unsupported types fall back to 0 with a warning', function () {
    [
      { label: 'array', input: [1, 2, 3] },
      { label: 'object', input: { hops: 1 } },
      { label: 'function', input: () => 1 },
    ].forEach(({ label, input }) => {
      it(`returns 0 and warns for ${label}`, function () {
        const { logger, warnings } = makeLog();
        expect(resolveTrustProxyHops(input, logger)).to.equal(0);
        expect(warnings).to.have.length(1);
        expect(warnings[0]).to.match(/TRUST_PROXY/);
      });
    });
  });

  describe('default logger argument', function () {
    // Every other case explicitly injects a stub logger. This case covers
    // the production call-site shape (no second argument) so the default
    // logger path is exercised at least once. We do not assert against
    // the real logger's output because that would couple this spec to
    // winston transport behaviour; we only assert the resolved value.
    it('returns the correct integer without throwing when no logger is supplied', function () {
      expect(resolveTrustProxyHops(2)).to.equal(2);
      expect(resolveTrustProxyHops(0)).to.equal(0);
    });

    it('falls back to 0 without throwing when no logger is supplied (invalid input)', function () {
      // The real logger should be invoked here; we accept whatever side
      // effects winston produces and only check the return value.
      expect(resolveTrustProxyHops(true)).to.equal(0);
      expect(resolveTrustProxyHops('loopback')).to.equal(0);
    });
  });

  describe('regression coverage for the parseInt() bug', function () {
    // The previous implementation was:
    //   const trustProxy = parseInt(getConfig().APP.TRUST_PROXY ?? 0, 10);
    // which produced NaN for all of these inputs.
    const regressions = [true, false, 'true', 'false', 'loopback'];

    regressions.forEach((input) => {
      it(`does not produce NaN for legacy regression input ${JSON.stringify(input)}`, function () {
        const { logger } = makeLog();
        const result = resolveTrustProxyHops(input, logger);
        expect(result).to.be.a('number');
        expect(Number.isNaN(result), 'must not be NaN').to.equal(false);
        expect(Number.isFinite(result), 'must be finite').to.equal(true);
      });
    });
  });
});
