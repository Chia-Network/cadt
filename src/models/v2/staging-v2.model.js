'use strict';

import _ from 'lodash';
import { uuid as uuidv4 } from 'uuidv4';
import { Sequelize, Model } from 'sequelize';
const Op = Sequelize.Op;

import { logger } from '../../config/logger';

import * as rxjs from 'rxjs';
import { sequelizeV2 as getSequelizeV2 } from '../../database/v2/index.js';

import ModelTypes from './staging-v2.modeltypes.cjs';

// Import V2 models
import {
  ProjectV2,
  UnitV2,
  ValidationV2,
  VerificationV2,
  IssuanceV2,
  MethodologyV2,
  LocationV2,
  StakeholderV2,
  LabelV2,
  CoBenefitV2,
  EstimationV2,
  RatingV2,
  ActivityV2,
  MetaV2
} from './index.js';

// Import V1 models for organization lookup
import { Organization } from '../../models';

// Import utilities
import { encodeHex, generateOffer } from '../../utils/datalayer-utils';
import { makeOffer } from '../../datalayer/persistance';
import { formatModelAssociationName } from '../../utils/model-utils.js';
import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls';

class StagingV2 extends Model {
  static get changes() {
    return this._changes || (this._changes = new rxjs.Subject());
  }

  static get defaultColumns() {
    return Object.keys(ModelTypes);
  }

  static associate() {
    // No associations for staging table
  }

  static async create(values, options) {
    const result = await super.create(values, options);
    this.changes.next({ action: 'create', data: result });
    return result;
  }

  static async destroy(options) {
    const result = await super.destroy(options);
    this.changes.next({ action: 'destroy', data: result });
    return result;
  }

  static async upsert(values, options) {
    const result = await super.upsert(values, options);
    this.changes.next({ action: 'upsert', data: result });
    return result;
  }

