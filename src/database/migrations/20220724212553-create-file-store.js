'use strict';

import { uuid as uuidv4 } from 'uuidv4';

export default {
  async up(queryInterface, Sequelize) {
    await Promise.all([
      queryInterface.addColumn('organization', 'fileStoreId', {
        type: Sequelize.STRING,
        allowNull: true,
      }),
      queryInterface.addColumn('projectLocations', 'fileId', {
        type: Sequelize.STRING,
        allowNull: true,
      }),
      queryInterface.createTable('fileStore', {
        SHA256: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
          defaultValue: () => uuidv4(),
          primaryKey: true,
        },
        fileName: {
          type: Sequelize.STRING,
          unique: true,
        },
        data: Sequelize.STRING,
        orgUid: Sequelize.STRING,
      }),
    ]);
  },

  async down(queryInterface) {
    await Promise.all([
      queryInterface.removeColumn('organization', 'fileStoreId'),
      queryInterface.removeColumn('projectLocations', 'fileId'),
      queryInterface.dropTable('fileStore'),
    ]);
  },
};
