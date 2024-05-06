'use strict';

/**
 * @fileOverview Migration script to modify createdAt and updatedAt columns to allow null.
 */

export default {
  /**
   * List of table names to be modified.
   */
  tables: [
    'audit',
    'coBenefits',
    'estimations',
    'issuances',
    'labels',
    'label_unit',
    'projectLocations',
    'projects',
    'projectRatings',
    'relatedProjects',
    'units',
  ],

  /**
   * Runs the up migration to allow null values in createdAt and updatedAt columns for specified tables.
   * @param {object} queryInterface - The Sequelize Query Interface used to handle database operations.
   * @param {object} Sequelize - The Sequelize library.
   * @returns {Promise<void>}
   */
  async up(queryInterface, Sequelize) {
    await Promise.all(
      this.tables.map((table) => {
        return queryInterface
          .changeColumn(table, 'createdAt', {
            allowNull: true,
            type: Sequelize.DATE,
          })
          .then(() => {
            return queryInterface.changeColumn(table, 'updatedAt', {
              allowNull: true,
              type: Sequelize.DATE,
            });
          });
      }),
    );
  },

  /**
   * Reverts the changes made by the up migration.
   * @param {object} queryInterface - The Sequelize Query Interface used to handle database operations.
   * @returns {Promise<void>}
   */
  async down(queryInterface, Sequelize) {
    await Promise.all(
      this.tables.map((table) => {
        return queryInterface
          .changeColumn(table, 'createdAt', {
            allowNull: false,
            type: Sequelize.DATE,
          })
          .then(() => {
            return queryInterface.changeColumn(table, 'updatedAt', {
              allowNull: false,
              type: Sequelize.DATE,
            });
          });
      }),
    );
  },
};
