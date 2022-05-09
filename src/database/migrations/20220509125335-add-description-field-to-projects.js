'use strict';

export default {
  async up(queryInterface, Sequelize) {
    queryInterface.addColumn('projects', 'description', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    queryInterface.removeColumn('projects', 'description');
  },
};
