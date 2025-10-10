'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      'issuance',
      {
        cad_trust_issuance_id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        issuance_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        issuance_date: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW,
          allowNull: false,
        },
        updated_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW,
          allowNull: false,
        },
        cad_trust_verification_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'verification',
            key: 'cad_trust_verification_id',
          },
        },
        cad_trust_methodology_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'methodology',
            key: 'cad_trust_methodology_id',
          },
        },
        cad_trust_location_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'location',
            key: 'cad_trust_location_id',
          },
        },
      },
      {
        charset: 'utf8mb4',
        collate: 'utf8mb4_general_ci',
      },
    );
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('issuance');
  },
};
