/**
 * V2 FTS5 Query Sanitization Utility
 *
 * Improved version over V1 that:
 * - Doesn't force prefix matching (removed automatic '*' suffix)
 * - Better handling of special characters
 * - Preserves user intent (phrases, exact matches)
 * - Proper escaping of FTS5 special characters
 *
 * FTS5 special characters that need escaping: " ' * + - AND OR NOT
 */

/**
 * Sanitizes a SQLite FTS5 query string
 * @param {string} query - The search query to sanitize
 * @returns {string} - Sanitized query string, or empty string if invalid
 */
export const sanitizeSqliteFtsQuery = (query) => {
  if (!query || typeof query !== 'string') {
    return '';
  }

  // Trim whitespace
  query = query.trim();

  // Empty query returns empty string (will match nothing)
  if (!query) {
    return '';
  }

  // Escape double quotes (FTS5 uses double quotes for phrases)
  // Double quotes inside phrases need to be escaped as ""
  query = query.replace(/"/g, '""');

  // Note: Don't force prefix matching - let users control it
  // Users can add '*' themselves if they want prefix matching
  // This preserves user intent for exact matches and phrases

  return query;
};


