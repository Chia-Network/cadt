import { expect } from 'chai';

import { normalizeLegacyV2FieldNames } from '../../../src/utils/v2-legacy-field-names.js';

describe('normalizeLegacyV2FieldNames', function () {
  it('renames the legacy misspelled AEF T3 cooperative approach key', function () {
    const normalized = normalizeLegacyV2FieldNames('aef_t3_actions', {
      cadTrustAefT3ActionsId: 't3-id',
      aefT3ActionsCoopoerativeApproachId: 'T3-CA-001',
    });

    expect(normalized).to.deep.equal({
      cadTrustAefT3ActionsId: 't3-id',
      aefT3ActionsCooperativeApproachId: 'T3-CA-001',
    });
  });

  it('renames the legacy misspelled AEF T4 cooperative approach key', function () {
    const normalized = normalizeLegacyV2FieldNames('aef_t4_holdings', {
      cadTrustAefT4HoldingsId: 't4-id',
      aefT4HoldingsCoopoerativeApproachId: 'T4-CA-001',
    });

    expect(normalized).to.deep.equal({
      cadTrustAefT4HoldingsId: 't4-id',
      aefT4HoldingsCooperativeApproachId: 'T4-CA-001',
    });
  });

  it('leaves records already using the corrected key unchanged', function () {
    const record = {
      cadTrustAefT4HoldingsId: 't4-id',
      aefT4HoldingsCooperativeApproachId: 'T4-CA-001',
    };

    expect(
      normalizeLegacyV2FieldNames('aef_t4_holdings', record),
    ).to.deep.equal(record);
  });

  it('does not overwrite an existing corrected key when both are present', function () {
    const normalized = normalizeLegacyV2FieldNames('aef_t4_holdings', {
      aefT4HoldingsCoopoerativeApproachId: 'legacy',
      aefT4HoldingsCooperativeApproachId: 'current',
    });

    expect(normalized.aefT4HoldingsCooperativeApproachId).to.equal('current');
  });

  it('does not mutate the input record', function () {
    const record = {
      aefT4HoldingsCoopoerativeApproachId: 'T4-CA-001',
    };

    normalizeLegacyV2FieldNames('aef_t4_holdings', record);

    expect(record).to.have.property('aefT4HoldingsCoopoerativeApproachId');
    expect(record).to.not.have.property('aefT4HoldingsCooperativeApproachId');
  });

  it('returns records for unaffected models unchanged', function () {
    const record = { projectName: 'Test' };

    expect(normalizeLegacyV2FieldNames('project', record)).to.equal(record);
  });
});
