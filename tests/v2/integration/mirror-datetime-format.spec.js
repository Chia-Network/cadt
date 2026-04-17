import { expect } from 'chai';
import Sequelize from 'sequelize';

// Import config.js (via the barrel) to install the DATE._stringify patch.
// The patch is applied once at module load; this file only exercises it.
// eslint-disable-next-line no-unused-vars
import _config from '../../../src/config/config.js';

/**
 * Regression test for the Sequelize mirror datetime format.
 *
 * Recent MariaDB strict mode rejects Sequelize's default DATE serialization
 * of "YYYY-MM-DD HH:mm:ss.SSS Z" (e.g. "2026-04-17 17:07:13.399 +00:00")
 * with "Incorrect datetime value". `src/config/config.js` patches the base
 * DATE._stringify to emit "YYYY-MM-DD HH:mm:ss" for MySQL/MariaDB while
 * retaining the original format for SQLite (whose parse() depends on the
 * trailing offset for round-trip).
 *
 * If this test fails, CADT's MySQL mirror writes will silently drop every
 * insert that touches a DATE/DATETIME column in strict-mode MariaDB.
 */
describe('Mirror datetime serialization', function () {
  const sampleDate = new Date('2026-04-17T17:07:13.399Z');

  it('BASE DATE._stringify must emit the MariaDB-safe format (no offset, no fractional seconds)', function () {
    const out = Sequelize.DataTypes.DATE.prototype.stringify(sampleDate, {
      timezone: '+00:00',
    });
    expect(out).to.equal('2026-04-17 17:07:13');
    expect(out).to.not.include('+');
    expect(out).to.not.include('Z');
    expect(out).to.not.include('.');
  });

  it('SQLite DATE._stringify must retain the original format (with trailing offset) for round-trip', function () {
    const out = Sequelize.DataTypes.sqlite.DATE.prototype.stringify(
      sampleDate,
      { timezone: '+00:00' },
    );
    // SQLite's own parse() needs this offset suffix to reconstruct a Date
    expect(out).to.include('+00:00');
    const parsed = Sequelize.DataTypes.sqlite.DATE.parse(out, {
      timezone: '+00:00',
    });
    expect(parsed.getTime()).to.equal(sampleDate.getTime());
  });

  it('mysql DATE._stringify must continue to emit the MariaDB-safe format', function () {
    const out = Sequelize.DataTypes.mysql.DATE.prototype.stringify(sampleDate, {
      timezone: '+00:00',
    });
    expect(out).to.equal('2026-04-17 17:07:13');
  });
});
