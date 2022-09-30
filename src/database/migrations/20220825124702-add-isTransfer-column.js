'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('staging', 'isTransfer', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('staging', 'isTransfer');
  },
};
