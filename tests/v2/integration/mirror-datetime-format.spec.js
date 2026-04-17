import { expect } from 'chai';
import Sequelize from 'sequelize';

/**
 * Regression test for the Sequelize mirror datetime format.
 *
 * Recent MariaDB strict mode rejects Sequelize's base DATE serialization
 * ("YYYY-MM-DD HH:mm:ss.SSS Z", e.g. "2026-04-17 17:07:13.399 +00:00")
 * with "Incorrect datetime value".
 *
 * Normal mirror writes are safe because Sequelize dispatches to the
 * dialect-specific mysql.DATE class, which emits "YYYY-MM-DD HH:mm:ss"
 * (no offset, no fractional seconds). Empirically verified: single
 * INSERT, bulk INSERT, and INSERT ... ON DUPLICATE KEY UPDATE all route
 * through mysql.DATE._stringify and never touch the base-class method.
 *
 * This test pins that contract so a future Sequelize upgrade that changes
 * the mysql subclass serialiser (e.g. to emit an ISO "T" separator, or
 * to re-introduce a trailing offset) is caught here rather than silently
 * in a live-api run.
 *
 * Separately, backfill's findAll({ raw: true }) path would have returned
 * SQLite DATE values as offset-bearing strings and forwarded them to
 * MariaDB verbatim - that class of bug is prevented by the
 * `.get({ plain: true, raw: true })` call in backfillMirror[V2], which
 * has its own coverage in the V1/V2 reconnect specs.
 */
describe('Mirror datetime serialization (mysql subclass contract)', function () {
  const sampleDate = new Date('2026-04-17T17:07:13.399Z');

  it('mysql DATE._stringify must emit "YYYY-MM-DD HH:mm:ss" (no offset, no fractional seconds)', function () {
    const out = Sequelize.DataTypes.mysql.DATE.prototype.stringify(sampleDate, {
      timezone: '+00:00',
    });
    expect(out).to.equal('2026-04-17 17:07:13');
  });

  it('mysql DATE._stringify must honour the constructor-level timezone option', function () {
    // Non-UTC timezone must shift the formatted wall-clock time.
    const out = Sequelize.DataTypes.mysql.DATE.prototype.stringify(sampleDate, {
      timezone: '+05:30',
    });
    expect(out).to.equal('2026-04-17 22:37:13');
  });
});
