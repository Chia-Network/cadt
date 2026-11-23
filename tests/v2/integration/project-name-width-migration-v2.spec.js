import { expect } from 'chai';
import { Sequelize } from 'sequelize';

import { migrations } from '../../../src/database/v2/migrations/index.js';
import { ProjectV2Mirror } from '../../../src/models/v2/project-v2.model.mirror.js';

const migrationName = '20261123120000-widen-project-name-v2';

describe('V2 project name mirror width', function () {
  it('registers the corrective migration after the project creation migration', function () {
    const index = migrations.findIndex(({ name }) => name === migrationName);
    expect(index).to.be.greaterThan(
      migrations.findIndex(
        ({ name }) => name === '20250110120008-create-project-v2',
      ),
    );
  });

  it('declares a 500-character mirror name', function () {
    expect(ProjectV2Mirror.rawAttributes.projectName.type.toSql()).to.equal(
      'VARCHAR(500)',
    );
  });

  it('leaves SQLite schema, indexes and existing values unchanged in both directions', async function () {
    const sequelize = new Sequelize('sqlite::memory:', { logging: false });
    try {
      await sequelize.query(
        'CREATE TABLE project (project_name VARCHAR(255) NOT NULL)',
      );
      await sequelize.query(
        'CREATE INDEX project_project_name ON project (project_name)',
      );
      const name = '森'.repeat(500);
      await sequelize.query('INSERT INTO project VALUES (?)', {
        replacements: [name],
      });
      const [before] = await sequelize.query(
        'SELECT * FROM sqlite_master ORDER BY name',
      );
      const entry = migrations.find(({ name }) => name === migrationName);
      expect(entry, 'registered width migration').to.exist;
      await entry.migration.up(sequelize.getQueryInterface(), Sequelize);
      await entry.migration.down(sequelize.getQueryInterface(), Sequelize);
      const [after] = await sequelize.query(
        'SELECT * FROM sqlite_master ORDER BY name',
      );
      const [rows] = await sequelize.query('SELECT * FROM project');
      expect(after).to.deep.equal(before);
      expect(rows).to.deep.equal([{ project_name: name }]);
    } finally {
      await sequelize.close();
    }
  });
});
