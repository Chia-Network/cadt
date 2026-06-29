'use strict';

const COLUMN_RENAMES = [
  {
    table: 'aef_t3_actions',
    oldColumn: 'aef_t3_actions_coopoerative_approach_id',
    newColumn: 'aef_t3_actions_cooperative_approach_id',
  },
  {
    table: 'aef_t4_holdings',
    oldColumn: 'aef_t4_holdings_coopoerative_approach_id',
    newColumn: 'aef_t4_holdings_cooperative_approach_id',
  },
];

async function removeIndexIfExists(queryInterface, table, column) {
  try {
    await queryInterface.removeIndex(table, [column]);
  } catch {
    // Index may not exist or may already have been renamed by the dialect.
  }
}

async function addIndexIfMissing(queryInterface, table, column) {
  try {
    await queryInterface.addIndex(table, [column]);
  } catch {
    // Index may already exist on fresh installs or after dialect-level renames.
  }
}

async function renameColumnIfNeeded(queryInterface, Sequelize, table, oldColumn, newColumn) {
  const tableDefinition = await queryInterface.describeTable(table);
  const hasOldColumn = Object.hasOwn(tableDefinition, oldColumn);
  const hasNewColumn = Object.hasOwn(tableDefinition, newColumn);

  if (hasOldColumn && !hasNewColumn) {
    await removeIndexIfExists(queryInterface, table, oldColumn);
    await queryInterface.renameColumn(table, oldColumn, newColumn);
  } else if (!hasOldColumn && !hasNewColumn) {
    await queryInterface.addColumn(table, newColumn, {
      type: Sequelize.STRING,
      allowNull: false,
    });
  }

  await addIndexIfMissing(queryInterface, table, newColumn);
}

function renameKey(record, oldColumn, newColumn) {
  if (record && typeof record === 'object' && Object.hasOwn(record, oldColumn) && !Object.hasOwn(record, newColumn)) {
    record[newColumn] = record[oldColumn];
    delete record[oldColumn];
  }
}

async function renameStagingDataKeys(queryInterface, Sequelize, table, oldColumn, newColumn) {
  const records = await queryInterface.sequelize.query(
    'SELECT id, data FROM staging WHERE `table` = :table AND data LIKE :oldColumnPattern',
    {
      replacements: {
        table,
        oldColumnPattern: `%${oldColumn}%`,
      },
      type: Sequelize.QueryTypes.SELECT,
    },
  );

  for (const record of records) {
    const parsedData = JSON.parse(record.data);
    const rows = Array.isArray(parsedData) ? parsedData : [parsedData];

    for (const row of rows) {
      renameKey(row, oldColumn, newColumn);
    }

    await queryInterface.bulkUpdate(
      'staging',
      { data: JSON.stringify(Array.isArray(parsedData) ? rows : rows[0]) },
      { id: record.id },
    );
  }
}

export default {
  async up(queryInterface, Sequelize) {
    for (const { table, oldColumn, newColumn } of COLUMN_RENAMES) {
      await renameColumnIfNeeded(queryInterface, Sequelize, table, oldColumn, newColumn);
      await renameStagingDataKeys(queryInterface, Sequelize, table, oldColumn, newColumn);
    }
  },

  async down(queryInterface, Sequelize) {
    for (const { table, oldColumn, newColumn } of COLUMN_RENAMES) {
      await renameColumnIfNeeded(queryInterface, Sequelize, table, newColumn, oldColumn);
      await renameStagingDataKeys(queryInterface, Sequelize, table, newColumn, oldColumn);
    }
  },
};
