'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize, safeMirrorDbHandler } from '../../database';
import { AuditMirror } from './audit.model.mirror';
import ModelTypes from './audit.modeltypes.cjs';
import findDuplicateIssuancesSql from './sql/find-duplicate-issuances.sql.js';
import { Organization } from '../organizations/index.js';

class Audit extends Model {
  static async create(values, options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await AuditMirror.create(values, mirrorOptions);
    });
    return super.create(values, options);
  }

  static async destroy(options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await AuditMirror.destroy(mirrorOptions);
    });
    return super.destroy(options);
  }

  static async upsert(values, options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await AuditMirror.upsert(values, mirrorOptions);
    });
    return super.upsert(values, options);
  }

  static async findConflicts() {
    const [results] = await sequelize.query(findDuplicateIssuancesSql);
    return results;
  }

  static async resetToGeneration(generation, orgUid, includeHomeOrg) {
    const homeOrg = Organization.getHomeOrg();
    const homeOrgUid = homeOrg?.uid;

    const where = {
      generation: { [Sequelize.Op.gt]: generation },
    };

    if (!includeHomeOrg && homeOrgUid && orgUid !== homeOrgUid) {
      where.orgUid = { [Sequelize.Op.ne]: homeOrgUid };
    }

    if (orgUid) {
      where.orgUid = orgUid;
    }

    return await Audit.destroy({ where });
  }

  static async resetToTimestamp(timestamp, includeHomeOrg) {
    const timestampInSeconds = Math.round(timestamp.valueOf() / 1000);
    const homeOrgUid = Organization.getHomeOrg()?.uid;

    const conditions = [
      sequelize.where(
        sequelize.cast(
          sequelize.col('onChainConfirmationTimeStamp'),
          'UNSIGNED',
        ),
        { [Sequelize.Op.gt]: timestampInSeconds },
      ),
    ];

    if (!includeHomeOrg && homeOrgUid) {
      conditions.push({ orguid: { [Sequelize.Op.ne]: homeOrgUid } });
    }

    return await Audit.destroy({ where: { [Sequelize.Op.and]: conditions } });
  }

  static async resetOrgToTimestamp(timestamp, orgUid) {
    const timestampInSeconds = Math.round(timestamp.valueOf() / 1000);

    return await Audit.destroy({
      where: {
        orgUid: orgUid,
        [Sequelize.Op.and]: sequelize.where(
          sequelize.cast(
            sequelize.col('onchainConfirmationTimeStamp'),
            'UNSIGNED',
          ),
          { [Sequelize.Op.gt]: timestampInSeconds },
        ),
      },
    });
  }
}

Audit.init(ModelTypes, {
  sequelize,
  modelName: 'audit',
  freezeTableName: true,
  timestamps: true,
  createdAt: true,
  updatedAt: true,
});

export { Audit };
