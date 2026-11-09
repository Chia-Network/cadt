import { DeletePreviewTokenStore } from '../../../src/utils/v2-delete-preview-tokens.js';
import { expect } from 'chai';

const binding = {
  table: 'project',
  id: 'root',
  orgUid: 'home',
  registryId: 'registry',
};
const context = { ...binding, fingerprint: 'a'.repeat(64) };

describe('CAR-229 bounded delete preview tokens', function () {
  it('mints random opaque tokens retaining only compact bound context', function () {
    const store = new DeletePreviewTokenStore({ clock: () => 1000 });
    const first = store.mint(context);
    const second = store.mint(context);
    expect(first.token).to.match(/^[A-Za-z0-9_-]{43}$/);
    expect(second.token).not.to.equal(first.token);
    expect(first.expiresAt).to.equal(new Date(601000).toISOString());
    expect(store.lookup(first.token, binding)).to.deep.equal({
      ...context,
      issuedAt: 1000,
      expiresAt: 601000,
    });
    const entry = store.lookup(first.token, binding);
    entry.id = 'tampered';
    expect(store.lookup(first.token, binding).id).to.equal('root');
  });
  for (const field of Object.keys(binding)) {
    it(`rejects a token bound to another ${field}`, function () {
      const store = new DeletePreviewTokenStore();
      const { token } = store.mint(context);
      expect(() => store.lookup(token, { ...binding, [field]: 'other' }))
        .to.throw()
        .with.property('code', 'DELETE_PREVIEW_MISMATCH');
    });
  }
  it('expires at the exact injected-clock deadline and frees capacity on admission', function () {
    let now = 10;
    const store = new DeletePreviewTokenStore({
      clock: () => now,
      ttlMs: 20,
      maxEntries: 1,
    });
    const first = store.mint(context);
    now = 29;
    expect(store.lookup(first.token, binding).id).to.equal('root');
    now = 30;
    expect(() => store.lookup(first.token, binding))
      .to.throw()
      .with.property('code', 'DELETE_PREVIEW_EXPIRED');
    store.mint(context);
    now = 50;
    store.mint(context);
    expect(store.size).to.equal(1);
  });
  it('rejects unknown tokens including tokens from a restarted process', function () {
    const { token } = new DeletePreviewTokenStore().mint(context);
    expect(() => new DeletePreviewTokenStore().lookup(token, binding))
      .to.throw('restart')
      .with.property('code', 'DELETE_PREVIEW_UNKNOWN');
  });
  it('rejects count and byte exhaustion without evicting valid tokens', function () {
    const store = new DeletePreviewTokenStore({ maxEntries: 1 });
    const { token } = store.mint(context);
    expect(() => store.mint(context))
      .to.throw()
      .with.property('code', 'DELETE_PREVIEW_CAPACITY');
    expect(store.lookup(token, binding).id).to.equal('root');
    const small = new DeletePreviewTokenStore({ maxBytes: 1 });
    expect(() => small.mint(context))
      .to.throw()
      .with.property('code', 'DELETE_PREVIEW_CAPACITY');
    expect(small.size).to.equal(0);
    expect(small.retainedBytes).to.equal(0);
    const exact = new DeletePreviewTokenStore({
      maxBytes: store.retainedBytes,
    });
    exact.mint(context);
    expect(() => exact.mint(context))
      .to.throw()
      .with.property('code', 'DELETE_PREVIEW_CAPACITY');
  });
  it('rejects noncompact context instead of retaining caller-owned objects', function () {
    const store = new DeletePreviewTokenStore();
    expect(() =>
      store.mint({ ...context, fingerprint: { graph: ['private record'] } }),
    ).to.throw('context');
    expect(store.size).to.equal(0);
    expect(store.retainedBytes).to.equal(0);
  });
});
