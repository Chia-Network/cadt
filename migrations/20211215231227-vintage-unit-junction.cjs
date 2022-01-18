'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    /*  await queryInterface.createTable('vintage_unit', {
      unitId: Sequelize.INTEGER,
      vintageId: Sequelize.INTEGER,
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });*/
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('vintage_unit');
  },
};
