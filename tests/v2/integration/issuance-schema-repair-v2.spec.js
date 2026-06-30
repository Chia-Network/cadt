import { expect } from 'chai';
import { Sequelize } from 'sequelize';
import RepairIssuanceProjectMethodologyColumnV2 from '../../../src/database/v2/migrations/20260629133000-repair-issuance-project-methodology-column-v2.js';

const getColumnNames = async (sequelize) => {
  const columns = await sequelize.query(
    "PRAGMA table_info('issuance')",
    { type: Sequelize.QueryTypes.SELECT },
  );
  return columns.map((column) => column.name);
};

const hasProjectMethodologyIndex = async (sequelize) => {
  const indexes = await sequelize.getQueryInterface().showIndex('issuance');
  return indexes.some((index) => {
    return (index.fields || []).some((field) => {
      if (typeof field === 'string') {
        return field === 'cad_trust_project_methodology_id';
      }
      return (
        field?.attribute === 'cad_trust_project_methodology_id' ||
        field?.name === 'cad_trust_project_methodology_id'
      );
    });
  });
};

const createIssuanceTable = async (sequelize, extraColumns = {}) => {
  await sequelize.getQueryInterface().createTable('issuance', {
    cad_trust_issuance_id: {
      type: Sequelize.STRING(36),
      primaryKey: true,
      allowNull: false,
    },
    issuance_id: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    issuance_date: {
      type: Sequelize.DATEONLY,
      allowNull: true,
    },
    cad_trust_verification_id: {
      type: Sequelize.STRING(36),
      allowNull: false,
    },
    ...extraColumns,
    cad_trust_location_id: {
      type: Sequelize.STRING(36),
      allowNull: true,
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  });
};

describe('V2 issuance schema repair migration', function () {
  let sequelize;

  beforeEach(async function () {
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });
  });

  afterEach(async function () {
    await sequelize.close();
  });

  it('renames legacy issuance methodology column and preserves values', async function () {
    await createIssuanceTable(sequelize, {
      cad_trust_methodology_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
      },
    });
    await sequelize.query(
      `INSERT INTO issuance (
        cad_trust_issuance_id,
        issuance_id,
        cad_trust_verification_id,
        cad_trust_methodology_id,
        created_at,
        updated_at
      ) VALUES (
        'issuance-1',
        'ISS-1',
        'verification-1',
        'project-methodology-1',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )`,
    );

    await RepairIssuanceProjectMethodologyColumnV2.up(
      sequelize.getQueryInterface(),
      Sequelize,
    );

    const columns = await getColumnNames(sequelize);
    expect(columns).to.include('cad_trust_project_methodology_id');
    expect(columns).to.not.include('cad_trust_methodology_id');

    const rows = await sequelize.query(
      'SELECT cad_trust_project_methodology_id FROM issuance',
      { type: Sequelize.QueryTypes.SELECT },
    );
    expect(rows[0].cad_trust_project_methodology_id).to.equal('project-methodology-1');
    expect(await hasProjectMethodologyIndex(sequelize)).to.equal(true);
  });

  it('adds the missing issuance project methodology column to stale SQLite schemas', async function () {
    await createIssuanceTable(sequelize);
    await sequelize.query(
      `INSERT INTO issuance (
        cad_trust_issuance_id,
        issuance_id,
        cad_trust_verification_id,
        created_at,
        updated_at
      ) VALUES (
        'issuance-1',
        'ISS-1',
        'verification-1',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )`,
    );

    await RepairIssuanceProjectMethodologyColumnV2.up(
      sequelize.getQueryInterface(),
      Sequelize,
    );

    const columns = await getColumnNames(sequelize);
    expect(columns).to.include('cad_trust_project_methodology_id');

    const rows = await sequelize.query(
      'SELECT cad_trust_project_methodology_id FROM issuance',
      { type: Sequelize.QueryTypes.SELECT },
    );
    expect(rows[0].cad_trust_project_methodology_id).to.equal(null);
    expect(await hasProjectMethodologyIndex(sequelize)).to.equal(true);
  });

  it('is idempotent when the issuance project methodology column already exists', async function () {
    await createIssuanceTable(sequelize, {
      cad_trust_project_methodology_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
      },
    });

    await RepairIssuanceProjectMethodologyColumnV2.up(
      sequelize.getQueryInterface(),
      Sequelize,
    );
    await RepairIssuanceProjectMethodologyColumnV2.up(
      sequelize.getQueryInterface(),
      Sequelize,
    );

    const columns = await getColumnNames(sequelize);
    expect(
      columns.filter((name) => name === 'cad_trust_project_methodology_id'),
    ).to.have.length(1);
    expect(await hasProjectMethodologyIndex(sequelize)).to.equal(true);
  });
});
