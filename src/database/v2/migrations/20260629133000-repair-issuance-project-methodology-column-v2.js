'use strict';

const OLD_COLUMN = 'cad_trust_methodology_id';
const NEW_COLUMN = 'cad_trust_project_methodology_id';
const TABLE = 'issuance';

const getTableInfo = async (queryInterface, Sequelize) => {
  const dialect = queryInterface.sequelize.getDialect();

  if (dialect === 'mysql' || dialect === 'mariadb') {
    const [columns] = await queryInterface.sequelize.query(
      "SELECT COLUMN_NAME as name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'issuance' AND TABLE_SCHEMA = DATABASE()",
    );
    return columns;
  }

  return queryInterface.sequelize.query(
    "PRAGMA table_info('issuance')",
    { type: Sequelize.QueryTypes.SELECT },
  );
};

const hasIndexOnColumn = async (queryInterface) => {
  try {
    const indexes = await queryInterface.showIndex(TABLE);
    return indexes.some((index) => {
      return (index.fields || []).some((field) => {
        if (typeof field === 'string') {
          return field === NEW_COLUMN;
        }
        return field?.attribute === NEW_COLUMN || field?.name === NEW_COLUMN;
      });
    });
  } catch {
    return false;
  }
};

const addIndexIfMissing = async (queryInterface) => {
  if (await hasIndexOnColumn(queryInterface)) {
    return;
  }

  try {
    await queryInterface.addIndex(TABLE, [NEW_COLUMN]);
  } catch (error) {
    const message = error?.message || '';
    if (!/already exists|duplicate/i.test(message)) {
      throw error;
    }
  }
};

export default {
  async up(queryInterface, Sequelize) {
    const tableInfo = await getTableInfo(queryInterface, Sequelize);
    if (tableInfo.length === 0) {
      return;
    }

    const hasOldColumn = tableInfo.some((col) => col.name === OLD_COLUMN);
    const hasNewColumn = tableInfo.some((col) => col.name === NEW_COLUMN);

    if (hasNewColumn) {
      await addIndexIfMissing(queryInterface);
      return;
    }

    if (hasOldColumn) {
      try {
        await queryInterface.removeIndex(TABLE, [OLD_COLUMN]);
      } catch {
        // The legacy index may not exist.
      }

      await queryInterface.renameColumn(TABLE, OLD_COLUMN, NEW_COLUMN);
      await addIndexIfMissing(queryInterface);
      return;
    }

    // No legacy column means there is no reliable value to backfill for any
    // existing rows. New writes still provide this required field via the model.
    await queryInterface.addColumn(TABLE, NEW_COLUMN, {
      type: Sequelize.STRING(36),
      allowNull: true,
      comment: 'Foreign key to project_methodology table',
    });
    await addIndexIfMissing(queryInterface);
  },

  async down() {
    // Corrective migration: keep the repaired schema on rollback.
  },
};
