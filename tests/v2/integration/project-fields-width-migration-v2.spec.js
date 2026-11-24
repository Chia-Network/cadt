import { expect } from 'chai';
import { Sequelize } from 'sequelize';

import { migrations } from '../../../src/database/v2/migrations/index.js';
import { ProjectV2Mirror } from '../../../src/models/v2/project-v2.model.mirror.js';

const migrationName = '20261123120000-widen-project-fields-v2';

describe('V2 project mirror field widths', function () {
  it('registers the corrective migration after the project creation migration', function () {
    const index = migrations.findIndex(({ name }) => name === migrationName);
    expect(index).to.be.greaterThan(
      migrations.findIndex(
        ({ name }) => name === '20250110120008-create-project-v2',
      ),
    );
  });

  for (const [field, length] of [
    ['projectName', 500],
    ['projectSector', 768],
    ['projectType', 768],
  ]) {
    it(`declares ${field} as VARCHAR(${length})`, function () {
      expect(ProjectV2Mirror.rawAttributes[field].type.toSql()).to.equal(
        `VARCHAR(${length})`,
      );
    });
  }

  it('leaves SQLite schema, indexes and existing values unchanged in both directions', async function () {
    const sequelize = new Sequelize('sqlite::memory:', { logging: false });
    try {
      await sequelize.query(
        'CREATE TABLE project (project_name VARCHAR(255) NOT NULL, project_sector VARCHAR(255), project_type VARCHAR(255))',
      );
      for (const field of ['project_name', 'project_sector', 'project_type']) {
        await sequelize.query(
          `CREATE INDEX project_${field} ON project (${field})`,
        );
      }
      const values = {
        project_name: '森'.repeat(500),
        project_sector: '森'.repeat(768),
        project_type: '🌲'.repeat(768),
      };
      await sequelize.query('INSERT INTO project VALUES (?, ?, ?)', {
        replacements: Object.values(values),
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
      expect(rows).to.deep.equal([values]);
    } finally {
      await sequelize.close();
    }
  });
});
