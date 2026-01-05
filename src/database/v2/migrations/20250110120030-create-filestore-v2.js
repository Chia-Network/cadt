'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('file_store', {
      sha256: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        primaryKey: true,
        comment: 'SHA256 hash of file - prevents duplicate files',
      },
      file_name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      data: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Base64 encoded file data',
      },
      org_uid: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Organization UID that owns this file',
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('file_store');
  },
};

