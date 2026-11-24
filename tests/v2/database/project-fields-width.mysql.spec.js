import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { expect } from 'chai';
import mysql from 'mysql2/promise';
import { Sequelize } from 'sequelize';

import { migrations } from '../../../src/database/v2/migrations/index.js';
import picklists from '../../../src/models/governance/governance-v2.stub.js';

const entry = migrations.find(
  ({ name }) => name === '20261123120000-widen-project-fields-v2',
);
const projectCreation = migrations.find(
  ({ name }) => name === '20250110120008-create-project-v2',
);
const database = `cadt_project_name_test_${randomUUID().replaceAll('-', '')}`;
const strictMode = 'STRICT_ALL_TABLES,NO_ENGINE_SUBSTITUTION';
const fields = [
  { column: 'project_name', length: 500 },
  {
    column: 'project_sector',
    length: 768,
    selections: picklists.projectSector,
  },
  { column: 'project_type', length: 768, selections: picklists.projectType },
];
const widenedSchema = (definition) =>
  fields.reduce(
    (ddl, { column, length }) =>
      ddl.replace(
        `\`${column}\` varchar(255)`,
        `\`${column}\` varchar(${length})`,
      ),
    definition,
  );
// MySQL can print this redundant charset after MODIFY. The explicit matching
// collation still identifies the charset; retain all effective attributes.
const comparableSchema = (definition) =>
  definition.replace(
    /^([ \t]*`project_(?:name|sector|type)` varchar\(\d+\)) CHARACTER SET utf8mb4(?= COLLATE utf8mb4_)/gm,
    '$1',
  );

