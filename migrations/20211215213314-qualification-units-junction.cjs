'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('qualification_unit', {
      unitId: Sequelize.INTEGER,
      qualificationId: Sequelize.INTEGER,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('qualification_unit');
  },
};
