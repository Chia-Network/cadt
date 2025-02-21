export default {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('organizations');

    if (!tableInfo?.dataModelVersionStoreId) {
      await queryInterface.addColumn(
        'organizations',
        'dataModelVersionStoreId',
        {
          type: Sequelize.STRING,
          allowNull: true,
        },
      );
    }

    if (!tableInfo?.dataModelVersionStoreHash) {
      await queryInterface.addColumn(
        'organizations',
        'dataModelVersionStoreHash',
        {
          type: Sequelize.STRING,
          allowNull: true,
        },
      );
    }
  },

  down: async (queryInterface) => {
    const tableInfo = await queryInterface.describeTable('organizations');

    if (tableInfo?.dataModelVersionStoreId) {
      await queryInterface.removeColumn(
        'organizations',
        'dataModelVersionStoreId',
      );
    }

    if (tableInfo?.dataModelVersionStoreHash) {
      await queryInterface.removeColumn(
        'organizations',
        'dataModelVersionStoreHash',
      );
    }
  },
};
