'use strict';

import _ from 'lodash';
import { uuid as uuidv4 } from 'uuidv4';
import Sequelize from 'sequelize';
const Op = Sequelize.Op;

const { Model } = Sequelize;
import { Project, Unit, Organization, Issuance, Meta } from '../../models';
import { encodeHex, generateOffer } from '../../utils/datalayer-utils';

import * as rxjs from 'rxjs';
import { sequelize } from '../../database';

import datalayer from '../../datalayer';
import { makeOffer } from '../../datalayer/persistance';

import ModelTypes from './staging.modeltypes.cjs';
import { formatModelAssociationName } from '../../utils/model-utils.js';

import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls';
import { updateNilVerificationBodyAsEmptyString } from '../../utils/helpers.js';

class Staging extends Model {
  static changes = new rxjs.Subject();

  static async create(values, options) {
    Staging.changes.next(['staging']);
    return super.create(values, options);
  }

  static async destroy(values) {
    Staging.changes.next(['staging']);
    return super.destroy(values);
  }

  static async upsert(values, options) {
    Staging.changes.next(['staging']);
    return super.upsert(values, options);
  }

  static generateOfferFile = async () => {
    try {
      const stagingRecord = await Staging.findOne({
        where: { isTransfer: true },
        raw: true,
      });

      const makerProjectRecord = _.head(JSON.parse(stagingRecord.data));

      const myOrganization = await Organization.findOne({
        where: { isHome: true },
        raw: true,
      });

      // The record still has the orgUid of the makerProjectRecord,
      // we will update this to the correct orgUId later
      const takerOrganization = await Organization.findOne({
        where: { orgUid: makerProjectRecord.orgUid },
        raw: true,
      });

      const maker = { inclusions: [] };
      const taker = { inclusions: [] };

      taker.storeId = takerOrganization.registryId;
      maker.storeId = myOrganization.registryId;

      const takerProjectRecord = await Project.findOne({
        where: { warehouseProjectId: makerProjectRecord.warehouseProjectId },
        include: Project.getAssociatedModels().map((association) => {
          return {
            model: association.model,
            as: formatModelAssociationName(association),
          };
        }),
      });

      takerProjectRecord.projectStatus = 'Transitioned';

      const newMakerWarehouseProjectId = uuidv4();
      makerProjectRecord.warehouseProjectId = newMakerWarehouseProjectId;
      makerProjectRecord.orgUid = myOrganization.orgUid;

      // Out of time so just hard coding this
      const projectChildRecords = [
        'issuances',
        'projectLocations',
        'estimations',
        'labels',
        'projectRatings',
        'coBenefits',
        'relatedProjects',
      ];

      // Each child record for the maker needs the new projectId
      projectChildRecords.forEach((childRecordSet) => {
        if (makerProjectRecord[childRecordSet]) {
          makerProjectRecord[childRecordSet].forEach((childRecord) => {
            childRecord.warehouseProjectId = newMakerWarehouseProjectId;
            childRecord.orgUid = myOrganization.orgUid;
          });
        }
      });

      const issuanceIds = takerProjectRecord.issuances.reduce(
        (ids, issuance) => {
          if (!ids.includes(issuance.id)) {
            ids.push(issuance.id);
          }
          return ids;
        },
        [],
      );

      let unitTakerRecords = await Unit.findAll({
        where: {
          issuanceId: { [Op.in]: issuanceIds },
          orgUid: takerProjectRecord.orgUid,
        },
        raw: true,
      });

      // Makers get an unlatered copy of all the project units from the taker
      const unitMakerRecords = _.cloneDeep(unitTakerRecords);

      unitTakerRecords = unitTakerRecords.map((record) => {
        record.unitStatus = 'Exported';
        record.warehouseUnitId = uuidv4();
        record.orgUid = myOrganization.orgUid;
        return record;
      });

      const primaryProjectKeyMap = {
        project: 'warehouseProjectId',
        projectLocations: 'id',
        labels: 'id',
        issuances: 'id',
        coBenefits: 'id',
        relatedProjects: 'id',
        estimations: 'id',
        projectRatings: 'id',
      };

      const primaryUnitKeyMap = {
        unit: 'warehouseUnitId',
        labels: 'id',
        label_units: 'id',
        issuances: 'id',
      };

      const takerProjectXslsSheets = createXlsFromSequelizeResults({
        rows: [takerProjectRecord],
        model: Project,
        toStructuredCsv: true,
      });

      const makerProjectXslsSheets = createXlsFromSequelizeResults({
        rows: [makerProjectRecord],
        model: Project,
        toStructuredCsv: true,
      });

      const takerUnitXslsSheets = createXlsFromSequelizeResults({
        rows: unitTakerRecords,
        model: Unit,
        toStructuredCsv: true,
      });

      const makerUnitXslsSheets = createXlsFromSequelizeResults({
        rows: unitMakerRecords,
        model: Unit,
        toStructuredCsv: true,
      });

      const makerProjectInclusions = await transformFullXslsToChangeList(
        makerProjectXslsSheets,
        'insert',
        primaryProjectKeyMap,
      );

      const takerProjectInclusions = await transformFullXslsToChangeList(
        takerProjectXslsSheets,
        'insert',
        primaryProjectKeyMap,
      );

      const takerUnitInclusions = await transformFullXslsToChangeList(
        takerUnitXslsSheets,
        'insert',
        primaryUnitKeyMap,
      );

      const makerUnitInclusions = await transformFullXslsToChangeList(
        makerUnitXslsSheets,
        'insert',
        primaryUnitKeyMap,
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
        ...formatForOfferTransfer(takerProjectInclusions.project),
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

      if (makerProjectInclusions?.issuances) {
        maker.inclusions.push(
          ...formatForOfferTransfer(makerProjectInclusions.issuances),
        );
      }

      if (makerProjectInclusions?.projectLocations) {
        maker.inclusions.push(
          ...formatForOfferTransfer(makerProjectInclusions.projectLocations),
        );
      }

      if (makerProjectInclusions?.labels) {
        maker.inclusions.push(
          ...formatForOfferTransfer(makerProjectInclusions.labels),
        );
      }

      if (makerProjectInclusions?.labels) {
        maker.inclusions.push(
          ...formatForOfferTransfer(makerProjectInclusions.labels),
        );
      }

      if (makerProjectInclusions?.projectRatings) {
        maker.inclusions.push(
          ...formatForOfferTransfer(makerProjectInclusions.projectRatings),
        );
      }

      if (makerProjectInclusions?.coBenefits) {
        maker.inclusions.push(
          ...formatForOfferTransfer(makerProjectInclusions.coBenefits),
        );
      }

      if (makerProjectInclusions?.relatedProjects) {
        maker.inclusions.push(
          ...formatForOfferTransfer(makerProjectInclusions.relatedProjects),
        );
      }

      if (makerUnitInclusions?.unit) {
        maker.inclusions.push(
          ...formatForOfferTransfer(makerUnitInclusions.unit),
        );
      }

      const offerInfo = generateOffer(maker, taker);
      const offerResponse = await makeOffer(offerInfo);

      if (!offerResponse.success) {
        throw new Error(offerResponse.error);
      }

      await Meta.upsert({
        metaKey: 'activeOfferTradeId',
        metaValue: offerResponse.offer.trade_id,
      });

      return _.omit(offerResponse, ['success']);
    } catch (error) {
      console.trace(error);
      throw new Error(error.message);
    }
  };

  // If the record was commited but the diff.original is null
  // that means that the original record no longer exists and
  // the staging record should be cleaned up.
  static cleanUpCommitedAndInvalidRecords = async () => {
    const stagingRecords = await Staging.findAll({ raw: true });

    const stagingRecordsToDelete = await Promise.all(
      stagingRecords.filter(async (record) => {
        if (record.commited === 1) {
          const { uuid, table, action, data } = record;
          const diff = await Staging.getDiffObject(uuid, table, action, data);
          return diff.original == null;
        }
        return false;
      }),
    );

    await Staging.destroy({
      where: { uuid: stagingRecordsToDelete.map((record) => record.uuid) },
    });
  };

  static getDiffObject = async (uuid, table, action, data) => {
    const diff = {};
    if (action === 'INSERT') {
      diff.original = {};
      diff.change = JSON.parse(data);
    }

    if (action === 'UPDATE') {
      diff.change = JSON.parse(data);

      let original;

      if (table === 'Projects') {
        original = await Project.findOne({
          where: { warehouseProjectId: uuid },
          include: Project.getAssociatedModels().map((association) => {
            return {
              model: association.model,
              as: formatModelAssociationName(association),
            };
          }),
        });

        // Show the issuance data if its being reused
        // this is just for view purposes onlys
        await Promise.all(
          diff.change.map(async (record) => {
            if (record.issuanceId) {
              const issuance = await Issuance.findOne({
                where: { id: record.issuanceId },
              });

              record.issuance = issuance.dataValues;
            }
          }),
        );
      } else if (table === 'Units') {
        original = await Unit.findOne({
          where: { warehouseUnitId: uuid },
          include: Unit.getAssociatedModels().map((association) => {
            return {
              model: association.model,
              as: formatModelAssociationName(association),
            };
          }),
        });

        // Show the issuance data if its being reused,
        // this is just for view purposes onlys
        await Promise.all(
          diff.change.map(async (record) => {
            if (record.issuanceId) {
              const issuance = await Issuance.findOne({
                where: { id: record.issuanceId },
              });

              record.issuance = issuance.dataValues;
            }
          }),
        );
      }

      diff.original = original;
    }

    if (action === 'DELETE') {
      let original;

      if (table === 'Projects') {
        original = await Project.findOne({
          where: { warehouseProjectId: uuid },
          include: Project.getAssociatedModels().map((association) => {
            return {
              model: association.model,
              as: formatModelAssociationName(association),
            };
          }),
        });
      } else if (table === 'Units') {
        original = await Unit.findOne({
          where: { warehouseUnitId: uuid },
          include: Unit.getAssociatedModels().map((association) => {
            return {
              model: association.model,
              as: formatModelAssociationName(association),
            };
          }),
        });
      }

      diff.original = original;
      diff.change = {};
    }

    return diff;
  };

  static seperateStagingDataIntoActionGroups = (stagedData, table) => {
    const insertRecords = [];
    const updateRecords = [];
    const deleteChangeList = [];

    stagedData
      .filter((stagingRecord) => stagingRecord.table === table)
      .forEach((stagingRecord) => {
        // TODO: Think of a better place to mark the records as commited
        Staging.update(
          { commited: true },
          { where: { uuid: stagingRecord.uuid } },
        );
        if (stagingRecord.action === 'INSERT') {
          insertRecords.push(...JSON.parse(stagingRecord.data));
        } else if (stagingRecord.action === 'UPDATE') {
          let tablePrefix = table.toLowerCase();
          // hacky fix to account for the units and projects table not
          // being lowercase and plural in the xsls transformation
          if (tablePrefix === 'units' || tablePrefix === 'projects') {
            tablePrefix = tablePrefix.replace(/s\s*$/, '');
          }

          deleteChangeList.push({
            action: 'delete',
            key: encodeHex(`${tablePrefix}|${stagingRecord.uuid}`),
          });

          // TODO: Child table records are getting orphaned in the datalayer,
          // because we need to generate a delete action for each one

          updateRecords.push(...JSON.parse(stagingRecord.data));
        } else if (stagingRecord.action === 'DELETE') {
          let tablePrefix = table.toLowerCase();

          // hacky fix to account for the units and projects table not
          // being lowercase and plural in the xsls transformation
          if (tablePrefix === 'units' || tablePrefix === 'projects') {
            tablePrefix = tablePrefix.replace(/s\s*$/, '');
          }

          deleteChangeList.push({
            action: 'delete',
            key: encodeHex(`${tablePrefix}|${stagingRecord.uuid}`),
          });

          // TODO: Child table records are getting orphaned in the datalayer,
          // because we need to generate a delete action for each one
        }
      });

    return [insertRecords, updateRecords, deleteChangeList];
  };

  /**
   * Pushes data to the DataLayer.
   * @param {string} tableToPush - The name of the table to push.
   * @param {string} comment - The comment to associate with the data.
   * @param {string} author - The author of the data.
   * @param {Array} [ids=[]] - Optional array of IDs to use in the query.
   * @throws {Error} Throws an error if no records are found to send to DataLayer.
   */
  static async pushToDataLayer(tableToPush, comment, author, ids = []) {
    const whereClause = {
      commited: false,
      ...(tableToPush ? { table: tableToPush } : {}),
      ...(ids.length ? { uuid: { [Sequelize.Op.in]: ids } } : {}),
    };

    const stagedRecords = await Staging.findAll({
      where: whereClause,
      raw: true,
    });

    if (!stagedRecords.length) {
      throw new Error('No records to send to DataLayer');
    }

    // replace nil issuance validationBody values with empty strings
    stagedRecords.forEach((record) =>
      updateNilVerificationBodyAsEmptyString(record),
    );

    const [unitsChangeList, projectsChangeList] = await Promise.all([
      Unit.generateChangeListFromStagedData(stagedRecords, comment, author),
      Project.generateChangeListFromStagedData(stagedRecords, comment, author),
    ]);

    const unifiedChangeList = {
      ...projectsChangeList,
      ...unitsChangeList,
      issuances: [
        ...unitsChangeList.issuances,
        ...projectsChangeList.issuances,
      ],
      labels: [...unitsChangeList.labels, ...projectsChangeList.labels],
    };

    const myOrganization = await Organization.findOne({
      where: { isHome: true },
      raw: true,
    });

    const finalChangeList = _.uniqBy(
      _.sortBy(_.flatten(_.values(unifiedChangeList)), 'action'),
      (v) => [v.action, v.key].join(),
    );

    await datalayer.pushDataLayerChangeList(
      myOrganization.registryId,
      finalChangeList,
      async () => {
        await Staging.update(
          { failedCommit: true },
          { where: { commited: true } },
        );
      },
    );
  }
}

Staging.init(ModelTypes, {
  sequelize,
  modelName: 'staging',
  freezeTableName: true,
  timestamps: true,
});

export { Staging };
