import { expect } from 'chai';
import Sequelize from 'sequelize';

// Import config.js so its DATE._stringify patch is applied before
// we exercise it here. The patch runs once at module load.
// eslint-disable-next-line no-unused-vars
import _config from '../../../src/config/config.js';

/**
 * Regression test for the Sequelize mirror datetime format.
 *
 * Recent MariaDB strict mode rejects Sequelize's default DATE serialization
 * ("YYYY-MM-DD HH:mm:ss.SSS Z", e.g. "2026-04-17 19:12:48.720 +00:00")
 * with "Incorrect datetime value". `src/config/config.js` patches
 * `Sequelize.DataTypes.DATE.prototype._stringify` to drop the trailing
 * offset (emitting "YYYY-MM-DD HH:mm:ss.SSS"), which MariaDB strict mode
 * accepts. The mysql dialect subclass already emits a safe format on its
 * own ("YYYY-MM-DD HH:mm:ss") so direct mysql attribute writes are
 * unaffected by the patch.
 *
 * If this test fails, CADT's MySQL mirror writes will silently drop every
 * insert that touches a DATE/DATETIME column in strict-mode MariaDB.
 */
describe('Mirror datetime serialization', function () {
  const sampleDate = new Date('2026-04-17T19:12:48.720Z');

  it('BASE DATE._stringify must emit a MariaDB-safe format (no " +00:00" offset)', function () {
    const out = Sequelize.DataTypes.DATE.prototype.stringify(sampleDate, {
      timezone: '+00:00',
    });
    expect(out).to.not.include('+');
    expect(out).to.not.include('Z');
    // Expected exact format (millisecond precision is kept so that
    // SQLite round-trips via sqlite.DATE.parse preserve sub-second
    // precision that tests and source writers depend on).
    expect(out).to.equal('2026-04-17 19:12:48.720');
  });

  it('BASE DATE._stringify must honour the constructor-level timezone option', function () {
    const out = Sequelize.DataTypes.DATE.prototype.stringify(sampleDate, {
      timezone: '+05:30',
    });
    expect(out).to.equal('2026-04-18 00:42:48.720');
  });

  it('SQLite DATE round-trip via parse() must reconstruct an equivalent Date', function () {
    // SQLite inherits the patched _stringify (no own override). Its
    // DATE.parse appends options.timezone when the string lacks a
    // "+"/"-" offset, so the round-trip is lossless when the Sequelize
    // instance defaults timezone to "+00:00" (which it does).
    const out = Sequelize.DataTypes.sqlite.DATE.prototype.stringify(
      sampleDate,
      { timezone: '+00:00' },
    );
    expect(out).to.equal('2026-04-17 19:12:48.720');
    const parsed = Sequelize.DataTypes.sqlite.DATE.parse(out, {
      timezone: '+00:00',
    });
    expect(parsed.toISOString()).to.equal('2026-04-17T19:12:48.720Z');
  });

  it('SQLite DATE.parse must still round-trip pre-patch rows (legacy " +00:00" form)', function () {
    // Existing CADT databases have dates like
    // "2026-04-17 19:12:48.720 +00:00" from before the patch.
    // sqlite.DATE.parse returns `new Date(str)` directly when the
    // string already contains "+", so legacy rows keep parsing.
    const legacy = '2026-04-17 19:12:48.720 +00:00';
    const parsed = Sequelize.DataTypes.sqlite.DATE.parse(legacy, {
      timezone: '+00:00',
    });
    expect(parsed.toISOString()).to.equal('2026-04-17T19:12:48.720Z');
  });

  it('mysql DATE._stringify must emit "YYYY-MM-DD HH:mm:ss" (no offset, no fractional seconds)', function () {
    // mysql subclass has its own _stringify. Pin its exact output so a
    // future Sequelize upgrade that changes the mysql subclass (e.g.
    // ISO "T" separator, or re-introducing a trailing offset) is
    // caught here rather than silently in a live-api run.
    const out = Sequelize.DataTypes.mysql.DATE.prototype.stringify(sampleDate, {
      timezone: '+00:00',
    });
    expect(out).to.equal('2026-04-17 19:12:48');
  });
});
