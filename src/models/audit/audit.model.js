'use strict';

import Sequelize, { Op } from 'sequelize';
const { Model } = Sequelize;
import { sequelize, safeMirrorDbHandler } from '../../database';
import { AuditMirror } from './audit.model.mirror';
import ModelTypes from './audit.modeltypes.cjs';
import findDuplicateIssuancesSql from './sql/find-duplicate-issuances.sql.js';

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

  static async resetToGeneration(generation, orgUid) {
    const where = {
      generation: { [Op.gt]: generation },
    };

    if (orgUid) {
      where.orgUid = orgUid;
    }

    return await Audit.destroy({ where });
  }

  static async resetToDate(date) {
    const parsedDate = Math.round(date.valueOf() / 1000);

    return await Audit.destroy({
      where: sequelize.where(
        sequelize.cast(
          sequelize.col('onChainConfirmationTimeStamp'),
          'UNSIGNED',
        ),
        {
          [Sequelize.Op.gt]: parsedDate,
        },
      ),
    });
  }

  static async resetOrgToDate(date, orgUid) {
    const parsedDate = Math.round(date.valueOf() / 1000);

    return await Audit.destroy({
      where: {
        orgUid: orgUid,
        [Sequelize.Op.and]: sequelize.where(
          sequelize.cast(
            sequelize.col('onchainConfirmationTimeStamp'),
            'UNSIGNED',
          ),
          { [Sequelize.Op.gt]: parsedDate },
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
