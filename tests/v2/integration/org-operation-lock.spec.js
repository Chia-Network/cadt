import { expect } from 'chai';
import {
  tryAcquireOrgLock,
  releaseOrgLock,
  getOrgLockOperation,
  isOrgLocked,
  updateOrgLockStatus,
  getOrgLockStatus,
} from '../../../src/utils/org-operation-lock.js';

describe('Organization Operation Lock', function () {

  afterEach(function () {
    releaseOrgLock();
  });

  describe('tryAcquireOrgLock', function () {
    it('should acquire lock when not held', function () {
      const result = tryAcquireOrgLock('test operation');
      expect(result).to.be.true;
    });

    it('should return false when lock already held', function () {
      tryAcquireOrgLock('first operation');
      const result = tryAcquireOrgLock('second operation');
      expect(result).to.be.false;
    });

    it('should report correct operation name via getOrgLockOperation', function () {
      tryAcquireOrgLock('V2 organization creation');
      expect(getOrgLockOperation()).to.equal('V2 organization creation');
    });

    it('should report isOrgLocked() as true when held', function () {
      tryAcquireOrgLock('test operation');
      expect(isOrgLocked()).to.be.true;
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
    it('should release the lock so it can be re-acquired', function () {
      tryAcquireOrgLock('first');
      releaseOrgLock();
      const result = tryAcquireOrgLock('second');
      expect(result).to.be.true;
      expect(getOrgLockOperation()).to.equal('second');
    });

    it('should clear operation name, status, and isOrgLocked after release', function () {
      tryAcquireOrgLock('test');
      releaseOrgLock();
      expect(getOrgLockOperation()).to.be.null;
      expect(isOrgLocked()).to.be.false;
    });

    it('should be safe to call when lock is not held (no-op)', function () {
      releaseOrgLock();
      releaseOrgLock();
      expect(isOrgLocked()).to.be.false;
    });

    it('should make getOrgLockStatus return null', function () {
      tryAcquireOrgLock('test');
      releaseOrgLock();
      expect(getOrgLockStatus()).to.be.null;
    });
  });

  describe('updateOrgLockStatus', function () {
    it('should update the status message', function () {
      tryAcquireOrgLock('test');
      updateOrgLockStatus('Creating stores');
      const status = getOrgLockStatus();
      expect(status.status).to.equal('Creating stores');
    });

    it('should be reflected in getOrgLockStatus', function () {
      tryAcquireOrgLock('test');
      updateOrgLockStatus('Phase 1');
      updateOrgLockStatus('Phase 2');
      expect(getOrgLockStatus().status).to.equal('Phase 2');
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
      tryAcquireOrgLock('test');
      updateOrgLockStatus('Waiting for blockchain');
      const status = getOrgLockStatus();
      expect(status.status).to.equal('Waiting for blockchain');
    });
  });

  describe('cross-operation blocking', function () {
    it('should block a different operation name when lock is held', function () {
      tryAcquireOrgLock('V1 creation');
      const result = tryAcquireOrgLock('V2 creation');
      expect(result).to.be.false;
      expect(getOrgLockOperation()).to.equal('V1 creation');
    });
  });
});
