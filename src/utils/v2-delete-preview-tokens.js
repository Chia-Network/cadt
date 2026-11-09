import { randomBytes } from 'node:crypto';

export const deletePreviewError = (code, message, status = 409) =>
  Object.assign(new Error(message), { code, status });

// Supported deployments run one application process. Tokens intentionally die on
// restart. Executing entries are pinned; completion receipts share the original
// token expiry and count/byte limits. No full graph or caller-owned object is retained.
export class DeletePreviewTokenStore {
  #entries = new Map();
  #bytes = 0;
  #clock;
  #ttlMs;
  #maxEntries;
  #maxBytes;

  constructor({
    clock = Date.now,
    ttlMs = 600000,
    maxEntries = 1024,
    maxBytes = 1048576,
  } = {}) {
    for (const value of [ttlMs, maxEntries, maxBytes]) {
      if (!Number.isSafeInteger(value) || value <= 0)
        throw new Error(
          'Delete preview cache limits must be positive finite integers',
        );
    }
    this.#clock = clock;
    this.#ttlMs = ttlMs;
    this.#maxEntries = maxEntries;
    this.#maxBytes = maxBytes;
  }

  get size() {
    return this.#entries.size;
  }
  get retainedBytes() {
    return this.#bytes;
  }

  #remove(token) {
    const entry = this.#entries.get(token);
    if (entry) this.#bytes -= entry.bytes;
    this.#entries.delete(token);
  }

  #purgeExpired(now, except) {
    for (const [token, entry] of this.#entries) {
      if (
        token !== except &&
        entry.state !== 'executing' &&
        entry.context.expiresAt <= now
      )
        this.#remove(token);
    }
  }

  mint({ table, id, orgUid, registryId, fingerprint }) {
    if (
      !['project', 'verification', 'issuance', 'unit'].includes(table) ||
      [id, orgUid, registryId].some(
        (value) => typeof value !== 'string' || !value,
      ) ||
      typeof fingerprint !== 'string' ||
      !/^[a-f0-9]{64}$/.test(fingerprint)
    ) {
      throw new Error(
        'Invalid delete preview token context: target, home organization, registry and fingerprint are required',
      );
    }
    const issuedAt = this.#clock();
    this.#purgeExpired(issuedAt);
    const context = {
      table,
      id,
      orgUid,
      registryId,
      fingerprint,
      issuedAt,
      expiresAt: issuedAt + this.#ttlMs,
    };
    const token = randomBytes(32).toString('base64url');
    const bytes =
      Buffer.byteLength(token) + Buffer.byteLength(JSON.stringify(context));
    if (
      this.#entries.size >= this.#maxEntries ||
      this.#bytes + bytes > this.#maxBytes
    ) {
      throw deletePreviewError(
        'DELETE_PREVIEW_CAPACITY',
        'Delete preview capacity is full. Wait for previews to expire and request a new preview.',
        503,
      );
    }
    this.#entries.set(token, { context, bytes, state: 'ready' });
    this.#bytes += bytes;
    return { token, expiresAt: new Date(context.expiresAt).toISOString() };
  }

  lookup(token, { table, id, orgUid, registryId }) {
    this.#purgeExpired(this.#clock(), token);
    const entry = this.#entries.get(token);
    if (!entry)
      throw deletePreviewError(
        'DELETE_PREVIEW_UNKNOWN',
        'Unknown delete preview, possibly invalidated by an application restart. Request a new preview.',
      );
    if (
      entry.state !== 'executing' &&
      entry.context.expiresAt <= this.#clock()
    ) {
      this.#remove(token);
      throw deletePreviewError(
        'DELETE_PREVIEW_EXPIRED',
        'Delete preview expired. Request a new preview.',
      );
    }
    const context = entry.context;
    if (
      context.table !== table ||
      context.id !== id ||
      context.orgUid !== orgUid ||
      context.registryId !== registryId
    ) {
      throw deletePreviewError(
        'DELETE_PREVIEW_MISMATCH',
        'Delete preview belongs to a different target, organization or registry. Request a new preview.',
      );
    }
    return { ...context };
  }
  receipt(token, binding) {
    this.lookup(token, binding);
    const entry = this.#entries.get(token);
    return entry.state === 'completed'
      ? { ...entry.result, replayed: true }
      : null;
  }

  // Reserve the compact success receipt before any staging write. Completion
  // only changes state after COMMIT, with no allocation/admission that can fail.
  claim(token, binding, result) {
    const context = this.lookup(token, binding);
    const entry = this.#entries.get(token);
    if (entry.state !== 'ready')
      throw deletePreviewError(
        'DELETE_PREVIEW_USED',
        'Deletion is already executing or completed. Retry the original request.',
      );
    const serialized = JSON.stringify(result);
    const receipt = Object.freeze(JSON.parse(serialized));
    const bytes = Buffer.byteLength(serialized);
    if (this.#bytes + bytes > this.#maxBytes)
      throw deletePreviewError(
        'DELETE_PREVIEW_CAPACITY',
        'Deletion receipt capacity is full. Wait for previews to expire and retry.',
        503,
      );
    entry.state = 'executing';
    entry.result = receipt;
    entry.bytes += bytes;
    this.#bytes += bytes;
    let settled = false;
    return {
      context,
      complete: () => {
        if (settled) return;
        settled = true;
        entry.state = 'completed';
      },
      release: () => {
        if (settled) return;
        settled = true;
        entry.state = 'ready';
        delete entry.result;
        entry.bytes -= bytes;
        this.#bytes -= bytes;
      },
    };
  }
}

export const deletePreviewTokens = new DeletePreviewTokenStore();
