import { expect } from 'chai';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { sequelizeV2 } from '../../../src/database/v2/index.js';

describe('Database Schema Check', function () {
  this.timeout(30000);

  before(async function () {
    await prepareV2Db();
  });

  it('should include project methodology identifiers in the SQLite schema', async function () {
    const [projectMethodologyColumns] = await sequelizeV2.query(
      `PRAGMA table_info(project_methodology)`,
    );
    const [issuanceColumns] = await sequelizeV2.query(
      `PRAGMA table_info(issuance)`,
    );

    expect(projectMethodologyColumns.map((col) => col.name)).to.include(
      'cad_trust_project_methodology_id',
    );
    expect(issuanceColumns.map((col) => col.name)).to.include(
      'cad_trust_project_methodology_id',
    );
  });
});
