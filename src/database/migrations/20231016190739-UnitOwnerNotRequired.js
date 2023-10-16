'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('units', 'unitOwner', {
      type: Sequelize.STRING,
      allowNull: true,
      required: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('units', 'unitOwner', {
      type: Sequelize.STRING,
      allowNull: false,
      required: true,
    });
  },
};
