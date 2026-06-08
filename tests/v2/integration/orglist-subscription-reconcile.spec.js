import { expect } from 'chai';
import sinon from 'sinon';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import {
  OrganizationsV2,
  MetaV2,
  GovernanceV2,
  ProjectV2,
  UnitV2,
  ValidationV2,
  VerificationV2,
  IssuanceV2,
  UnitLabelV2,
  LocationV2,
  EstimationV2,
  RatingV2,
  CoBenefitV2,
  ProjectMethodologyV2,
  StakeholderProjectV2,
  StakeholderV2,
  ProgramV2,
  LabelV2,
  MethodologyV2,
  AefT1SubmissionV2,
  AefT5AuthorizedEntitiesV2,
  AefT2AuthorizationsV2,
  AefT3ActionsV2,
  AefT4HoldingsV2,
  FilestoreV2,
} from '../../../src/models/v2/index.js';
import {
  buildOrgListAllowSet,
  removeOrgsNotInOrgList,
} from '../../../src/utils/orglist-subscription-reconcile.js';
import { purgeV2OrganizationData } from '../../../src/utils/v2-org-data-purge.js';
import { defaultConfig } from '../../../src/utils/defaultConfig.js';
import { v4 as uuidv4 } from 'uuid';

const GOVERNANCE_BODY_ID = defaultConfig.V2.GOVERNANCE.GOVERNANCE_BODY_ID;
const ORG_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ORG_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const ORG_C = 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';

const fieldNames = { orgUid: 'org_uid', isHome: 'is_home', subscribed: 'subscribed' };

const createOrg = (overrides) =>
  OrganizationsV2.create({
    name: 'Org',
    is_home: false,
    subscribed: true,
    synced: false,
    sync_remaining: 0,
    balance: '0',
    pending_balance: '0',
    metadata: '{}',
    registry_id: 'reg',
    data_model_version_store_id: 'singleton',
    ...overrides,
  });

