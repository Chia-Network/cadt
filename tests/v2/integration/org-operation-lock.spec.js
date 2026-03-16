import { expect } from 'chai';
import sinon from 'sinon';
import {
  tryAcquireOrgLock,
  releaseOrgLock,
  updateOrgLockStatus,
  getOrgLockStatus,
} from '../../../src/utils/org-operation-lock.js';

describe('Organization Operation Lock', function () {

  afterEach(function () {
    releaseOrgLock();
  });

  describe('tryAcquireOrgLock', function () {
    it('should return a truthy token when lock is free', function () {
      const token = tryAcquireOrgLock('test operation');
      expect(token).to.be.a('string').that.is.not.empty;
    });

    it('should return null when lock already held', function () {
      tryAcquireOrgLock('first operation');
      const result = tryAcquireOrgLock('second operation');
      expect(result).to.be.null;
    });

    it('should return unique tokens on successive acquisitions', function () {
      const t1 = tryAcquireOrgLock('first');
      releaseOrgLock(t1);
      const t2 = tryAcquireOrgLock('second');
      expect(t1).to.not.equal(t2);
    });

    it('should report correct operation name via getOrgLockStatus', function () {
      tryAcquireOrgLock('V2 organization creation');
      expect(getOrgLockStatus().operation).to.equal('V2 organization creation');
    });

    it('should report lock as held via getOrgLockStatus when held', function () {
      tryAcquireOrgLock('test operation');
      expect(getOrgLockStatus()).to.not.be.null;
    });

    it('should set initial status to "Starting..."', function () {
      tryAcquireOrgLock('test operation');
      const status = getOrgLockStatus();
      expect(status.status).to.equal('Starting...');
    });

    it('should set startedAt timestamp', function () {
      const before = new Date().toISOString();
      tryAcquireOrgLock('test operation');
      const status = getOrgLockStatus();
      expect(status.startedAt).to.be.a('string');
      expect(new Date(status.startedAt).getTime()).to.be.at.least(new Date(before).getTime());
    });
  });

  describe('releaseOrgLock', function () {
    it('should release the lock when called with the correct token', function () {
      const token = tryAcquireOrgLock('first');
      const released = releaseOrgLock(token);
      expect(released).to.be.true;
      expect(getOrgLockStatus()).to.be.null;

      const t2 = tryAcquireOrgLock('second');
      expect(t2).to.be.a('string');
      expect(getOrgLockStatus().operation).to.equal('second');
    });

    it('should NOT release lock when called with a stale token', function () {
      const staleToken = tryAcquireOrgLock('first');
      releaseOrgLock(staleToken);

      tryAcquireOrgLock('second');
      const released = releaseOrgLock(staleToken);
      expect(released).to.be.false;
      expect(getOrgLockStatus()).to.not.be.null;
      expect(getOrgLockStatus().operation).to.equal('second');
    });

    it('should release unconditionally when called without a token (test cleanup)', function () {
      tryAcquireOrgLock('test');
      releaseOrgLock();
      expect(getOrgLockStatus()).to.be.null;
    });

    it('should be safe to call when lock is not held (no-op)', function () {
      releaseOrgLock();
      releaseOrgLock();
      expect(getOrgLockStatus()).to.be.null;
    });

    it('should make getOrgLockStatus return null', function () {
      tryAcquireOrgLock('test');
      releaseOrgLock();
      expect(getOrgLockStatus()).to.be.null;
    });
  });

  describe('ownership protection against TTL force-release', function () {
    let clock;

    afterEach(function () {
      if (clock) {
        clock.restore();
        clock = null;
      }
    });

    it('stale background .finally() should not release a new lock holder', function () {
      clock = sinon.useFakeTimers({ now: Date.now(), shouldAdvanceTime: false });

      const bgToken = tryAcquireOrgLock('slow background op');

      // Simulate TTL expiry and new acquisition
      clock.tick(60 * 60 * 1000 + 1);
      const newToken = tryAcquireOrgLock('new operation');
      expect(newToken).to.be.a('string');

      // Stale background finally runs with old token
      const released = releaseOrgLock(bgToken);
      expect(released).to.be.false;
      expect(getOrgLockStatus()).to.not.be.null;
      expect(getOrgLockStatus().operation).to.equal('new operation');

      // New holder can still release
      expect(releaseOrgLock(newToken)).to.be.true;
      expect(getOrgLockStatus()).to.be.null;
    });
  });

  describe('updateOrgLockStatus', function () {
    it('should update the status message when token matches', function () {
      const token = tryAcquireOrgLock('test');
      updateOrgLockStatus(token, 'Creating stores');
      const status = getOrgLockStatus();
      expect(status.status).to.equal('Creating stores');
    });

    it('should be reflected in getOrgLockStatus', function () {
      const token = tryAcquireOrgLock('test');
      updateOrgLockStatus(token, 'Phase 1');
      updateOrgLockStatus(token, 'Phase 2');
      expect(getOrgLockStatus().status).to.equal('Phase 2');
    });

    it('should reject updates from a stale token', function () {
      const staleToken = tryAcquireOrgLock('old');
      releaseOrgLock(staleToken);
      const newToken = tryAcquireOrgLock('new');
      updateOrgLockStatus(staleToken, 'stale update');
      expect(getOrgLockStatus().status).to.equal('Starting...');
      updateOrgLockStatus(newToken, 'valid update');
      expect(getOrgLockStatus().status).to.equal('valid update');
    });

    it('should reject updates after TTL force-release', function () {
      const clock = sinon.useFakeTimers({ now: Date.now(), shouldAdvanceTime: false });
      const bgToken = tryAcquireOrgLock('slow op');
      updateOrgLockStatus(bgToken, 'stuck');

      clock.tick(60 * 60 * 1000 + 1);
      const newToken = tryAcquireOrgLock('fresh op');
      expect(newToken).to.be.a('string');

      // Stale operation tries to update
      updateOrgLockStatus(bgToken, 'should be ignored');
      expect(getOrgLockStatus().status).to.equal('Starting...');

      // New holder can update
      updateOrgLockStatus(newToken, 'new status');
      expect(getOrgLockStatus().status).to.equal('new status');

      clock.restore();
    });
  });

  describe('getOrgLockStatus', function () {
    it('should return null when no lock held', function () {
      expect(getOrgLockStatus()).to.be.null;
    });

    it('should return full status object when lock held', function () {
      tryAcquireOrgLock('V1 to V2 upgrade');
      const status = getOrgLockStatus();
      expect(status).to.have.property('operation', 'V1 to V2 upgrade');
      expect(status).to.have.property('status', 'Starting...');
      expect(status).to.have.property('startedAt').that.is.a('string');
      expect(status).to.have.property('elapsedSeconds').that.is.a('number');
    });

    it('should include elapsedSeconds', function () {
      tryAcquireOrgLock('test');
      const status = getOrgLockStatus();
      expect(status.elapsedSeconds).to.be.a('number');
      expect(status.elapsedSeconds).to.be.at.least(0);
    });

    it('should reflect updated status message after updateOrgLockStatus', function () {
      const token = tryAcquireOrgLock('test');
      updateOrgLockStatus(token, 'Waiting for blockchain');
      const status = getOrgLockStatus();
      expect(status.status).to.equal('Waiting for blockchain');
    });
  });

  describe('cross-operation blocking', function () {
    it('should block a different operation name when lock is held', function () {
      tryAcquireOrgLock('V1 creation');
      const result = tryAcquireOrgLock('V2 creation');
      expect(result).to.be.null;
      expect(getOrgLockStatus().operation).to.equal('V1 creation');
    });
  });

  describe('staleness TTL', function () {
    let clock;

    afterEach(function () {
      if (clock) {
        clock.restore();
        clock = null;
      }
    });

    it('should reject acquisition when lock is held and under 1 hour old', function () {
      tryAcquireOrgLock('first');
      const result = tryAcquireOrgLock('second');
      expect(result).to.be.null;
      expect(getOrgLockStatus().operation).to.equal('first');
    });

    it('should force-release and re-acquire when lock exceeds 1 hour', function () {
      clock = sinon.useFakeTimers({ now: Date.now(), shouldAdvanceTime: false });
      tryAcquireOrgLock('stale operation');
      clock.tick(60 * 60 * 1000 + 1);
      const result = tryAcquireOrgLock('new operation');
      expect(result).to.be.a('string');
      expect(getOrgLockStatus().operation).to.equal('new operation');
    });

    it('should not force-release when lock is exactly at the threshold', function () {
      clock = sinon.useFakeTimers({ now: Date.now(), shouldAdvanceTime: false });
      tryAcquireOrgLock('threshold operation');
      clock.tick(60 * 60 * 1000 - 1);
      const result = tryAcquireOrgLock('new operation');
      expect(result).to.be.null;
      expect(getOrgLockStatus().operation).to.equal('threshold operation');
    });

    it('should reset status and startedAt after force-releasing stale lock', function () {
      clock = sinon.useFakeTimers({ now: Date.now(), shouldAdvanceTime: false });
      const token = tryAcquireOrgLock('stale op');
      updateOrgLockStatus(token, 'stuck somewhere');
      clock.tick(60 * 60 * 1000 + 1);
      tryAcquireOrgLock('fresh op');
      const status = getOrgLockStatus();
      expect(status.operation).to.equal('fresh op');
      expect(status.status).to.equal('Starting...');
      expect(status.elapsedSeconds).to.equal(0);
    });
  });
});
