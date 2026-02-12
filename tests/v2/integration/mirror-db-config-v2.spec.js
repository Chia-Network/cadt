import { expect } from 'chai';
import {
  prepareV2Db,
  validateMirrorDbNames,
} from '../../../src/database/v2/index.js';
import config from '../../../src/config/config.js';

/**
 * Mirror DB Configuration V2 Tests
 *
 * Tests for V2 mirror database configuration validation, including:
 *   1. The validateMirrorDbNames function is exported and callable
 *   2. It throws when V1 and V2 mirror DB names are the same
 *   3. It passes when they are different
 *   4. It handles edge cases (null, undefined, empty, missing configs)
 *   5. The v2Mirror Sequelize config uses DB_NAME directly (no suffix)
 */
describe('Mirror DB Configuration V2 Tests', function () {
  this.timeout(30000);

  before(async function () {
    await prepareV2Db();
  });

  describe('validateMirrorDbNames', function () {
    it('should be exported as a function', function () {
      expect(validateMirrorDbNames).to.be.a('function');
    });

    it('should throw when V1 and V2 mirror DB names are identical', function () {
      const v1Config = { MIRROR_DB: { DB_NAME: 'same_db' } };
      const v2Config = { MIRROR_DB: { DB_NAME: 'same_db' } };

      expect(() => validateMirrorDbNames(v1Config, v2Config)).to.throw(
        'V1 and V2 mirror databases must use different database names',
      );
    });

    it('should include the duplicate name in the error message', function () {
      const v1Config = { MIRROR_DB: { DB_NAME: 'my_cadt_db' } };
      const v2Config = { MIRROR_DB: { DB_NAME: 'my_cadt_db' } };

      expect(() => validateMirrorDbNames(v1Config, v2Config)).to.throw(
        "but both are set to 'my_cadt_db'",
      );
    });

    it('should include config update guidance in the error message', function () {
      const v1Config = { MIRROR_DB: { DB_NAME: 'shared' } };
      const v2Config = { MIRROR_DB: { DB_NAME: 'shared' } };

      expect(() => validateMirrorDbNames(v1Config, v2Config)).to.throw(
        'Update MIRROR_DB.DB_NAME in your config.yaml so V1 and V2 have distinct values',
      );
    });

    it('should not throw when V1 and V2 mirror DB names are different', function () {
      const v1Config = { MIRROR_DB: { DB_NAME: 'cadtv1' } };
      const v2Config = { MIRROR_DB: { DB_NAME: 'cadtv2' } };

      expect(() => validateMirrorDbNames(v1Config, v2Config)).to.not.throw();
    });

    it('should not throw when V1 mirror DB name is null', function () {
      const v1Config = { MIRROR_DB: { DB_NAME: null } };
      const v2Config = { MIRROR_DB: { DB_NAME: 'cadtv2' } };

      expect(() => validateMirrorDbNames(v1Config, v2Config)).to.not.throw();
    });

    it('should not throw when V2 mirror DB name is null', function () {
      const v1Config = { MIRROR_DB: { DB_NAME: 'cadtv1' } };
      const v2Config = { MIRROR_DB: { DB_NAME: null } };

      expect(() => validateMirrorDbNames(v1Config, v2Config)).to.not.throw();
    });

    it('should not throw when both mirror DB names are null', function () {
      const v1Config = { MIRROR_DB: { DB_NAME: null } };
      const v2Config = { MIRROR_DB: { DB_NAME: null } };

      expect(() => validateMirrorDbNames(v1Config, v2Config)).to.not.throw();
    });

    it('should not throw when V1 mirror DB name is empty string', function () {
      const v1Config = { MIRROR_DB: { DB_NAME: '' } };
      const v2Config = { MIRROR_DB: { DB_NAME: 'cadtv2' } };

      expect(() => validateMirrorDbNames(v1Config, v2Config)).to.not.throw();
    });

    it('should not throw when V2 mirror DB name is empty string', function () {
      const v1Config = { MIRROR_DB: { DB_NAME: 'cadtv1' } };
      const v2Config = { MIRROR_DB: { DB_NAME: '' } };

      expect(() => validateMirrorDbNames(v1Config, v2Config)).to.not.throw();
    });

    it('should not throw when V1 config has no MIRROR_DB section', function () {
      const v1Config = {};
      const v2Config = { MIRROR_DB: { DB_NAME: 'cadtv2' } };

      expect(() => validateMirrorDbNames(v1Config, v2Config)).to.not.throw();
    });

    it('should not throw when V2 config has no MIRROR_DB section', function () {
      const v1Config = { MIRROR_DB: { DB_NAME: 'cadtv1' } };
      const v2Config = {};

      expect(() => validateMirrorDbNames(v1Config, v2Config)).to.not.throw();
    });

    it('should not throw when V1 config is null', function () {
      const v2Config = { MIRROR_DB: { DB_NAME: 'cadtv2' } };

      expect(() => validateMirrorDbNames(null, v2Config)).to.not.throw();
    });

    it('should not throw when V2 config is null', function () {
      const v1Config = { MIRROR_DB: { DB_NAME: 'cadtv1' } };

      expect(() => validateMirrorDbNames(v1Config, null)).to.not.throw();
    });

    it('should not throw when both configs are null', function () {
      expect(() => validateMirrorDbNames(null, null)).to.not.throw();
    });

    it('should not throw when both configs are undefined', function () {
      expect(() => validateMirrorDbNames(undefined, undefined)).to.not.throw();
    });
  });

  describe('v2Mirror config uses DB_NAME directly', function () {
    it('should not append any suffix to the database name', function () {
      const v2MirrorConfig = config.v2Mirror;

      expect(v2MirrorConfig).to.exist;
      expect(v2MirrorConfig.dialect).to.equal('mysql');

      // The database field should be the raw DB_NAME or empty string - never with a suffix
      // In test mode DB_NAME is null, so it should be ''
      expect(v2MirrorConfig.database).to.equal('');

      // Verify V1 mirror uses the same pattern
      const v1MirrorConfig = config.mirror;
      expect(v1MirrorConfig.database).to.equal('');
    });
  });
});