describe('orglist-subscription-reconcile (V2)', function () {
  this.timeout(30000);

  before(async function () {
    await prepareV2Db();
  });

  const allDataModels = [
    OrganizationsV2,
    GovernanceV2,
    ProjectV2,
    UnitV2,
    ValidationV2,
    VerificationV2,
    IssuanceV2,
    UnitLabelV2,
    LocationV2,
    EstimationV2,
    RatingV2,
    CoBenefitV2,
    ProjectMethodologyV2,
    StakeholderProjectV2,
    StakeholderV2,
    ProgramV2,
    LabelV2,
    MethodologyV2,
    AefT1SubmissionV2,
    AefT5AuthorizedEntitiesV2,
    AefT2AuthorizationsV2,
    AefT3ActionsV2,
    AefT4HoldingsV2,
    FilestoreV2,
  ];

  beforeEach(async function () {
    for (const model of allDataModels) {
      await model.destroy({ where: {} });
    }
    // Clear the persisted user-deleted suppression list so recordUserDeleted
    // assertions don't leak across tests.
    await MetaV2.destroy({ where: {} });
  });

  describe('buildOrgListAllowSet', function () {
    it('should include orgList UIDs and governance body id', function () {
      const allowSet = buildOrgListAllowSet(
        [{ orgUid: ORG_A }, { orgUid: ORG_B }],
        GOVERNANCE_BODY_ID,
      );
      expect(allowSet.has(ORG_A)).to.equal(true);
      expect(allowSet.has(ORG_B)).to.equal(true);
      expect(allowSet.has(GOVERNANCE_BODY_ID)).to.equal(true);
      expect(allowSet.has(ORG_C)).to.equal(false);
    });
  });

  describe('removeOrgsNotInOrgList', function () {
    it('should skip when orglist is empty', async function () {
      const unsubscribeStub = sinon.stub().resolves();
      const deleteStub = sinon.stub().resolves();
      await removeOrgsNotInOrgList({
        defaultOrgList: [],
        allowSet: new Set(),
        organizationModel: OrganizationsV2,
        fieldNames,
        unsubscribeFromOrganizationStores: unsubscribeStub,
        deleteAllOrganizationData: deleteStub,
        logger: { info: () => {}, warn: () => {} },
      });
      expect(unsubscribeStub.called).to.equal(false);
      expect(deleteStub.called).to.equal(false);
    });

    it('should remove orgs not on orglist but keep home and governance body', async function () {
      await createOrg({ org_uid: ORG_A, name: 'Org A' });
      await createOrg({ org_uid: ORG_C, name: 'Org C' });
      await createOrg({ org_uid: GOVERNANCE_BODY_ID, name: 'Governance' });
      await createOrg({ org_uid: ORG_B, name: 'Home', is_home: true });

      const unsubscribed = [];
      const deleted = [];
      const defaultOrgList = [{ orgUid: ORG_A }];
      const allowSet = buildOrgListAllowSet(defaultOrgList, GOVERNANCE_BODY_ID);
      await removeOrgsNotInOrgList({
        defaultOrgList,
        allowSet,
        organizationModel: OrganizationsV2,
        fieldNames,
        unsubscribeFromOrganizationStores: async (org) => {
          unsubscribed.push(org.org_uid);
        },
        deleteAllOrganizationData: async (orgUid) => {
          deleted.push(orgUid);
          await OrganizationsV2.destroy({ where: { org_uid: orgUid } });
        },
        logger: { info: () => {}, warn: () => {} },
      });

      expect(unsubscribed).to.deep.equal([ORG_C]);
      expect(deleted).to.deep.equal([ORG_C]);

      const orgA = await OrganizationsV2.findOne({ where: { org_uid: ORG_A }, raw: true });
      const orgC = await OrganizationsV2.findOne({ where: { org_uid: ORG_C }, raw: true });
      const gov = await OrganizationsV2.findOne({
        where: { org_uid: GOVERNANCE_BODY_ID },
        raw: true,
      });
      const home = await OrganizationsV2.findOne({ where: { org_uid: ORG_B }, raw: true });

      expect(orgA).to.not.equal(null);
      expect(orgC).to.equal(null);
      expect(gov).to.not.equal(null);
      expect(home).to.not.equal(null);
    });

    it('should purge orgs already locally unsubscribed but off the orglist', async function () {
      await createOrg({ org_uid: ORG_C, name: 'Org C', subscribed: false });

      const unsubscribeStub = sinon.stub().resolves();
      const deleted = [];
      const defaultOrgList = [{ orgUid: ORG_A }];
      await removeOrgsNotInOrgList({
        defaultOrgList,
        allowSet: buildOrgListAllowSet(defaultOrgList, GOVERNANCE_BODY_ID),
        organizationModel: OrganizationsV2,
        fieldNames,
        unsubscribeFromOrganizationStores: unsubscribeStub,
        deleteAllOrganizationData: async (orgUid) => {
          deleted.push(orgUid);
          await OrganizationsV2.destroy({ where: { org_uid: orgUid } });
        },
        logger: { info: () => {}, warn: () => {} },
      });

      // Already unsubscribed -> DataLayer unsubscribe is skipped, but data is purged.
      expect(unsubscribeStub.called).to.equal(false);
      expect(deleted).to.deep.equal([ORG_C]);
    });

    it('should never remove a PENDING (in-progress) org record', async function () {
      await createOrg({ org_uid: 'PENDING', name: 'Pending', subscribed: true });

      const unsubscribeStub = sinon.stub().resolves();
      const deleteStub = sinon.stub().resolves();
      const defaultOrgList = [{ orgUid: ORG_A }];
      await removeOrgsNotInOrgList({
        defaultOrgList,
        allowSet: buildOrgListAllowSet(defaultOrgList, GOVERNANCE_BODY_ID),
        organizationModel: OrganizationsV2,
        fieldNames,
        unsubscribeFromOrganizationStores: unsubscribeStub,
        deleteAllOrganizationData: deleteStub,
        logger: { info: () => {}, warn: () => {} },
      });

      expect(deleteStub.called).to.equal(false);
      expect(unsubscribeStub.called).to.equal(false);
      const pending = await OrganizationsV2.findOne({
        where: { org_uid: 'PENDING' },
        raw: true,
      });
      expect(pending).to.not.equal(null);
    });

    it('should leave the org in place when DataLayer unsubscribe fails', async function () {
      await createOrg({ org_uid: ORG_C, name: 'Org C' });

      const deleteStub = sinon.stub().resolves();
      const defaultOrgList = [{ orgUid: ORG_A }];
      await removeOrgsNotInOrgList({
        defaultOrgList,
        allowSet: buildOrgListAllowSet(defaultOrgList, GOVERNANCE_BODY_ID),
        organizationModel: OrganizationsV2,
        fieldNames,
        unsubscribeFromOrganizationStores: async () => {
          throw new Error('datalayer unreachable');
        },
        deleteAllOrganizationData: deleteStub,
        logger: { info: () => {}, warn: () => {} },
      });

      expect(deleteStub.called).to.equal(false);
      const orgC = await OrganizationsV2.findOne({ where: { org_uid: ORG_C }, raw: true });
      expect(orgC).to.not.equal(null);
    });

    it('should purge synced registry data via deleteAllOrganizationData', async function () {
      await createOrg({ org_uid: ORG_C, name: 'Org C', registry_id: 'reg-c' });
      await ProjectV2.create({
        cadTrustProjectId: uuidv4(),
        orgUid: ORG_C,
        projectRegistryName: 'Removed Org Registry',
        projectId: 'proj-1',
        projectName: 'Stale Project',
      });

      const defaultOrgList = [{ orgUid: ORG_A }];
      await removeOrgsNotInOrgList({
        defaultOrgList,
        allowSet: buildOrgListAllowSet(defaultOrgList, GOVERNANCE_BODY_ID),
        organizationModel: OrganizationsV2,
        fieldNames,
        unsubscribeFromOrganizationStores: async () => {},
        deleteAllOrganizationData:
          OrganizationsV2.deleteAllOrganizationData.bind(OrganizationsV2),
        logger: { info: () => {}, warn: () => {} },
      });

      const orgC = await OrganizationsV2.findOne({ where: { org_uid: ORG_C }, raw: true });
      expect(orgC).to.equal(null);
      const projects = await ProjectV2.findAll({ where: { orgUid: ORG_C }, raw: true });
      expect(projects).to.have.length(0);
    });
  });

  describe('purgeV2OrganizationData', function () {
    // Number of rows seeded by seedOrgGraph for one org (one row per table
    // below). Kept in sync with the seed body so the exact deleted-row count
    // can be asserted.
    const SEEDED_ROWS_PER_ORG = 20;

    // Build a full registry graph for an org: a project plus every
    // project-scoped child, the verification -> issuance chain, a unit with a
    // unit_label, all standalone (org_uid) tables, AEF tier rows traced via
    // project/unit/t1, and a filestore cache row.
    const seedOrgGraph = async (orgUid, suffix) => {
      const projectId = uuidv4();
      const verificationId = uuidv4();
      const unitId = uuidv4();
      const aefT1SubmissionId = uuidv4();

      await ProjectV2.create({
        cadTrustProjectId: projectId,
        orgUid,
        projectRegistryName: `Registry ${suffix}`,
        projectId: `proj-${suffix}`,
        projectName: `Project ${suffix}`,
      });
      await ValidationV2.create({
        cadTrustValidationId: uuidv4(),
        validationId: `val-${suffix}`,
        cadTrustProjectId: projectId,
      });
      await LocationV2.create({
        cadTrustLocationId: uuidv4(),
        cadTrustProjectId: projectId,
      });
      await EstimationV2.create({
        cadTrustEstimationId: uuidv4(),
        estimationStartDate: '2024-01-01',
        estimationEndDate: '2024-12-31',
        cadTrustProjectId: projectId,
      });
      await RatingV2.create({
        cadTrustRatingId: uuidv4(),
        ratingName: `rating-${suffix}`,
        ratingValue: 'A',
        cadTrustProjectId: projectId,
      });
      await CoBenefitV2.create({
        cadTrustCoBenefitId: uuidv4(),
        coBenefitId: `cb-${suffix}`,
        cadTrustProjectId: projectId,
      });
      await ProjectMethodologyV2.create({
        cadTrustProjectMethodologyId: uuidv4(),
        cadTrustProjectId: projectId,
        cadTrustMethodologyId: uuidv4(),
      });
      await StakeholderProjectV2.create({
        cadTrustStakeholderProjectId: uuidv4(),
        cadTrustStakeholderId: uuidv4(),
        cadTrustProjectId: projectId,
      });
      await VerificationV2.create({
        cadTrustVerificationId: verificationId,
        verificationId: `ver-${suffix}`,
        cadTrustProjectId: projectId,
      });
      await IssuanceV2.create({
        cadTrustIssuanceId: uuidv4(),
        issuanceId: `iss-${suffix}`,
        cadTrustVerificationId: verificationId,
        cadTrustProjectMethodologyId: uuidv4(),
      });
      await UnitV2.create({
        cadTrustUnitId: unitId,
        orgUid,
        unitSerialId: `serial-${suffix}`,
        unitStartBlock: '1',
        unitEndBlock: '10',
        unitVintageYear: 2024,
        cadTrustIssuanceId: uuidv4(),
      });
      await UnitLabelV2.create({
        cadTrustUnitLabelId: uuidv4(),
        cadTrustUnitId: unitId,
        cadTrustLabelId: uuidv4(),
      });
      await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        orgUid,
        methodologyCode: `code-${suffix}`,
        methodologyName: `Methodology ${suffix}`,
      });
      await ProgramV2.create({
        cadTrustProgramId: uuidv4(),
        orgUid,
        programName: `Program ${suffix}`,
        programRegistry: `registry-${suffix}`,
        programRegistryActivityId: `activity-${suffix}`,
      });
      await StakeholderV2.create({
        cadTrustStakeholderId: uuidv4(),
        orgUid,
        stakeholderName: `Stakeholder ${suffix}`,
      });
      await LabelV2.create({
        cadTrustLabelId: uuidv4(),
        orgUid,
        labelName: `Label ${suffix}`,
      });
      await AefT1SubmissionV2.create({
        cadTrustAefT1SubmissionId: aefT1SubmissionId,
        orgUid,
        aefT1SubmissionParty: `party-${suffix}`,
        aefT1SubmissionVersion: '1',
        aefT1SubmissionReportYear: 2024,
        aefT1SubmissionSubmissionDate: '2024-01-01',
      });
      await AefT5AuthorizedEntitiesV2.create({
        cadTrustAefT5AuthorizedEntitiesId: uuidv4(),
        aefT5AuthorizedEntitiesAuthorizationDate: '2024-01-01',
        aefT5AuthorizedEntitiesName: `entity-${suffix}`,
        aefT5AuthorizedEntitiesId: `t5-${suffix}`,
        aefT5AuthorizedEntitiesCooperativeApproachId: `coop-${suffix}`,
        cadTrustProjectId: projectId,
        cadTrustUnitId: unitId,
        cadTrustAefT1SubmissionId: aefT1SubmissionId,
      });
      await AefT2AuthorizationsV2.create({
        cadTrustAefT2AuthorizationsId: uuidv4(),
        aefT2AuthorizationsId: `t2-${suffix}`,
        aefT2AuthorizationsDate: '2024-01-01',
        aefT2AuthorizationsCooperativeApproachId: `coop2-${suffix}`,
        aefT2AuthorizationsAuthorizedPartyId: `party2-${suffix}`,
        cadTrustProjectId: projectId,
        cadTrustUnitId: unitId,
      });
      await FilestoreV2.create({
        sha256: `sha-${suffix}`,
        org_uid: orgUid,
      });

      return { projectId, verificationId, unitId, aefT1SubmissionId };
    };

    const countOrgRows = async (orgUid, projectId, verificationId, unitId) => ({
      projects: await ProjectV2.count({ where: { orgUid } }),
      units: await UnitV2.count({ where: { orgUid } }),
      methodologies: await MethodologyV2.count({ where: { orgUid } }),
      programs: await ProgramV2.count({ where: { orgUid } }),
      stakeholders: await StakeholderV2.count({ where: { orgUid } }),
      labels: await LabelV2.count({ where: { orgUid } }),
      aefT1: await AefT1SubmissionV2.count({ where: { orgUid } }),
      filestore: await FilestoreV2.count({ where: { org_uid: orgUid } }),
      validations: await ValidationV2.count({ where: { cadTrustProjectId: projectId } }),
      locations: await LocationV2.count({ where: { cadTrustProjectId: projectId } }),
      estimations: await EstimationV2.count({ where: { cadTrustProjectId: projectId } }),
      ratings: await RatingV2.count({ where: { cadTrustProjectId: projectId } }),
      coBenefits: await CoBenefitV2.count({ where: { cadTrustProjectId: projectId } }),
      projectMethodologies: await ProjectMethodologyV2.count({
        where: { cadTrustProjectId: projectId },
      }),
      stakeholderProjects: await StakeholderProjectV2.count({
        where: { cadTrustProjectId: projectId },
      }),
      verifications: await VerificationV2.count({ where: { cadTrustProjectId: projectId } }),
      issuances: await IssuanceV2.count({ where: { cadTrustVerificationId: verificationId } }),
      unitLabels: await UnitLabelV2.count({ where: { cadTrustUnitId: unitId } }),
      aefT5: await AefT5AuthorizedEntitiesV2.count({ where: { cadTrustProjectId: projectId } }),
      aefT2: await AefT2AuthorizationsV2.count({ where: { cadTrustProjectId: projectId } }),
    });

    it('should delete every traced record of the removed org and preserve other orgs', async function () {
      const removed = await seedOrgGraph(ORG_C, 'c');
      const kept = await seedOrgGraph(ORG_A, 'a');

      const deletedCount = await purgeV2OrganizationData(ORG_C);
      expect(deletedCount).to.equal(SEEDED_ROWS_PER_ORG);

      const removedCounts = await countOrgRows(
        ORG_C,
        removed.projectId,
        removed.verificationId,
        removed.unitId,
      );
      for (const [table, count] of Object.entries(removedCounts)) {
        expect(count, `removed org still has ${table}`).to.equal(0);
      }

      const keptCounts = await countOrgRows(
        ORG_A,
        kept.projectId,
        kept.verificationId,
        kept.unitId,
      );
      for (const [table, count] of Object.entries(keptCounts)) {
        expect(count, `other org lost ${table}`).to.equal(1);
      }
    });

    it('should delete an AEF tier row owned only via its T1 submission (null project/unit)', async function () {
      const aefT1SubmissionId = uuidv4();
      await AefT1SubmissionV2.create({
        cadTrustAefT1SubmissionId: aefT1SubmissionId,
        orgUid: ORG_C,
        aefT1SubmissionParty: 'party-c',
        aefT1SubmissionVersion: '1',
        aefT1SubmissionReportYear: 2024,
        aefT1SubmissionSubmissionDate: '2024-01-01',
      });
      const aefT5Id = uuidv4();
      await AefT5AuthorizedEntitiesV2.create({
        cadTrustAefT5AuthorizedEntitiesId: aefT5Id,
        aefT5AuthorizedEntitiesAuthorizationDate: '2024-01-01',
        aefT5AuthorizedEntitiesName: 'entity-c',
        aefT5AuthorizedEntitiesId: 't5-c',
        aefT5AuthorizedEntitiesCooperativeApproachId: 'coop-c',
        cadTrustProjectId: null,
        cadTrustUnitId: null,
        cadTrustAefT1SubmissionId: aefT1SubmissionId,
      });

      await purgeV2OrganizationData(ORG_C);

      expect(
        await AefT5AuthorizedEntitiesV2.count({
          where: { cadTrustAefT5AuthorizedEntitiesId: aefT5Id },
        }),
      ).to.equal(0);
    });

    it('should purge standalone org data even when the org has no projects or units', async function () {
      await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        orgUid: ORG_C,
        methodologyCode: 'code-c',
        methodologyName: 'Methodology C',
      });
      await FilestoreV2.create({ sha256: 'sha-standalone-c', org_uid: ORG_C });

      const deletedCount = await purgeV2OrganizationData(ORG_C);

      expect(deletedCount).to.equal(2);
      expect(await MethodologyV2.count({ where: { orgUid: ORG_C } })).to.equal(0);
      expect(await FilestoreV2.count({ where: { org_uid: ORG_C } })).to.equal(0);
    });

    it('should be a no-op for a falsy orgUid', async function () {
      await ProjectV2.create({
        cadTrustProjectId: uuidv4(),
        orgUid: ORG_C,
        projectRegistryName: 'Registry',
        projectId: 'proj-c',
        projectName: 'Project C',
      });

      const deletedCount = await purgeV2OrganizationData('');

      expect(deletedCount).to.equal(0);
      expect(await ProjectV2.findAll({ raw: true })).to.have.length(1);
    });
  });

  describe('deleteAllOrganizationData (recordUserDeleted + mutex release)', function () {
    afterEach(function () {
      sinon.restore();
    });

    it('should NOT record the org as user-deleted when recordUserDeleted is false', async function () {
      await createOrg({ org_uid: ORG_C, name: 'Org C' });

      await OrganizationsV2.deleteAllOrganizationData(ORG_C, {
        recordUserDeleted: false,
      });

      const userDeleted = (await MetaV2.getUserDeletedOrgUids()) || [];
      expect(userDeleted).to.not.include(ORG_C);
    });

    it('should record the org as user-deleted by default', async function () {
      await createOrg({ org_uid: ORG_C, name: 'Org C' });

      await OrganizationsV2.deleteAllOrganizationData(ORG_C);

      const userDeleted = await MetaV2.getUserDeletedOrgUids();
      expect(userDeleted).to.include(ORG_C);
    });

    it('should release the org mutex when the post-commit meta write throws', async function () {
      await createOrg({ org_uid: ORG_C, name: 'Org C' });
      sinon
        .stub(MetaV2, 'addUserDeletedOrgUid')
        .rejects(new Error('meta write failed'));

      let threw = false;
      try {
        await OrganizationsV2.deleteAllOrganizationData(ORG_C);
      } catch {
        threw = true;
      }
      expect(threw).to.equal(true);
      sinon.restore();

      // If the mutex leaked, this second delete would hang and time out.
      await createOrg({ org_uid: ORG_A, name: 'Org A' });
      await OrganizationsV2.deleteAllOrganizationData(ORG_A, {
        recordUserDeleted: false,
      });
      const orgA = await OrganizationsV2.findOne({
        where: { org_uid: ORG_A },
        raw: true,
      });
      expect(orgA).to.equal(null);
    });
  });

  describe('removeOrgsNotInOrgList mass-removal logging', function () {
    it('should log the cycle summary at warn level when removals reach the threshold', async function () {
      for (let i = 0; i < 5; i += 1) {
        await createOrg({
          org_uid: 'd'.repeat(63) + i,
          name: `Org D${i}`,
          subscribed: false,
        });
      }

      const warnSpy = sinon.spy();
      const infoSpy = sinon.spy();
      const defaultOrgList = [{ orgUid: ORG_A }];
      await removeOrgsNotInOrgList({
        defaultOrgList,
        allowSet: buildOrgListAllowSet(defaultOrgList, GOVERNANCE_BODY_ID),
        organizationModel: OrganizationsV2,
        fieldNames,
        unsubscribeFromOrganizationStores: async () => {},
        deleteAllOrganizationData: async (orgUid) => {
          await OrganizationsV2.destroy({ where: { org_uid: orgUid } });
        },
        logger: { info: infoSpy, warn: warnSpy },
      });

      const summaryWarn = warnSpy
        .getCalls()
        .some((call) => /reconcile removed 5 organization/.test(call.args[0]));
      expect(summaryWarn).to.equal(true);
      sinon.restore();
    });
  });

  describe('defaultConfig', function () {
    it('should default ONLY_CADT_SUBSCRIPTIONS to true', function () {
      expect(defaultConfig.APP.ONLY_CADT_SUBSCRIPTIONS).to.equal(true);
    });
  });
});
