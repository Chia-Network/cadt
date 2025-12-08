'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { Sequelize } from 'sequelize';
const Op = Sequelize.Op;

import { loggerV2 } from '../../config/logger.js';
import {
  StagingV2,
  OrganizationsV2,
  MetaV2,
  ProjectV2,
  UnitV2,
  LocationV2,
  EstimationV2,
  RatingV2,
  CoBenefitV2,
} from './index.js';
import { generateOffer } from '../../utils/datalayer-utils.js';
import * as datalayerPersistance from '../../datalayer/persistance.js';
import { getConfig } from '../../utils/config-loader.js';
import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls.js';

const CONFIG = getConfig().APP;

/**
 * OfferV2 Model
 *
 * Handles offer/transfer operations for V2 system.
 * Note: This is a utility class, not a Sequelize model.
 */
class OfferV2 {
  /**
   * Generate offer file from staging transfer records
   * @returns {Promise<Object>} Offer file response (without success field)
   */
  static async generateOfferFile() {
    try {
      const stagingRecord = await StagingV2.findOne({
        where: { is_transfer: true },
        raw: true,
      });

      if (!stagingRecord) {
        throw new Error('No transfer record found in staging');
      }

      const makerProjectRecord = _.head(JSON.parse(stagingRecord.data));

      const myOrganization = await OrganizationsV2.findOne({
        where: { is_home: true },
        raw: true,
      });

      if (!myOrganization) {
        throw new Error('Home organization not found');
      }

      // The record still has the org_uid of the makerProjectRecord,
      // we will update this to the correct org_uid later
      const takerOrganization = await OrganizationsV2.findOne({
        where: { org_uid: makerProjectRecord.org_uid || makerProjectRecord.orgUid },
        raw: true,
      });

      if (!takerOrganization) {
        throw new Error(`Organization ${makerProjectRecord.org_uid || makerProjectRecord.orgUid} not found`);
      }

      const maker = { inclusions: [] };
      const taker = { inclusions: [] };

      taker.storeId = takerOrganization.registry_id;
      maker.storeId = myOrganization.registry_id;

      // Get taker project with associations
      const projectId = makerProjectRecord.cad_trust_project_id || makerProjectRecord.cadTrustProjectId;
      const takerProjectRecord = await ProjectV2.findByPk(projectId, {
        include: [
          { model: LocationV2, as: 'locations', required: false },
          { model: EstimationV2, as: 'estimations', required: false },
          { model: RatingV2, as: 'ratings', required: false },
          { model: CoBenefitV2, as: 'coBenefits', required: false },
        ],
      });

      if (!takerProjectRecord) {
        throw new Error(`Project ${projectId} not found`);
      }

      // Set project status to Transitioned for taker
      takerProjectRecord.project_status = 'Transitioned';

      // Create new project ID for maker
      const newMakerProjectId = uuidv4();
      makerProjectRecord.cad_trust_project_id = newMakerProjectId;
      makerProjectRecord.org_uid = myOrganization.org_uid;

      // V2 project child records (snake_case)
      const projectChildRecords = [
        'locations',
        'estimations',
        'ratings',
        'co_benefits',
      ];

      // Each child record for the maker needs the new projectId
      projectChildRecords.forEach((childRecordSet) => {
        const camelCaseKey = childRecordSet === 'co_benefits' ? 'coBenefits' : childRecordSet;
        if (makerProjectRecord[camelCaseKey] || makerProjectRecord[childRecordSet]) {
          const childRecords = makerProjectRecord[camelCaseKey] || makerProjectRecord[childRecordSet];
          childRecords.forEach((childRecord) => {
            childRecord.cad_trust_project_id = newMakerProjectId;
            childRecord.org_uid = myOrganization.org_uid;
          });
        }
      });

      // Get units associated with project's verifications/issuances
      // Note: V2 structure - units are linked through issuances which are linked through verifications
      // For now, we'll get units by org_uid - this may need refinement based on actual V2 relationships
      // TODO: Adapt based on actual V2 unit/issuance/verification relationship structure
      const issuanceIds = []; // Placeholder - will need to get from verifications/issuances

      let unitTakerRecords = [];
      if (issuanceIds.length > 0) {
        unitTakerRecords = await UnitV2.findAll({
          where: {
            cad_trust_issuance_id: { [Op.in]: issuanceIds },
            org_uid: takerProjectRecord.org_uid,
          },
          raw: true,
        });
      }

      // Makers get an unaltered copy of all the project units from the taker
      const unitMakerRecords = _.cloneDeep(unitTakerRecords);

      unitTakerRecords = unitTakerRecords.map((record) => {
        record.unit_status = 'Exported';
        record.cad_trust_unit_id = uuidv4();
        record.org_uid = myOrganization.org_uid;
        return record;
      });

      // Primary key maps for V2 (using snake_case)
      const primaryProjectKeyMap = {
        project: 'cad_trust_project_id',
        location: 'cad_trust_location_id',
        estimation: 'cad_trust_estimation_id',
        rating: 'cad_trust_rating_id',
        co_benefit: 'cad_trust_co_benefit_id',
      };

      const primaryUnitKeyMap = {
        unit: 'cad_trust_unit_id',
      };

      // Map sheet names from model.name to table name
      const mapSheetNames = (xslsSheets, modelName, tableName) => {
        if (!xslsSheets) {
          return xslsSheets;
        }
        const mapped = { ...xslsSheets };
        if (mapped[modelName]) {
          mapped[tableName] = mapped[modelName];
          delete mapped[modelName];
        }
        // Map child table names if they exist
        const childMappings = {
          LocationV2: 'location',
          EstimationV2: 'estimation',
          RatingV2: 'rating',
          CoBenefitV2: 'co_benefit',
        };
        Object.keys(childMappings).forEach((childModelName) => {
          if (mapped[childModelName]) {
            mapped[childMappings[childModelName]] = mapped[childModelName];
            delete mapped[childModelName];
          }
        });
        return mapped;
      };

      // Model maps for checking existing records
      const projectModelMap = {
        project: ProjectV2,
        location: LocationV2,
        estimation: EstimationV2,
        rating: RatingV2,
        co_benefit: CoBenefitV2,
      };

      const unitModelMap = {
        unit: UnitV2,
      };

      // Convert to XLS format and then to change list
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

      const makerProjectInclusions = await transformFullXslsToChangeList(
        mapSheetNames(makerProjectXslsSheets, ProjectV2.name, 'project'),
        'insert',
        primaryProjectKeyMap,
        projectModelMap,
      );

      const takerProjectInclusions = await transformFullXslsToChangeList(
        mapSheetNames(takerProjectXslsSheets, ProjectV2.name, 'project'),
        'insert',
        primaryProjectKeyMap,
        projectModelMap,
      );

      const takerUnitInclusions = await transformFullXslsToChangeList(
        mapSheetNames(takerUnitXslsSheets, UnitV2.name, 'unit'),
        'insert',
        primaryUnitKeyMap,
        unitModelMap,
      );

      const makerUnitInclusions = await transformFullXslsToChangeList(
        mapSheetNames(makerUnitXslsSheets, UnitV2.name, 'unit'),
        'insert',
        primaryUnitKeyMap,
        unitModelMap,
      );

      const formatForOfferTransfer = (record) => {
        return record
          .filter((inclusion) => inclusion.action !== 'delete')
          .map((inclusion) => ({
            key: inclusion.key,
            value: inclusion.value,
          }));
      };

      taker.inclusions.push(
        ...formatForOfferTransfer(takerProjectInclusions.project || []),
      );

      if (takerUnitInclusions?.unit) {
        taker.inclusions.push(
          ...formatForOfferTransfer(takerUnitInclusions.unit),
        );
      }

      if (makerProjectInclusions?.project) {
        maker.inclusions.push(
          ...formatForOfferTransfer(makerProjectInclusions.project),
        );
      }

      // Add child records to maker inclusions
      if (makerProjectInclusions?.location) {
        maker.inclusions.push(
          ...formatForOfferTransfer(makerProjectInclusions.location),
        );
      }

      if (makerProjectInclusions?.estimation) {
        maker.inclusions.push(
          ...formatForOfferTransfer(makerProjectInclusions.estimation),
        );
      }

      if (makerProjectInclusions?.rating) {
        maker.inclusions.push(
          ...formatForOfferTransfer(makerProjectInclusions.rating),
        );
      }

      if (makerProjectInclusions?.co_benefit) {
        maker.inclusions.push(
          ...formatForOfferTransfer(makerProjectInclusions.co_benefit),
        );
      }

      if (makerUnitInclusions?.unit) {
        maker.inclusions.push(
          ...formatForOfferTransfer(makerUnitInclusions.unit),
        );
      }

      const offerInfo = generateOffer(maker, taker);
      const offerResponse = await datalayerPersistance.makeOffer(offerInfo);

      if (!offerResponse.success) {
        throw new Error(offerResponse.error);
      }

      await MetaV2.upsert({
        meta_key: 'activeOfferTradeId',
        meta_value: offerResponse.offer.trade_id,
      });

      return _.omit(offerResponse, ['success']);
    } catch (error) {
      loggerV2.error('[v2]: Error generating offer file:', error);
      throw new Error(error.message);
    }
  }

