'use strict';

import { v4 as uuidv4 } from 'uuid';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('methodology', {
      cad_trust_methodology_id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
        defaultValue: () => uuidv4(),
      },
      methodology_code: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      methodology_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      methodology_version: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      methodology_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      methodology_link: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      methodology_type: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('methodology');
  },
};
