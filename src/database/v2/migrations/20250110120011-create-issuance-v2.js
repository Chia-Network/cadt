'use strict';

import { v4 as uuidv4 } from 'uuid';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('issuance', {
      cad_trust_issuance_id: {
        type: Sequelize.STRING(36),
        primaryKey: true,
        allowNull: false,
        unique: true,
        comment: 'generated UUID'
      },
      issuance_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      issuance_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      cad_trust_verification_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        comment: 'Foreign key to verification table'
      },
      cad_trust_methodology_id: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'references methodology UUID'
      },
      cad_trust_location_id: {
        type: Sequelize.STRING(36),
        allowNull: true,
        comment: 'Foreign key to location table'
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
    await queryInterface.addIndex('issuance', ['issuance_id']);
    await queryInterface.addIndex('issuance', ['issuance_date']);
    await queryInterface.addIndex('issuance', ['cad_trust_verification_id']);
    await queryInterface.addIndex('issuance', ['cad_trust_methodology_id']);
    await queryInterface.addIndex('issuance', ['cad_trust_location_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('issuance');
  },
};
