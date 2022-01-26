'use strict';

module.exports = {
  // eslint-disable-next-line
  up: async (queryInterface, Sequelize) => {
    /*  await queryInterface.createTable('issuance_unit', {
      unitId: Sequelize.INTEGER,
      issuanceId: Sequelize.INTEGER,
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });*/
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('issuance_unit');
  },
};
