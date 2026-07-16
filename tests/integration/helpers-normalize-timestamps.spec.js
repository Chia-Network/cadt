import { expect } from 'chai';
import {
  normalizeApiTimestampFields,
  normalizeRawTimestamps,
} from '../../src/utils/helpers.js';

describe('normalizeRawTimestamps', function () {
  it('converts a SQLite datetime string to ISO-8601', function () {
    const rows = [{ createdAt: '2026-06-15 19:19:58.131 +00:00' }];
    normalizeRawTimestamps(rows, ['createdAt']);
    expect(rows[0].createdAt).to.equal('2026-06-15T19:19:58.131Z');
  });

  it('converts a Date instance (MySQL driver) to ISO-8601', function () {
    const date = new Date('2026-06-15T19:19:58.131Z');
    const rows = [{ created_at: date }];
    normalizeRawTimestamps(rows, ['created_at']);
    expect(rows[0].created_at).to.equal('2026-06-15T19:19:58.131Z');
  });

  it('leaves null and undefined values untouched', function () {
    const rows = [{ createdAt: null, updatedAt: undefined }];
    normalizeRawTimestamps(rows, ['createdAt', 'updatedAt']);
    expect(rows[0].createdAt).to.equal(null);
    expect(rows[0].updatedAt).to.equal(undefined);
  });

  it('leaves unparseable values untouched', function () {
    const rows = [{ createdAt: 'not-a-date' }];
    normalizeRawTimestamps(rows, ['createdAt']);
    expect(rows[0].createdAt).to.equal('not-a-date');
  });

  it('normalizes every row and only the requested fields', function () {
    const rows = [
      { createdAt: '2026-01-01 00:00:00.000 +00:00', other: 'keep' },
      { createdAt: '2026-02-02 00:00:00.000 +00:00', other: 'keep' },
    ];
    normalizeRawTimestamps(rows, ['createdAt']);
    expect(rows[0].createdAt).to.equal('2026-01-01T00:00:00.000Z');
    expect(rows[1].createdAt).to.equal('2026-02-02T00:00:00.000Z');
    expect(rows[0].other).to.equal('keep');
  });
});

describe('normalizeApiTimestampFields', function () {
  it('removes snake_case timestamp aliases when camelCase timestamps exist', function () {
    const response = normalizeApiTimestampFields({
      data: [{
        cadTrustProjectMethodologyId: 'pm-1',
        createdAt: '2026-07-15T16:17:01.227Z',
        updatedAt: '2026-07-15T16:17:01.227Z',
        created_at: '2026-07-15T16:17:01.227Z',
        updated_at: '2026-07-15T16:17:01.227Z',
      }],
    });

    expect(response.data[0]).to.include({
      createdAt: '2026-07-15T16:17:01.227Z',
      updatedAt: '2026-07-15T16:17:01.227Z',
    });
    expect(response.data[0]).to.not.have.property('created_at');
    expect(response.data[0]).to.not.have.property('updated_at');
  });

  it('promotes snake_case-only timestamps to camelCase', function () {
    const response = normalizeApiTimestampFields({
      cadTrustProjectId: 'project-1',
      created_at: '2026-07-15T16:17:01.121Z',
      updated_at: '2026-07-15T16:17:01.121Z',
    });

    expect(response).to.include({
      cadTrustProjectId: 'project-1',
      createdAt: '2026-07-15T16:17:01.121Z',
      updatedAt: '2026-07-15T16:17:01.121Z',
    });
    expect(response).to.not.have.property('created_at');
    expect(response).to.not.have.property('updated_at');
  });

  it('does not rewrite nested arbitrary JSON payloads', function () {
    const response = normalizeApiTimestampFields({
      id: 1,
      created_at: '2026-07-15T16:17:01.121Z',
      diff: {
        original: {
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        },
      },
    });

    expect(response).to.include({
      createdAt: '2026-07-15T16:17:01.121Z',
    });
    expect(response).to.not.have.property('created_at');
    expect(response.diff.original).to.include({
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
    });
  });
});