  /**
   * Get details of currently uploaded offer
   * @returns {Promise<Object|null>} Offer info or null if no active offer
   */
  static async getCurrentOfferInfo() {
    try {
      const offerFileJson = await MetaV2.findOne({
        where: { meta_key: 'activeOffer' },
        raw: true,
      });

      if (!offerFileJson) {
        return null;
      }

      return JSON.parse(offerFileJson.meta_value);
    } catch (error) {
      loggerV2.error('[v2]: Error getting current offer info:', error);
      throw new Error(error.message);
    }
  }

  /**
   * Import and parse offer file
   * @param {Buffer|string} file - Offer file buffer or string
   * @returns {Promise<void>}
   */
  static async importOfferFile(file) {
    try {
      const offerFileBuffer = Buffer.isBuffer(file) ? file : Buffer.from(file);
      const offerFile = offerFileBuffer.toString('utf-8');
      const offerParsed = JSON.parse(offerFile);

      // Set default fee
      offerParsed.fee = _.get(CONFIG, 'DEFAULT_FEE', 300000000);
      delete offerParsed.success;
      const offerJSON = JSON.stringify(offerParsed);

      // Verify offer with datalayer
      await datalayerPersistance.verifyOffer(offerJSON);

      // Store in MetaV2
      await MetaV2.upsert({
        meta_key: 'activeOffer',
        meta_value: offerJSON,
      });
    } catch (error) {
      loggerV2.error('[v2]: Error importing offer file:', error);
      throw new Error(error.message);
    }
  }

