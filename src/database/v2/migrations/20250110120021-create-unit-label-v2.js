'use strict';

import { v4 as uuidv4 } from 'uuid';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('unit_label', {
      cad_trust_unit_label_id: {
        type: Sequelize.STRING(36),
        primaryKey: true,
        allowNull: false,
        unique: true,
        comment: 'generated UUID'
      },
      cad_trust_label_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Foreign key to label table'
      },
      cad_trust_unit_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Foreign key to unit table'
      },
      label_unit_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      label_unit_description: {
        type: Sequelize.TEXT,
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
    await queryInterface.addIndex('unit_label', ['cad_trust_label_id']);
    await queryInterface.addIndex('unit_label', ['cad_trust_unit_id']);
    await queryInterface.addIndex('unit_label', ['label_unit_date']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('unit_label');
  },
};
