import { expect } from 'chai';
import { Sequelize } from 'sequelize';

import migration from '../../../src/database/v2/migrations/20260629210000-rename-aef-cooperative-approach-columns-v2.js';

describe('AEF cooperative approach column migration', function () {
  let sequelize;
  let queryInterface;

  beforeEach(async function () {
    sequelize = new Sequelize('sqlite::memory:', { logging: false });
    queryInterface = sequelize.getQueryInterface();

    await queryInterface.createTable('aef_t3_actions', {
      cad_trust_aef_t3_actions_id: {
        type: Sequelize.STRING,
        primaryKey: true,
      },
      aef_t3_actions_coopoerative_approach_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
    });

    await queryInterface.createTable('aef_t4_holdings', {
      cad_trust_aef_t4_holdings_id: {
        type: Sequelize.STRING,
        primaryKey: true,
      },
      aef_t4_holdings_coopoerative_approach_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
    });

    await queryInterface.createTable('staging', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      table: Sequelize.STRING,
      data: Sequelize.STRING,
    });

    await sequelize.query(
      'INSERT INTO aef_t3_actions (cad_trust_aef_t3_actions_id, aef_t3_actions_coopoerative_approach_id) VALUES (?, ?)',
      { replacements: ['t3-id', 'T3-CA-001'] },
    );
    await sequelize.query(
      'INSERT INTO aef_t4_holdings (cad_trust_aef_t4_holdings_id, aef_t4_holdings_coopoerative_approach_id) VALUES (?, ?)',
      { replacements: ['t4-id', 'T4-CA-001'] },
    );
    await sequelize.query(
      'INSERT INTO staging (`table`, data) VALUES (?, ?), (?, ?)',
      {
        replacements: [
          'aef_t3_actions',
          JSON.stringify([{ aef_t3_actions_coopoerative_approach_id: 'STAGED-T3-CA-001' }]),
          'aef_t4_holdings',
          JSON.stringify([{ aef_t4_holdings_coopoerative_approach_id: 'STAGED-T4-CA-001' }]),
        ],
      },
    );
  });

  afterEach(async function () {
    await sequelize.close();
  });

  it('renames existing misspelled columns and preserves data', async function () {
    await migration.up(queryInterface, Sequelize);

    const t3Definition = await queryInterface.describeTable('aef_t3_actions');
    const t4Definition = await queryInterface.describeTable('aef_t4_holdings');

    expect(t3Definition).to.have.property('aef_t3_actions_cooperative_approach_id');
    expect(t3Definition).not.to.have.property('aef_t3_actions_coopoerative_approach_id');
    expect(t4Definition).to.have.property('aef_t4_holdings_cooperative_approach_id');
    expect(t4Definition).not.to.have.property('aef_t4_holdings_coopoerative_approach_id');

    const [t3Rows] = await sequelize.query(
      'SELECT aef_t3_actions_cooperative_approach_id FROM aef_t3_actions WHERE cad_trust_aef_t3_actions_id = ?',
      { replacements: ['t3-id'] },
    );
    const [t4Rows] = await sequelize.query(
      'SELECT aef_t4_holdings_cooperative_approach_id FROM aef_t4_holdings WHERE cad_trust_aef_t4_holdings_id = ?',
      { replacements: ['t4-id'] },
    );
    const [stagingRows] = await sequelize.query('SELECT `table`, data FROM staging ORDER BY id ASC');

    expect(t3Rows[0].aef_t3_actions_cooperative_approach_id).to.equal('T3-CA-001');
    expect(t4Rows[0].aef_t4_holdings_cooperative_approach_id).to.equal('T4-CA-001');
    expect(JSON.parse(stagingRows[0].data)[0]).to.deep.equal({
      aef_t3_actions_cooperative_approach_id: 'STAGED-T3-CA-001',
    });
    expect(JSON.parse(stagingRows[1].data)[0]).to.deep.equal({
      aef_t4_holdings_cooperative_approach_id: 'STAGED-T4-CA-001',
    });
  });
});
