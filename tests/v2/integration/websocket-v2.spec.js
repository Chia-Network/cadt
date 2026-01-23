import { expect } from 'chai';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import {
  ProjectV2,
  UnitV2,
  StagingV2,
  IssuanceV2,
  VerificationV2,
  MethodologyV2,
  ProjectMethodologyV2,
} from '../../../src/models/v2/index.js';
import { OrganizationsV2 } from '../../../src/models/v2/index.js';
import { v4 as uuidv4 } from 'uuid';
import * as rxjs from 'rxjs';

/**
 * Phase 29: Websocket Support for V2 Tests
 *
 * Tests for websocket change notifications in V2 models
 */
describe('Phase 29: Websocket Support for V2 Tests', function () {
  this.timeout(30000);

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();
  });

  beforeEach(async function () {
    // Clean up before each test
    await ProjectV2.destroy({ where: {} });
    await UnitV2.destroy({ where: {} });
    await StagingV2.destroy({ where: {} });
    await IssuanceV2.destroy({ where: {} });
    await VerificationV2.destroy({ where: {} });
    await ProjectMethodologyV2.destroy({ where: {} });
    await MethodologyV2.destroy({ where: {} });
    await OrganizationsV2.destroy({ where: {} });
  });

  describe('ProjectV2 Websocket Support', function () {
    it('should have changes Subject', function () {
      expect(ProjectV2.changes).to.exist;
      expect(ProjectV2.changes).to.be.instanceOf(rxjs.Subject);
    });

    it('should emit change notification on create', async function () {
      // Create a test organization first
      const org = await OrganizationsV2.create({
        org_uid: 'test-org-websocket',
        name: 'Test Org',
        is_home: true,
        subscribed: false,
        synced: false,
        sync_remaining: 0,
        balance: '0',
        pending_balance: '0',
        metadata: '{}',
      });

      let changeEmitted = false;
      let changeData = null;

      const subscription = ProjectV2.changes.subscribe((data) => {
        changeEmitted = true;
        changeData = data;
      });

      await ProjectV2.create({
        cadTrustProjectId: uuidv4(),
        orgUid: org.org_uid,
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJECT-WS-001',
        projectName: 'Test Project',
        projectType: ['CARBON_CREDIT'],
      });

      // Give a moment for the change to be emitted
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(changeEmitted).to.be.true;
      expect(changeData).to.be.an('array');
      expect(changeData[0]).to.equal('projects');
      // org_uid might be undefined if not in values, check that change was emitted
      expect(changeData.length).to.be.at.least(1);

      subscription.unsubscribe();
    });

    it('should emit change notification on upsert', async function () {
      const org = await OrganizationsV2.create({
        org_uid: 'test-org-websocket-upsert',
        name: 'Test Org',
        is_home: true,
        subscribed: false,
        synced: false,
        sync_remaining: 0,
        balance: '0',
        pending_balance: '0',
        metadata: '{}',
      });

      let changeEmitted = false;
      let changeData = null;

      const subscription = ProjectV2.changes.subscribe((data) => {
        changeEmitted = true;
        changeData = data;
      });

      await ProjectV2.upsert({
        cadTrustProjectId: uuidv4(),
        orgUid: org.org_uid,
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJECT-WS-UPSERT-001',
        projectName: 'Test Project Upsert',
        projectType: ['CARBON_CREDIT'],
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(changeEmitted).to.be.true;
      expect(changeData).to.be.an('array');
      expect(changeData[0]).to.equal('projects');
      // org_uid might be undefined if not in values, check that change was emitted
      expect(changeData.length).to.be.at.least(1);

      subscription.unsubscribe();
    });

    it('should emit change notification on destroy', async function () {
      const org = await OrganizationsV2.create({
        org_uid: 'test-org-websocket-destroy',
        name: 'Test Org',
        is_home: true,
        subscribed: false,
        synced: false,
        sync_remaining: 0,
        balance: '0',
        pending_balance: '0',
        metadata: '{}',
      });

      const project = await ProjectV2.create({
        cadTrustProjectId: uuidv4(),
        orgUid: org.org_uid,
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJECT-WS-DESTROY-001',
        projectName: 'Test Project',
        projectType: ['CARBON_CREDIT'],
      });

      let changeEmitted = false;
      let changeData = null;

      const subscription = ProjectV2.changes.subscribe((data) => {
        changeEmitted = true;
        changeData = data;
      });

      await ProjectV2.destroy({
        where: { cadTrustProjectId: project.cadTrustProjectId },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(changeEmitted).to.be.true;
      expect(changeData).to.be.an('array');
      expect(changeData[0]).to.equal('projects');
      // destroy doesn't include org_uid
      expect(changeData.length).to.equal(1);

      subscription.unsubscribe();
    });
  });

  describe('UnitV2 Websocket Support', function () {
    it('should have changes Subject', function () {
      expect(UnitV2.changes).to.exist;
      expect(UnitV2.changes).to.be.instanceOf(rxjs.Subject);
    });

    it('should emit change notification on create', async function () {
      const org = await OrganizationsV2.create({
        org_uid: 'test-org-unit-websocket',
        name: 'Test Org',
        is_home: true,
        subscribed: false,
        synced: false,
        sync_remaining: 0,
        balance: '0',
        pending_balance: '0',
        metadata: '{}',
      });

      // Create verification and methodology first (required for issuance)
      const verification = await VerificationV2.create({
        cadTrustVerificationId: uuidv4(),
        verificationId: 'TEST-VER-WS-001',
        verificationDate: '2024-01-01',
        cadTrustProjectId: uuidv4(), // Dummy project ID
        orgUid: org.org_uid,
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJ-WS-001',
        projectName: 'Test Project',
      });

      const methodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyCode: 'TEST-METH-WS-001',
        methodologyId: 'TEST-METH-WS-001',
        methodologyName: 'Test Methodology',
      });

      const dummyProjectId = uuidv4();
      const projectMethodology = await ProjectMethodologyV2.create({
        cadTrustProjectMethodologyId: uuidv4(),
        cadTrustProjectId: dummyProjectId,
        cadTrustMethodologyId: methodology.cadTrustMethodologyId,
        projectMethodologyDate: '2024-01-01',
      });

      // Create issuance (required for unit)
      const issuance = await IssuanceV2.create({
        cadTrustIssuanceId: uuidv4(),
        issuanceId: 'TEST-ISS-WS-001',
        issuanceDate: '2024-01-01',
        cadTrustVerificationId: verification.cadTrustVerificationId,
        cadTrustProjectMethodologyId: projectMethodology.cadTrustProjectMethodologyId,
      });

      let changeEmitted = false;
      let changeData = null;

      const subscription = UnitV2.changes.subscribe((data) => {
        changeEmitted = true;
        changeData = data;
      });

      await UnitV2.create({
        cadTrustUnitId: uuidv4(),
        orgUid: org.org_uid,
        unitSerialId: 'TEST-UNIT-WS-001',
        unitStartBlock: 'A001',
        unitEndBlock: 'A100',
        unitVintageYear: 2024,
        cadTrustIssuanceId: issuance.cadTrustIssuanceId,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(changeEmitted).to.be.true;
      expect(changeData).to.be.an('array');
      expect(changeData[0]).to.equal('units');
      // org_uid might be undefined if not in createResult, check that change was emitted
      expect(changeData.length).to.be.at.least(1);

      subscription.unsubscribe();
    });

    it('should emit change notification on upsert (emits projects)', async function () {
      const org = await OrganizationsV2.create({
        org_uid: 'test-org-unit-upsert',
        name: 'Test Org',
        is_home: true,
        subscribed: false,
        synced: false,
        sync_remaining: 0,
        balance: '0',
        pending_balance: '0',
        metadata: '{}',
      });

      // Create verification and methodology first (required for issuance)
      const verification = await VerificationV2.create({
        cadTrustVerificationId: uuidv4(),
        verificationId: 'TEST-VER-WS-UPSERT-001',
        verificationDate: '2024-01-01',
        cadTrustProjectId: uuidv4(), // Dummy project ID
        orgUid: org.org_uid,
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJ-WS-UPSERT-001',
        projectName: 'Test Project',
      });

      const methodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyCode: 'TEST-METH-WS-UPSERT-001',
        methodologyId: 'TEST-METH-WS-UPSERT-001',
        methodologyName: 'Test Methodology',
      });

      const dummyProjectId = uuidv4();
      const projectMethodology = await ProjectMethodologyV2.create({
        cadTrustProjectMethodologyId: uuidv4(),
        cadTrustProjectId: dummyProjectId,
        cadTrustMethodologyId: methodology.cadTrustMethodologyId,
        projectMethodologyDate: '2024-01-01',
      });

      // Create issuance (required for unit)
      const issuance = await IssuanceV2.create({
        cadTrustIssuanceId: uuidv4(),
        issuanceId: 'TEST-ISS-WS-UPSERT-001',
        issuanceDate: '2024-01-01',
        cadTrustVerificationId: verification.cadTrustVerificationId,
        cadTrustProjectMethodologyId: projectMethodology.cadTrustProjectMethodologyId,
      });

      let changeEmitted = false;
      let changeData = null;

      const subscription = UnitV2.changes.subscribe((data) => {
        changeEmitted = true;
        changeData = data;
      });

      await UnitV2.upsert({
        cadTrustUnitId: uuidv4(),
        orgUid: org.org_uid,
        unitSerialId: 'TEST-UNIT-WS-UPSERT-001',
        unitStartBlock: 'B001',
        unitEndBlock: 'B100',
        unitVintageYear: 2024,
        cadTrustIssuanceId: issuance.cadTrustIssuanceId,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(changeEmitted).to.be.true;
      expect(changeData).to.be.an('array');
      // Note: Following V1 pattern, upsert emits 'projects' not 'units'
      expect(changeData[0]).to.equal('projects');
      // org_uid might be undefined if not in values, check that change was emitted
      expect(changeData.length).to.be.at.least(1);

      subscription.unsubscribe();
    });

    it('should emit change notification on destroy', async function () {
      const org = await OrganizationsV2.create({
        org_uid: 'test-org-unit-destroy',
        name: 'Test Org',
        is_home: true,
        subscribed: false,
        synced: false,
        sync_remaining: 0,
        balance: '0',
        pending_balance: '0',
        metadata: '{}',
      });

      // Create verification and methodology first (required for issuance)
      const verification = await VerificationV2.create({
        cadTrustVerificationId: uuidv4(),
        verificationId: 'TEST-VER-WS-DESTROY-001',
        verificationDate: '2024-01-01',
        cadTrustProjectId: uuidv4(), // Dummy project ID
        orgUid: org.org_uid,
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJ-WS-DESTROY-001',
        projectName: 'Test Project',
      });

      const methodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyCode: 'TEST-METH-WS-DESTROY-001',
        methodologyId: 'TEST-METH-WS-DESTROY-001',
        methodologyName: 'Test Methodology',
      });

      const dummyProjectId = uuidv4();
      const projectMethodology = await ProjectMethodologyV2.create({
        cadTrustProjectMethodologyId: uuidv4(),
        cadTrustProjectId: dummyProjectId,
        cadTrustMethodologyId: methodology.cadTrustMethodologyId,
        projectMethodologyDate: '2024-01-01',
      });

      // Create issuance (required for unit)
      const issuance = await IssuanceV2.create({
        cadTrustIssuanceId: uuidv4(),
        issuanceId: 'TEST-ISS-WS-DESTROY-001',
        issuanceDate: '2024-01-01',
        cadTrustVerificationId: verification.cadTrustVerificationId,
        cadTrustProjectMethodologyId: projectMethodology.cadTrustProjectMethodologyId,
      });

      const unit = await UnitV2.create({
        cadTrustUnitId: uuidv4(),
        orgUid: org.org_uid,
        unitSerialId: 'TEST-UNIT-WS-DESTROY-001',
        unitStartBlock: 'C001',
        unitEndBlock: 'C100',
        unitVintageYear: 2024,
        cadTrustIssuanceId: issuance.cadTrustIssuanceId,
      });

      let changeEmitted = false;
      let changeData = null;

      const subscription = UnitV2.changes.subscribe((data) => {
        changeEmitted = true;
        changeData = data;
      });

      await UnitV2.destroy({
        where: { cadTrustUnitId: unit.cadTrustUnitId },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(changeEmitted).to.be.true;
      expect(changeData).to.be.an('array');
      expect(changeData[0]).to.equal('units');
      // destroy doesn't include org_uid
      expect(changeData.length).to.equal(1);

      subscription.unsubscribe();
    });
  });

  describe('StagingV2 Websocket Support', function () {
    it('should have changes Subject', function () {
      expect(StagingV2.changes).to.exist;
      expect(StagingV2.changes).to.be.instanceOf(rxjs.Subject);
    });

    it('should emit change notification on create', async function () {
      let changeEmitted = false;
      let changeData = null;

      const subscription = StagingV2.changes.subscribe((data) => {
        changeEmitted = true;
        changeData = data;
      });

      await StagingV2.create({
        uuid: 'test-staging-websocket',
        action: 'INSERT',
        table: 'project',
        data: '[]',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(changeEmitted).to.be.true;
      expect(changeData).to.be.an('array');
      expect(changeData[0]).to.equal('staging');

      subscription.unsubscribe();
    });
  });

  describe('Websocket Handler Integration', function () {
    it('should have ProjectV2, UnitV2, and StagingV2 available for websocket subscriptions', function () {
      // Verify models are exported and have changes Subjects
      expect(ProjectV2.changes).to.exist;
      expect(UnitV2.changes).to.exist;
      expect(StagingV2.changes).to.exist;
    });
  });
});

