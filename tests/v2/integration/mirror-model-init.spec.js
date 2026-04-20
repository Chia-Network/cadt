import { expect } from 'chai';

import * as v2ModelsIndex from '../../../src/models/v2/index.js';

import { AuditMirror } from '../../../src/models/audit/audit.model.mirror.js';
import { CoBenefitMirror } from '../../../src/models/co-benefits/co-benefits.model.mirror.js';
import { EstimationMirror } from '../../../src/models/estimations/estimations.model.mirror.js';
import { IssuanceMirror } from '../../../src/models/issuances/issuances.model.mirror.js';
import { LabelUnitMirror } from '../../../src/models/labelUnits/labelUnits.model.mirror.js';
import { LabelMirror } from '../../../src/models/labels/labels.model.mirror.js';
import { ProjectLocationMirror } from '../../../src/models/locations/locations.model.mirror.js';
import { ProjectMirror } from '../../../src/models/projects/projects.model.mirror.js';
import { RatingMirror } from '../../../src/models/ratings/ratings.model.mirror.js';
import { RelatedProjectMirror } from '../../../src/models/related-projects/related-projects.model.mirror.js';
import { UnitMirror } from '../../../src/models/units/units.model.mirror.js';

/**
 * Mirror Model Initialization Tests
 *
 * Regression guard for the startup race condition fixed in
 * `fix/mirror-init-startup-race`: previously, each `*.model.mirror.js` file
 * wrapped `Model.init(...)` inside `safeMirrorDbHandler[V2](() => ...)`, which
 * only invokes its callback AFTER `sequelize.authenticate()` resolves. When
 * the MySQL sidecar container lost the startup race against CADT (observed
 * on k8s), authenticate() failed with ECONNREFUSED, the .then() never fired,
 * the models were never initialized, and every subsequent mirror write threw
 * "Cannot read properties of undefined (reading 'constructor')" from deep
 * inside Sequelize (this.sequelize was undefined on uninitialized Models).
 *
 * After the fix, mirror `Model.init()` runs synchronously at module load via
 * `initMirrorModel[V2]`, which does not require a live connection. Once init
 * has run, `rawAttributes` is populated and stays populated for the life of
 * the process, regardless of connection state.
 *
 * These tests assert that every *Mirror model has a populated `rawAttributes`
 * map immediately after module import. If someone re-wraps an init() in
 * `safeMirrorDbHandler[V2]` by accident, this test will fail.
 */
describe('Mirror Model Initialization', function () {
  const assertInitialized = (name, model) => {
    expect(model, `${name} is undefined`).to.exist;
    expect(model.rawAttributes, `${name}.rawAttributes is missing`).to.exist;
    expect(
      Object.keys(model.rawAttributes).length,
      `${name}.rawAttributes is empty (Model.init() did not run)`,
    ).to.be.greaterThan(0);
  };

  // backfillMirror[V2]'s orphan sweep and paginated ORDER BY both require
  // a single-column primary key and silently skip composite-PK tables.
  // Every existing mirror model has a single-column PK today; this
  // assertion guards that invariant so a future composite-PK mirror can't
  // silently bypass outage-delete recovery.
  const assertSingleColumnPrimaryKey = (name, model) => {
    const pkAttrs = model.primaryKeyAttributes || [];
    expect(
      pkAttrs.length,
      `${name} must have exactly one primary key column (has ${pkAttrs.length}: ${pkAttrs.join(', ')}). ` +
        `Mirror backfill's orphan sweep and paginated ORDER BY currently skip ` +
        `composite-PK tables - add composite-key support or keep PKs single-column.`,
    ).to.equal(1);
  };

  describe('V2 mirror models', function () {
    const v2MirrorModelNames = Object.keys(v2ModelsIndex).filter((k) =>
      k.endsWith('Mirror'),
    );

    it('should discover every V2 mirror model via the v2 models barrel', function () {
      expect(v2MirrorModelNames.length).to.be.greaterThan(0);
    });

    v2MirrorModelNames.forEach((name) => {
      it(`${name} should have rawAttributes populated after module load`, function () {
        assertInitialized(name, v2ModelsIndex[name]);
      });
      it(`${name} should have a single-column primary key (orphan-sweep invariant)`, function () {
        assertSingleColumnPrimaryKey(name, v2ModelsIndex[name]);
      });
    });
  });

  describe('V1 mirror models', function () {
    const v1MirrorModels = {
      AuditMirror,
      CoBenefitMirror,
      EstimationMirror,
      IssuanceMirror,
      LabelUnitMirror,
      LabelMirror,
      ProjectLocationMirror,
      ProjectMirror,
      RatingMirror,
      RelatedProjectMirror,
      UnitMirror,
    };

    Object.entries(v1MirrorModels).forEach(([name, model]) => {
      it(`${name} should have rawAttributes populated after module load`, function () {
        assertInitialized(name, model);
      });
      it(`${name} should have a single-column primary key (orphan-sweep invariant)`, function () {
        assertSingleColumnPrimaryKey(name, model);
      });
    });
  });
});