  static async generateOfferFile() {
    try {
      // Find transfer staging record
      const stagingRecord = await StagingV2.findOne({
        where: { isTransfer: true },
        raw: true,
      });

      if (!stagingRecord) {
        throw new Error('No transfer record found in v2 staging');
      }

      // Parse staged project data
      const makerProjectRecord = _.head(JSON.parse(stagingRecord.data));

      // Get home organization
      const myOrganization = await Organization.findOne({
        where: { isHome: true },
        raw: true,
      });

      // Get taker organization
      const takerOrganization = await Organization.findOne({
        where: { orgUid: makerProjectRecord.orgUid },
        raw: true,
      });

      // Use V2 registry stores (NOT v1)
      const maker = {
        storeId: myOrganization.v2RegistryId,  // V2 registry
        inclusions: []
      };

      const taker = {
        storeId: takerOrganization.v2RegistryId,  // V2 registry
        inclusions: []
      };

      // Find project with all associations in V2 database
      const takerProjectRecord = await ProjectV2.findOne({
        where: { cad_trust_project_id: makerProjectRecord.cad_trust_project_id },
        include: [
          { model: ValidationV2, as: 'validations' },
          { model: VerificationV2, as: 'verifications' },
          { model: IssuanceV2, as: 'issuances' },
          { model: LocationV2, as: 'locations' },
          { model: MethodologyV2, as: 'methodologies' },
          { model: StakeholderV2, as: 'stakeholders' },
          { model: LabelV2, as: 'labels' },
          { model: CoBenefitV2, as: 'coBenefits' },
          { model: EstimationV2, as: 'estimations' },
          { model: RatingV2, as: 'ratings' },
        ],
      });

      // Update taker's project status
      takerProjectRecord.project_status = 'Transitioned';

      // Generate new IDs for maker
      const newMakerProjectId = uuidv4();
      makerProjectRecord.cad_trust_project_id = newMakerProjectId;
      makerProjectRecord.org_uid = myOrganization.orgUid;

      // Handle child records (validations, verifications, locations, etc.)
      // Generate new UUIDs and reassign to maker's org
      const projectChildRecords = [
        'validations',
        'verifications',
        'issuances',
        'locations',
        'methodologies',
        'stakeholders',
        'labels',
        'coBenefits',
        'estimations',
        'ratings',
      ];

      // Each child record for the maker needs the new projectId
      projectChildRecords.forEach((childRecordSet) => {
        if (makerProjectRecord[childRecordSet]) {
          makerProjectRecord[childRecordSet].forEach((childRecord) => {
            // Generate new UUID for child record
            if (childRecord.cad_trust_validation_id) childRecord.cad_trust_validation_id = uuidv4();
            if (childRecord.cad_trust_verification_id) childRecord.cad_trust_verification_id = uuidv4();
            if (childRecord.cad_trust_issuance_id) childRecord.cad_trust_issuance_id = uuidv4();
            if (childRecord.cad_trust_location_id) childRecord.cad_trust_location_id = uuidv4();
            if (childRecord.cad_trust_methodology_id) childRecord.cad_trust_methodology_id = uuidv4();
            if (childRecord.cad_trust_stakeholder_id) childRecord.cad_trust_stakeholder_id = uuidv4();
            if (childRecord.cad_trust_label_id) childRecord.cad_trust_label_id = uuidv4();
            if (childRecord.cad_trust_co_benefit_id) childRecord.cad_trust_co_benefit_id = uuidv4();
            if (childRecord.cad_trust_estimation_id) childRecord.cad_trust_estimation_id = uuidv4();
            if (childRecord.cad_trust_rating_id) childRecord.cad_trust_rating_id = uuidv4();

            childRecord.org_uid = myOrganization.orgUid;
          });
        }
      });

      // Handle units - change status to 'Exported'
      const issuanceIds = takerProjectRecord.issuances.map(iss => iss.cad_trust_issuance_id);
      let unitTakerRecords = await UnitV2.findAll({
        where: {
          cad_trust_issuance_id: { [Op.in]: issuanceIds },
          org_uid: takerProjectRecord.org_uid,
        },
        raw: true,
      });

      unitTakerRecords = unitTakerRecords.map((record) => {
        record.unit_status = 'Exported';
        return record;
      });

      const unitMakerRecords = unitTakerRecords.map((record) => {
        return { ...record, org_uid: myOrganization.orgUid, cad_trust_unit_id: uuidv4() };
      });

      // Create XLS sheets for transformation
      const takerProjectXslsSheets = createXlsFromSequelizeResults({
        rows: [takerProjectRecord],
        model: ProjectV2,
        toStructuredCsv: true,
      });

      const makerProjectXslsSheets = createXlsFromSequelizeResults({
        rows: [makerProjectRecord],
        model: ProjectV2,
        toStructuredCsv: true,
      });

      const takerUnitXslsSheets = createXlsFromSequelizeResults({
        rows: unitTakerRecords,
        model: UnitV2,
        toStructuredCsv: true,
      });

      const makerUnitXslsSheets = createXlsFromSequelizeResults({
        rows: unitMakerRecords,
        model: UnitV2,
        toStructuredCsv: true,
      });

      // Transform to change lists using V2 primary key map
      const V2_PRIMARY_KEY_MAP = {
        project: 'cad_trust_project_id',
        validation: 'cad_trust_validation_id',
        verification: 'cad_trust_verification_id',
        issuance: 'cad_trust_issuance_id',
        unit: 'cad_trust_unit_id',
        methodology: 'cad_trust_methodology_id',
        project_methodology: 'id',
        location: 'cad_trust_location_id',
        stakeholder: 'cad_trust_stakeholder_id',
        stakeholder_projects: 'cad_trust_stakeholder_project_id',
        label: 'cad_trust_label_id',
        unit_label: 'id',
        co_benefit: 'cad_trust_co_benefit_id',
        estimation: 'cad_trust_estimation_id',
        rating: 'cad_trust_rating_id',
        activity: 'cad_trust_activity_id',
        aef_t1_submission: 'cad_trust_aef_t1_submission_id',
        aef_t2_authorizations: 'cad_trust_aef_t2_authorizations_id',
        aef_t3_actions: 'cad_trust_aef_t3_actions_id',
        aef_t4_holdings: 'cad_trust_aef_t4_holdings_id',
        aef_t5_authorized_entities: 'cad_trust_aef_t5_authorized_entities_id',
      };

      const makerInclusions = await transformFullXslsToChangeList(
        makerProjectXslsSheets,
        'insert',
        V2_PRIMARY_KEY_MAP
      );

      const takerInclusions = await transformFullXslsToChangeList(
        takerProjectXslsSheets,
        'insert',
        V2_PRIMARY_KEY_MAP
      );

      const takerUnitInclusions = await transformFullXslsToChangeList(
        takerUnitXslsSheets,
        'insert',
        V2_PRIMARY_KEY_MAP
      );

      const makerUnitInclusions = await transformFullXslsToChangeList(
        makerUnitXslsSheets,
        'insert',
        V2_PRIMARY_KEY_MAP
      );

      // Format and add to maker/taker
      const formatForOfferTransfer = (record) => {
        return record
          .filter((inclusion) => inclusion.action !== 'delete')
          .map((inclusion) => ({
            key: inclusion.key,
            value: inclusion.value,
          }));
      };

      // Add project inclusions
      if (takerInclusions?.project) {
        taker.inclusions.push(...formatForOfferTransfer(takerInclusions.project));
      }

      if (makerInclusions?.project) {
        maker.inclusions.push(...formatForOfferTransfer(makerInclusions.project));
      }

      // Add child record inclusions
      const childRecordTypes = [
        'validations', 'verifications', 'issuances', 'locations',
        'methodologies', 'stakeholders', 'labels', 'coBenefits',
        'estimations', 'ratings'
      ];

      childRecordTypes.forEach(childType => {
        if (makerInclusions?.[childType]) {
          maker.inclusions.push(...formatForOfferTransfer(makerInclusions[childType]));
        }
      });

      // Add unit inclusions
      if (takerUnitInclusions?.unit) {
        taker.inclusions.push(...formatForOfferTransfer(takerUnitInclusions.unit));
      }

      if (makerUnitInclusions?.unit) {
        maker.inclusions.push(...formatForOfferTransfer(makerUnitInclusions.unit));
      }

      // Generate and make offer
      const offerInfo = generateOffer(maker, taker);
      const offerResponse = await makeOffer(offerInfo);

      if (!offerResponse.success) {
        throw new Error(offerResponse.error);
      }

      // Save active offer trade ID to V2 meta table
      await MetaV2.upsert({
        meta_key: 'activeOfferTradeId',
        meta_value: offerResponse.offer.trade_id,
      });

      return _.omit(offerResponse, ['success']);
    } catch (error) {
      logger.error('Error in V2 staging offer generation:', error);
      throw new Error(error.message);
    }
  }
}

StagingV2.init(ModelTypes, {
  sequelize: getSequelizeV2(),
  modelName: 'staging',
  tableName: 'staging',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
  timezone: '+00:00',
  useHooks: true,
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_general_ci',
  },
  dialectOptions: {
    charset: 'utf8mb4',
    dateStrings: true,
    typeCast: true,
  },
});

export { StagingV2 };
