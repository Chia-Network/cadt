'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('location', {
      cad_trust_location_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        unique: true,
        comment: 'generated UUID'
      },
      location_country: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'picklist from country'
      },
      location_region: {
        type: Sequelize.STRING,
        allowNull: true
      },
      location_gis: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'GIS data including lat/long'
      },
      location_map_type: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'type of map file ie. geojson etc.'
      },
      location_map_file_link: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'datafile link'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'generated'
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'generated'
      },
      cad_trust_project_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        comment: 'Foreign key to project table'
      }
    });

    // Add foreign key constraint (application-level validation, not DB constraint)
    // Note: V2 uses application-level FK validation, not DB constraints
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('location');
  }
};
