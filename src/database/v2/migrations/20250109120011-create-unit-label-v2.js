'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      'unit_label',
      {
        cad_trust_label_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'label',
            key: 'cad_trust_label_id',
          },
        },
        cad_trust_unit_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'unit',
            key: 'cad_trust_unit_id',
          },
        },
        label_unit_date: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        label_unit_description: {
          type: Sequelize.TEXT,
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
      },
      {
        charset: 'utf8mb4',
        collate: 'utf8mb4_general_ci',
      },
    );

    // Add composite primary key
    await queryInterface.addConstraint('unit_label', {
      fields: ['cad_trust_label_id', 'cad_trust_unit_id'],
      type: 'primary key',
      name: 'unit_label_pk',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('unit_label');
  },
};