describe('V2 project fields migration on strict MySQL/MariaDB', function () {
  this.timeout(30000);
  let admin;
  let sequelize;
  let created = false;
  let queryInterface;
  let isMariaDb;

  const query = async (sql, replacements = []) => {
    const [rows] = await sequelize.query(sql, { replacements });
    return rows;
  };
  const schema = async () =>
    (await query('SHOW CREATE TABLE project'))[0]['Create Table'];
  const indexes = async () =>
    (await query('SHOW INDEX FROM project')).map((index) => {
      const definition = { ...index };
      delete definition.Cardinality; // Statistics can change after an ALTER.
      return definition;
    });
  const insert = (
    id,
    {
      project_name = 'Test project',
      project_sector = null,
      project_type = null,
    } = {},
  ) =>
    query(
      'INSERT INTO project (cad_trust_project_id, org_uid, project_registry_name, project_id, project_name, project_sector, project_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        'test-org',
        'test-registry',
        id,
        project_name,
        project_sector,
        project_type,
      ],
    );
  const fieldValue = async (id, column) => {
    const [row] = await query(
      `SELECT \`${column}\` AS value FROM project WHERE cad_trust_project_id = ?`,
      [id],
    );
    return row.value;
  };
  const up = async () => {
    expect(entry, 'registered width migration').to.exist;
    await entry.migration.up(queryInterface, Sequelize);
  };
  const assertAlterFailure = async (code) => {
    const before = await schema();
    const oldIndexes = await indexes();
    const rows = await query('SELECT * FROM project');
    await assert.rejects(up, (error) => {
      expect(error.cause?.original?.code).to.equal(code);
      expect(error.message).to.match(/project.*manual schema review/i);
      return true;
    });
    expect(await schema()).to.equal(before);
    expect(await indexes()).to.deep.equal(oldIndexes);
    expect(await query('SELECT * FROM project')).to.deep.equal(rows);
  };

  before(async function () {
    for (const key of [
      'CADT_MIGRATION_TEST_HOST',
      'CADT_MIGRATION_TEST_USER',
      'CADT_MIGRATION_TEST_PASSWORD',
    ]) {
      if (!process.env[key])
        throw new Error(`${key} is required; use a disposable database server`);
    }
    const connection = {
      host: process.env.CADT_MIGRATION_TEST_HOST,
      port: Number(process.env.CADT_MIGRATION_TEST_PORT || 3306),
      user: process.env.CADT_MIGRATION_TEST_USER,
      password: process.env.CADT_MIGRATION_TEST_PASSWORD,
      charset: 'utf8mb4',
    };
    admin = await mysql.createConnection(connection);
    const [[{ version }]] = await admin.query('SELECT VERSION() AS version');
    isMariaDb = version.includes('MariaDB');
    await admin.query(
      `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    created = true;
    sequelize = new Sequelize(database, connection.user, connection.password, {
      dialect: 'mysql',
      host: connection.host,
      port: connection.port,
      logging: false,
      pool: { max: 2 },
      dialectOptions: { charset: 'utf8mb4' },
      hooks: {
        afterConnect: async (client) => {
          await client
            .promise()
            .query('SET SESSION sql_mode = ?', [strictMode]);
        },
      },
    });
    queryInterface = sequelize.getQueryInterface();
  });

  beforeEach(async function () {
    await projectCreation.migration.up(queryInterface, Sequelize);
  });

  afterEach(async function () {
    if (sequelize) await queryInterface.dropTable('project');
  });

  after(async function () {
    try {
      if (sequelize) await sequelize.close();
      if (created) await admin.query(`DROP DATABASE \`${database}\``);
    } finally {
      if (admin) await admin.end();
    }
  });

  it('enforces strict mode on every pooled connection', async function () {
    const connections = await Promise.all([
      sequelize.connectionManager.getConnection(),
      sequelize.connectionManager.getConnection(),
    ]);
    try {
      for (const client of connections) {
        const [[row]] = await client
          .promise()
          .query('SELECT @@SESSION.sql_mode AS mode');
        expect(row.mode.split(',')).to.include('STRICT_ALL_TABLES');
      }
    } finally {
      await Promise.all(
        connections.map((client) =>
          sequelize.connectionManager.releaseConnection(client),
        ),
      );
    }
  });

  for (const { column, length, selections } of fields) {
    it(`widens ${column}, preserving rows/full indexes and roundtripping inserts/updates through ${length} characters`, async function () {
      const values = [
        'a'.repeat(256),
        'b'.repeat(length),
        '森'.repeat(length),
        '🌲'.repeat(length),
      ];
      if (selections) values.unshift(JSON.stringify(selections));
      await insert('legacy', { [column]: 'Existing value' });
      const oldRows = await query('SELECT * FROM project');
      for (const [index, value] of values.entries()) {
        await assert.rejects(
          () => insert(`too-long-${index}`, { [column]: value }),
          (error) => error.original?.code === 'ER_DATA_TOO_LONG',
          `legacy ${column} rejection of ${Array.from(value).length} characters`,
        );
      }
      expect(await query('SELECT * FROM project')).to.deep.equal(oldRows);
      const oldSchema = await schema();
      const oldIndexes = await indexes();
      for (const { column: indexedColumn } of fields) {
        expect(
          oldIndexes.filter(({ Column_name }) => Column_name === indexedColumn),
        ).to.have.length(1);
      }
      expect(oldIndexes.every(({ Sub_part }) => Sub_part === null)).to.equal(
        true,
      );
      await up();
      expect(await query('SELECT * FROM project')).to.deep.equal(oldRows);
      for (const [index, value] of values.entries()) {
        await insert(`accepted-${index}`, { [column]: value });
        await query(
          `UPDATE project SET \`${column}\` = ? WHERE cad_trust_project_id = ?`,
          [value, 'legacy'],
        );
        expect(await fieldValue(`accepted-${index}`, column)).to.equal(value);
        expect(await fieldValue('legacy', column)).to.equal(value);
      }
      await assert.rejects(
        () => insert('over-boundary', { [column]: 'z'.repeat(length + 1) }),
        (error) => error.original?.code === 'ER_DATA_TOO_LONG',
      );
      expect(comparableSchema(await schema())).to.equal(
        comparableSchema(widenedSchema(oldSchema)),
      );
      expect(await indexes()).to.deep.equal(oldIndexes);
      const after = await schema();
      const rows = await query(
        'SELECT * FROM project ORDER BY cad_trust_project_id',
      );
      await up();
      await entry.migration.down(queryInterface, Sequelize);
      expect(await schema()).to.equal(after);
      expect(
        await query('SELECT * FROM project ORDER BY cad_trust_project_id'),
      ).to.deep.equal(rows);
      expect(await indexes()).to.deep.equal(oldIndexes);
    });

    it(`preserves ${column} charset, collation, nullability, default and quoted comment`, async function () {
      await query(
        `ALTER TABLE project MODIFY COLUMN \`${column}\` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT ? COMMENT ?`,
        ["Default ' forest, `name`", "Comment ' forest, `name`"],
      );
      await insert('nullable', { [column]: null });
      const before = await schema();
      await up();
      expect(comparableSchema(await schema())).to.equal(
        comparableSchema(widenedSchema(before)),
      );
      expect(await fieldValue('nullable', column)).to.equal(null);
      await query(
        `UPDATE project SET \`${column}\` = DEFAULT WHERE cad_trust_project_id = ?`,
        ['nullable'],
      );
      expect(await fieldValue('nullable', column)).to.equal(
        "Default ' forest, `name`",
      );
    });
  }

  for (const [column, type] of [
    ['project_name', 'VARCHAR(700)'],
    ['project_sector', 'VARCHAR(900)'],
    ['project_sector', 'TEXT'],
    ['project_type', 'MEDIUMTEXT'],
    ['project_type', 'LONGTEXT'],
  ]) {
    it(`preserves wider ${column} ${type} content while widening the other fields`, async function () {
      await queryInterface.removeIndex('project', `project_${column}`);
      await query(
        `ALTER TABLE project MODIFY COLUMN \`${column}\` ${type} NOT NULL`,
      );
      const value = 'c'.repeat(column === 'project_name' ? 700 : 900);
      await insert('custom', { [column]: value });
      const before = await schema();
      await up();
      expect(comparableSchema(await schema())).to.equal(
        comparableSchema(widenedSchema(before)),
      );
      expect(await fieldValue('custom', column)).to.equal(value);
    });
  }

  for (const type of ['CHAR(255)', 'TINYTEXT', 'INT', 'VARBINARY(255)']) {
    it(`rejects unsupported project_type ${type} before modifying any field`, async function () {
      await queryInterface.removeIndex('project', 'project_project_type');
      await query(
        `ALTER TABLE project MODIFY COLUMN project_type ${type} NOT NULL`,
      );
      await insert('unsupported', { project_type: '1' });
      const before = await schema();
      const rows = await query('SELECT * FROM project');
      const oldIndexes = await indexes();
      await assert.rejects(up, /project_type.*unsupported.*manual/i);
      expect(await schema()).to.equal(before);
      expect(await query('SELECT * FROM project')).to.deep.equal(rows);
      expect(await indexes()).to.deep.equal(oldIndexes);
    });
  }

  it('refuses COPY fallback that would silently convert a unique BTREE index to HASH', async function () {
    await query(
      "ALTER TABLE project ROW_FORMAT=DYNAMIC, ADD COLUMN index_padding VARCHAR(500) NOT NULL DEFAULT 'padding'",
    );
    await query(
      'CREATE UNIQUE INDEX project_sector_with_padding ON project (project_sector, index_padding)',
    );
    await insert('retained', { project_sector: 'Retained after failed ALTER' });
    await assertAlterFailure(
      isMariaDb ? 'ER_ALTER_OPERATION_NOT_SUPPORTED_REASON' : 'ER_TOO_LONG_KEY',
    );
  });

  it('propagates a real COMPACT index-limit failure with schema, data and full indexes intact', async function () {
    await queryInterface.dropTable('project');
    await query(
      'CREATE TABLE project (project_name VARCHAR(255) NOT NULL, project_sector VARCHAR(255), project_type VARCHAR(255), INDEX project_name_full (project_name), INDEX project_sector_full (project_sector), INDEX project_type_full (project_type)) ENGINE=InnoDB ROW_FORMAT=COMPACT DEFAULT CHARSET=utf8mb3',
    );
    await query('INSERT INTO project (project_name) VALUES (?)', [
      'Retained after index-limit rejection',
    ]);
    await assertAlterFailure(
      isMariaDb ? 'ER_INDEX_COLUMN_TOO_LONG' : 'ER_TOO_LONG_KEY',
    );
  });

  it('leaves a safe but COPY-required latin1 schema intact for manual review', async function () {
    await query(
      'ALTER TABLE project MODIFY COLUMN project_type VARCHAR(255) CHARACTER SET latin1 COLLATE latin1_bin NOT NULL',
    );
    await insert('latin1', { project_type: 'Retained after COPY rejection' });
    await assertAlterFailure('ER_ALTER_OPERATION_NOT_SUPPORTED_REASON');
  });
});
