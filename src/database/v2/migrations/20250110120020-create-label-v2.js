'use strict';

import { v4 as uuidv4 } from 'uuid';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('label', {
      cad_trust_label_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        unique: true,
        comment: 'generated UUID'
      },
      label_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      label_type: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'picklist from type'
      },
      label_link: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'html'
      },
      label_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes for better performance
    await queryInterface.addIndex('label', ['label_name']);
    await queryInterface.addIndex('label', ['label_type']);
    await queryInterface.addIndex('label', ['label_date']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('label');
  },
};
