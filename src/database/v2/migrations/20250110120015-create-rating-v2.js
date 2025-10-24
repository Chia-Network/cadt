'use strict';

import { v4 as uuidv4 } from 'uuid';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('rating', {
      cad_trust_rating_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        unique: true,
        comment: 'generated UUID'
      },
      rating_type: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'picklist from type'
      },
      rating_value: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      rating_link: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'html'
      },
      cad_trust_project_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Foreign key to project table'
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
    await queryInterface.addIndex('rating', ['rating_type']);
    await queryInterface.addIndex('rating', ['cad_trust_project_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('rating');
  },
};
