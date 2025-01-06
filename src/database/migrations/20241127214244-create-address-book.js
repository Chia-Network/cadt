'use strict';
/** @type {import('sequelize-cli').Migration} */
import { v4 as uuidv4 } from 'uuid';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('addressBook', {
      id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        defaultValue: uuidv4(),
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
      },
      walletAddress: {
        type: Sequelize.STRING,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('addressBook');
  },
};
