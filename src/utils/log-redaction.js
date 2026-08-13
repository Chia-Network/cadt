export const REDACTED = '[REDACTED]';

// Header names whose values must never reach a log transport. Compared
// lowercased: Node lowercases inbound header names, but header maps built
// elsewhere in the codebase are not guaranteed to be normalized.
const SENSITIVE_HEADERS = new Set([
  'x-api-key',
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
]);

/**
 * Copy a header map with the values of sensitive headers replaced by a
 * placeholder. The header name is preserved so logs still show that
 * credentials were supplied.
 *
 * Expects a plain object of own enumerable properties, as `req.headers` is.
 * Containers that hold entries elsewhere (a `Headers` instance, a `Map`) copy
 * as empty rather than leaking their values.
 *
 * @param {Object} headers - Header map, typically `req.headers`.
 * @returns {Object} Copy safe to log.
 */
export const redactHeaders = (headers) => {
  if (headers == null || typeof headers !== 'object') {
    return headers;
  }

  const redacted = {};
  for (const [name, value] of Object.entries(headers)) {
    redacted[name] = SENSITIVE_HEADERS.has(name.toLowerCase())
      ? REDACTED
      : value;
  }

  return redacted;
};