  /**
   * Commit imported offer file
   * @returns {Promise<Object>} Response with tradeId
   */
  static async commitImportedOffer() {
    try {
      const offerFile = await MetaV2.findOne({
        where: { meta_key: 'activeOffer' },
        raw: true,
      });

      if (!offerFile) {
        throw new Error('No active offer file found');
      }

      const response = await datalayerPersistance.takeOffer(JSON.parse(offerFile.meta_value));

      // Remove active offer from MetaV2
      await MetaV2.destroy({
        where: {
          meta_key: 'activeOffer',
        },
      });

      return {
        tradeId: response.trade_id,
        message: 'Offer Accepted.',
      };
    } catch (error) {
      loggerV2.error('[v2]: Error committing imported offer:', error);
      throw new Error(error.message);
    }
  }

  /**
   * Cancel active offer
   * @returns {Promise<void>}
   */
  static async cancelActiveOffer() {
    try {
      const tradeIdRecord = await MetaV2.findOne({
        where: { meta_key: 'activeOfferTradeId' },
        raw: true,
      });

      if (!tradeIdRecord) {
        throw new Error('No active offer trade ID found');
      }

      const tradeId = tradeIdRecord.meta_value;
      await datalayerPersistance.cancelOffer(tradeId);

      // Remove trade ID from MetaV2
      await MetaV2.destroy({
        where: {
          meta_key: 'activeOfferTradeId',
        },
      });
    } catch (error) {
      loggerV2.error('[v2]: Error canceling active offer:', error);
      throw new Error(error.message);
    }
  }

  /**
   * Reject imported offer file
   * @returns {Promise<void>}
   */
  static async cancelImportedOffer() {
    try {
      await MetaV2.destroy({
        where: {
          meta_key: 'activeOffer',
        },
      });
    } catch (error) {
      loggerV2.error('[v2]: Error canceling imported offer:', error);
      throw new Error(error.message);
    }
  }
}

export { OfferV2 };

