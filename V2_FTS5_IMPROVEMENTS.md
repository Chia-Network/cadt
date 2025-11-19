# V2 FTS5 Implementation Improvements

## Issues Found in V1 Implementation

### 1. Performance Issues
- **Count Query**: Loads all rows into memory instead of using `COUNT(*)`
- **Rank Ordering**: Uses default `rank` instead of BM25 (better relevance)
- **UNION Queries**: Rank ordering doesn't work correctly with UNION

### 2. Query Sanitization
- Forces prefix matching with `*` suffix
- Confusing dash replacement logic
- May break legitimate queries

### 3. Trigger Efficiency
- UPDATE trigger uses DELETE + INSERT instead of INSERT OR REPLACE

### 4. Missing Features
- No BM25 ranking option
- No way to rebuild FTS tables
- No error handling for sync issues

## Recommended Improvements for V2

### 1. Use BM25 Ranking (Better Relevance)

```sql
-- Instead of: ORDER BY rank DESC
-- Use: ORDER BY bm25(projects_fts) ASC
-- Note: Lower BM25 scores = better matches
```

### 2. Efficient Count Query

```javascript
// Instead of loading all rows:
const count = (await sequelize.query(sql, { model: Project })).length;

// Use COUNT(*):
const countSql = sql.replace(/SELECT \*/i, 'SELECT COUNT(*) as count');
const countResult = await sequelize.query(countSql, { replacements });
const count = countResult[0]?.count || 0;
```

### 3. Better Query Sanitization

```javascript
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

  // Escape special FTS5 characters properly
  // FTS5 special chars: " ' * + - AND OR NOT
  // Wrap phrases in quotes, escape quotes inside
  query = query.replace(/"/g, '""'); // Escape double quotes

  // Don't force prefix matching - let users control it
  // Remove the automatic '*' suffix

  return query;
};
```

### 4. Use INSERT OR REPLACE in Triggers

```sql
CREATE TRIGGER project_update_fts AFTER UPDATE ON projects BEGIN
  INSERT OR REPLACE INTO projects_fts(
    warehouseProjectId,
    orgUid,
    -- ... all fields
  ) VALUES (
    new.warehouseProjectId,
    new.orgUid,
    -- ... all values
  );
END;
```

### 5. Fix Units UNION Query

```javascript
// Instead of ORDER BY rank after UNION (doesn't work):
sql = `${sql} ORDER BY rank DESC LIMIT :limit OFFSET :offset`;

// Use subquery with proper ranking:
sql = `
  SELECT * FROM (
    SELECT ${fields}, bm25(units_fts) as relevance
      FROM units_fts
      WHERE units_fts MATCH :search
    UNION
    SELECT ${fields}, bm25(units_fts) as relevance
      FROM units_fts
      WHERE units_fts MATCH :search2
  ) ORDER BY relevance ASC LIMIT :limit OFFSET :offset
`;
```

### 6. Add FTS Table Rebuild Utility

```javascript
static async rebuildFtsTable() {
  await sequelize.query('DELETE FROM projects_fts');
  await sequelize.query(`
    INSERT INTO projects_fts SELECT
      warehouseProjectId,
      orgUid,
      -- ... all fields
    FROM projects
  `);
}
```

### 7. V2-Specific Adaptations

- **No orgUid filtering**: Remove orgUid from FTS queries (V2 projects/units don't have it)
- **Snake_case fields**: Map V2 snake_case field names correctly
- **Relationships**: Handle V2's relationship structure (units → issuance → project)

### 8. Add Error Handling

```javascript
static async findAllSqliteFts(searchStr, orgUid, pagination) {
  try {
    // ... FTS query logic
  } catch (error) {
    if (error.message.includes('no such table: projects_fts')) {
      logger.error('FTS table missing, attempting rebuild');
      await ProjectV2.rebuildFtsTable();
      // Retry query
      return ProjectV2.findAllSqliteFts(searchStr, orgUid, pagination);
    }
    throw error;
  }
}
```

## Implementation Priority

1. **High Priority**:
   - Fix count query (performance)
   - Use BM25 ranking (better results)
   - Fix UNION rank ordering (correctness)

2. **Medium Priority**:
   - Improve query sanitization (user experience)
   - Use INSERT OR REPLACE (efficiency)
   - Add error handling (reliability)

3. **Low Priority**:
   - Add rebuild utility (maintenance)
   - Add FTS sync verification (monitoring)

