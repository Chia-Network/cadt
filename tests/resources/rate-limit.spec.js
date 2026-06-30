import { expect } from 'chai';
import { getRateLimitRetryAfterSeconds } from '../../src/utils/rate-limit.js';

describe('Rate limit utilities', function () {
  it('returns seconds remaining until reset', function () {
    const now = 1_700_000_000_000;
    const resetTime = new Date(now + 4_500);

    expect(getRateLimitRetryAfterSeconds(resetTime, now)).to.equal(5);
  });

  it('returns zero when the reset time has already passed', function () {
    const now = 1_700_000_000_000;
    const resetTime = new Date(now - 1_000);

    expect(getRateLimitRetryAfterSeconds(resetTime, now)).to.equal(0);
  });

  it('returns zero when reset time is missing or invalid', function () {
    expect(getRateLimitRetryAfterSeconds()).to.equal(0);
    expect(getRateLimitRetryAfterSeconds(new Date('invalid date'))).to.equal(0);
  });
});
