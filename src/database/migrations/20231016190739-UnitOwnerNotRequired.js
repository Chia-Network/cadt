'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('units', 'unitOwner', {
      type: Sequelize.STRING, // Change the data type if needed
      allowNull: true, // Set allowNull to true to make the column not required
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('units', 'unitOwner', {
      type: Sequelize.STRING, // Change the data type if needed
      allowNull: false, // Revert back to allowNull: false if necessary
    });
  },
};
