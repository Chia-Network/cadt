import { randomUUID } from 'node:crypto';
import { expect } from 'chai';
import mysql from 'mysql2/promise';
import { Sequelize } from 'sequelize';

import { migrations } from '../../../src/database/v2/migrations/index.js';
import createProject from '../../../src/database/v2/migrations/20250110120008-create-project-v2.js';

const entry = migrations.find(
  ({ name }) => name === '20261123120000-widen-project-name-v2',
);
const database = `cadt_project_name_test_${randomUUID().replaceAll('-', '')}`;
const strictMode = 'STRICT_ALL_TABLES,NO_ENGINE_SUBSTITUTION';

describe('V2 project name migration on strict MySQL/MariaDB', function () {
  this.timeout(30000);
  let admin;
  let sequelize;
  let created = false;
  let queryInterface;

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
  const insert = (id, name) =>
    query(
      'INSERT INTO project (cad_trust_project_id, org_uid, project_registry_name, project_id, project_name) VALUES (?, ?, ?, ?, ?)',
      [id, 'test-org', 'test-registry', id, name],
    );
  const up = async () => {
    expect(entry, 'registered width migration').to.exist;
    await entry.migration.up(queryInterface, Sequelize);
  };
  const assertAlterFailure = async (code) => {
    const before = await schema();
    const oldIndexes = await indexes();
    const rows = await query('SELECT * FROM project');
    let failure;
    try {
      await up();
    } catch (error) {
      failure = error;
    }
    expect(failure?.cause?.original?.code).to.equal(code);
    expect(failure.message).to.match(/project_name.*manual schema review/i);
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
    await createProject.up(queryInterface, Sequelize);
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

  it('widens a historical install, preserving rows and every full index; accepts inserts/updates through 500 characters', async function () {
    const names = [
      'a'.repeat(256),
      'b'.repeat(500),
      '森'.repeat(500),
      '🌲'.repeat(500),
    ];
    await insert('legacy', 'Existing forest project');
    for (const [index, name] of names.entries()) {
      let failure;
      try {
        await insert(`too-long-${index}`, name);
      } catch (error) {
        failure = error;
      }
      expect(
        failure?.original?.code,
        `legacy rejection of ${Array.from(name).length} characters`,
      ).to.equal('ER_DATA_TOO_LONG');
    }
    expect(await query('SELECT project_name FROM project')).to.deep.equal([
      { project_name: 'Existing forest project' },
    ]);
    const oldSchema = await schema();
    const oldIndexes = await indexes();
    expect(
      oldIndexes.filter(({ Column_name }) => Column_name === 'project_name'),
    ).to.have.length(1);
    expect(oldIndexes.every(({ Sub_part }) => Sub_part === null)).to.equal(
      true,
    );
    await up();
    expect(await schema()).to.equal(
      oldSchema.replace(
        '`project_name` varchar(255)',
        '`project_name` varchar(500)',
      ),
    );
    expect(await indexes()).to.deep.equal(oldIndexes);
    expect(await query('SELECT project_name FROM project')).to.deep.equal([
      { project_name: 'Existing forest project' },
    ]);
    for (const [index, name] of names.entries()) {
      await insert(`accepted-${index}`, name);
      await query(
        'UPDATE project SET project_name = ? WHERE cad_trust_project_id = ?',
        [name, 'legacy'],
      );
      expect(
        (
          await query(
            'SELECT project_name FROM project WHERE cad_trust_project_id = ?',
            [`accepted-${index}`],
          )
        )[0].project_name,
      ).to.equal(name);
      expect(
        (
          await query(
            'SELECT project_name FROM project WHERE cad_trust_project_id = ?',
            ['legacy'],
          )
        )[0].project_name,
      ).to.equal(name);
    }
    let failure;
    try {
      await insert('over-boundary', 'z'.repeat(501));
    } catch (error) {
      failure = error;
    }
    expect(failure?.original?.code).to.equal('ER_DATA_TOO_LONG');
    const widenedSchema = await schema();
    const rows = await query(
      'SELECT * FROM project ORDER BY cad_trust_project_id',
    );
    await up();
    await entry.migration.down(queryInterface, Sequelize);
    expect(await schema()).to.equal(widenedSchema);
    expect(
      await query('SELECT * FROM project ORDER BY cad_trust_project_id'),
    ).to.deep.equal(rows);
    expect(await indexes()).to.deep.equal(oldIndexes);
  });

  it('repairs a fresh project created by the registered migration sequence', async function () {
    await queryInterface.dropTable('project');
    const creationIndex = migrations.findIndex(
      ({ name }) => name === '20250110120008-create-project-v2',
    );
    expect(migrations.indexOf(entry)).to.be.greaterThan(creationIndex);
    await migrations[creationIndex].migration.up(queryInterface, Sequelize);
    await up();
    await insert('fresh', 'f'.repeat(500));
    expect(
      (
        await query('SELECT CHAR_LENGTH(project_name) AS length FROM project')
      )[0].length,
    ).to.equal(500);
  });

  it('preserves custom charset, collation, nullable default and quoted comment', async function () {
    await query(
      'ALTER TABLE project MODIFY COLUMN project_name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT ? COMMENT ?',
      ["Default ' forest, `name`", "Comment ' forest, `name`"],
    );
    await insert('nullable', null);
    const before = await schema();
    await up();
    expect(await schema()).to.equal(
      before.replace(
        '`project_name` varchar(255)',
        '`project_name` varchar(500)',
      ),
    );
    expect(
      (await query('SELECT project_name FROM project'))[0].project_name,
    ).to.equal(null);
    await query(
      'UPDATE project SET project_name = DEFAULT WHERE cad_trust_project_id = ?',
      ['nullable'],
    );
    expect(
      (await query('SELECT project_name FROM project'))[0].project_name,
    ).to.equal("Default ' forest, `name`");
  });

  for (const type of ['VARCHAR(700)', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT']) {
    it(`does not narrow an existing ${type} column`, async function () {
      await queryInterface.removeIndex('project', 'project_project_name');
      await query(
        `ALTER TABLE project MODIFY COLUMN project_name ${type} NOT NULL`,
      );
      await insert('custom', 'c'.repeat(700));
      const before = await schema();
      await up();
      expect(await schema()).to.equal(before);
      expect(
        (await query('SELECT project_name FROM project'))[0].project_name,
      ).to.equal('c'.repeat(700));
    });
  }

  for (const type of ['CHAR(255)', 'TINYTEXT', 'INT', 'VARBINARY(255)']) {
    it(`rejects unsupported ${type} without changing schema`, async function () {
      await queryInterface.removeIndex('project', 'project_project_name');
      await query(
        `ALTER TABLE project MODIFY COLUMN project_name ${type} NOT NULL`,
      );
      const before = await schema();
      let failure;
      try {
        await up();
      } catch (error) {
        failure = error;
      }
      expect(failure?.message).to.match(/project_name.*unsupported.*manual/i);
      expect(await schema()).to.equal(before);
    });
  }

  it('refuses COPY fallback that would silently convert a unique BTREE index to HASH', async function () {
    await query(
      "ALTER TABLE project ROW_FORMAT=DYNAMIC, ADD COLUMN index_padding VARCHAR(500) NOT NULL DEFAULT 'padding'",
    );
    await query(
      'CREATE UNIQUE INDEX project_name_with_padding ON project (project_name, index_padding)',
    );
    await insert('retained', 'Retained after failed ALTER');
    await assertAlterFailure('ER_ALTER_OPERATION_NOT_SUPPORTED_REASON');
  });

  it('propagates a real COMPACT index-limit failure with schema, data and full indexes intact', async function () {
    await queryInterface.dropTable('project');
    await query(
      'CREATE TABLE project (project_name VARCHAR(255) NOT NULL, INDEX project_name_full (project_name)) ENGINE=InnoDB ROW_FORMAT=COMPACT DEFAULT CHARSET=utf8mb3',
    );
    await query('INSERT INTO project VALUES (?)', [
      'Retained after index-limit rejection',
    ]);
    await assertAlterFailure('ER_INDEX_COLUMN_TOO_LONG');
  });

  it('leaves a safe but COPY-required latin1 schema intact for manual review', async function () {
    await query(
      'ALTER TABLE project MODIFY COLUMN project_name VARCHAR(255) CHARACTER SET latin1 COLLATE latin1_bin NOT NULL',
    );
    await insert('latin1', 'Retained after COPY rejection');
    await assertAlterFailure('ER_ALTER_OPERATION_NOT_SUPPORTED_REASON');
  });
});
