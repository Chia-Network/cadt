'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { Sequelize, Model } from 'sequelize';
const Op = Sequelize.Op;

import { logger } from '../../config/logger';

import { Project, Unit, Organization, Issuance, Meta } from '../../models';
import { encodeHex, generateOffer } from '../../utils/datalayer-utils';

import * as rxjs from 'rxjs';
import { sequelize } from '../../database';

import datalayer from '../../datalayer';
import { makeOffer } from '../../datalayer/persistance';

import ModelTypes from './staging.modeltypes.js';
import { formatModelAssociationName } from '../../utils/model-utils.js';

import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls';
import { updateNilVerificationBodyAsEmptyString } from '../../utils/helpers.js';

const buildAssociationIncludes = (ModelClass) =>
  ModelClass.getAssociatedModels().map((association) => {
    return {
      model: association.model,
      as: formatModelAssociationName(association),
    };
  });

const dedupe = (values) => _.uniq(values.filter(Boolean));

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
      logger.error('[v1]: Error in staging operation:', error);
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
    const [diff] = await Staging.getDiffObjects([{ uuid, table, action, data }]);
    return diff;
  };

  static getDiffObjects = async (stagingRecords) => {
    const normalizedRecords = stagingRecords.map((record) => {
      if (!record) {
        return record;
      }

      return record.dataValues ? record.dataValues : record;
    });

    const parsedChanges = normalizedRecords.map((record) => {
      if (!record || record.action !== 'UPDATE') {
        return null;
      }

      return JSON.parse(record.data);
    });

    const unitIds = dedupe(
      normalizedRecords
        .filter(
          (record) =>
            record &&
            record.table === 'Units' &&
            ['UPDATE', 'DELETE'].includes(record.action),
        )
        .map((record) => record.uuid),
    );
    const projectIds = dedupe(
      normalizedRecords
        .filter(
          (record) =>
            record &&
            record.table === 'Projects' &&
            ['UPDATE', 'DELETE'].includes(record.action),
        )
        .map((record) => record.uuid),
    );
    const issuanceIds = dedupe(
      normalizedRecords.flatMap((record, index) => {
        if (
          !record ||
          record.action !== 'UPDATE' ||
          !['Projects', 'Units'].includes(record.table)
        ) {
          return [];
        }

        return (parsedChanges[index] || []).map((changeRecord) => changeRecord.issuanceId);
      }),
    );

    const [units, projects, issuances] = await Promise.all([
      unitIds.length
        ? Unit.findAll({
            where: { warehouseUnitId: { [Op.in]: unitIds } },
            include: buildAssociationIncludes(Unit),
          })
        : [],
      projectIds.length
        ? Project.findAll({
            where: { warehouseProjectId: { [Op.in]: projectIds } },
            include: buildAssociationIncludes(Project),
          })
        : [],
      issuanceIds.length
        ? Issuance.findAll({
            where: { id: { [Op.in]: issuanceIds } },
          })
        : [],
    ]);

    const unitsById = new Map(
      units.map((record) => [record.warehouseUnitId, record]),
    );
    const projectsById = new Map(
      projects.map((record) => [record.warehouseProjectId, record]),
    );
    const issuancesById = new Map(
      issuances.map((record) => [record.id, record.dataValues]),
    );

    return normalizedRecords.map((record, index) => {
      const diff = {};

      if (record.action === 'INSERT') {
        diff.original = {};
        diff.change = JSON.parse(record.data);
        return diff;
      }

      if (record.action === 'UPDATE') {
        diff.change = parsedChanges[index];

        if (['Projects', 'Units'].includes(record.table)) {
          diff.change.forEach((changeRecord) => {
            if (changeRecord.issuanceId) {
              if (!issuancesById.has(changeRecord.issuanceId)) {
                logger.warn(
                  `[v1][staging:getDiffObjects] Missing issuance '${changeRecord.issuanceId}' for staged ${record.table} record '${record.uuid}'`,
                );
                throw new Error(
                  `Could not find issuance '${changeRecord.issuanceId}' for staged ${record.table} record '${record.uuid}'`,
                );
              }

              changeRecord.issuance = issuancesById.get(changeRecord.issuanceId);
            }
          });
        }

        diff.original =
          record.table === 'Projects'
            ? projectsById.get(record.uuid) ?? null
            : record.table === 'Units'
              ? unitsById.get(record.uuid) ?? null
              : undefined;
        return diff;
      }

      if (record.action === 'DELETE') {
        diff.original =
          record.table === 'Projects'
            ? projectsById.get(record.uuid) ?? null
            : record.table === 'Units'
              ? unitsById.get(record.uuid) ?? null
              : undefined;
        diff.change = {};
      }

      return diff;
    });
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
