'use strict';
import Sequelize from 'sequelize';
const { DataTypes, Model } = Sequelize;
import { sequelize } from '../database';

class Unit extends Model { }

Unit.init({
  id: {
    allowNull: false,
    autoIncrement: true,
    primaryKey: true,
    type: Sequelize.INTEGER
  },
  buyer: {
    type: Sequelize.STRING
  },
  registry: {
    type: Sequelize.STRING
  },
  blockIdentifier: {
    type: Sequelize.STRING
  },
  identifier: {
    type: Sequelize.STRING
  },
  unitType: {
    type: Sequelize.STRING
  },
  unitCount: {
    type: Sequelize.NUMBER
  },
  unitStatus: {
    type: Sequelize.STRING
  },
  unitStatusDate: {
    type: Sequelize.DATE
  },
  transactionType: {
    type: Sequelize.STRING
  },
  unitIssuanceLocation: {
    type: Sequelize.STRING
  },
  unitLink: {
    type: Sequelize.STRING
  },
  correspondingAdjustment: {
    type: Sequelize.STRING
  },
  unitTag: {
    type: Sequelize.STRING
  },
  vintageId: {
    type: Sequelize.NUMBER
  },
  qualificationId: {
    type: Sequelize.NUMBER
  },
  owner: {
    type: Sequelize.STRING
  },
  createdAt: {
    allowNull: false,
    type: Sequelize.DATE
  },
  updatedAt: {
    allowNull: false,
    type: Sequelize.DATE
  }
}, { sequelize, modelName: 'qualification' });

export { Unit };
