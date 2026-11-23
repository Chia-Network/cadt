# CAR-236 Step 0: MySQL mirror project names

The registered `20261123120000-widen-project-name-v2` migration widens
`project.project_name` to `VARCHAR(500)` on MySQL-compatible V2 mirrors.
SQLite source schemas and V1/API validation are unchanged. Historical migrations
are unchanged, so the new migration runs on both existing and fresh installations.

Only the VARCHAR length changes. Existing rows, full indexes, column charset,
collation, nullability, defaults and comments are retained. Wider VARCHAR and
TEXT/MEDIUMTEXT/LONGTEXT columns are left intact. Other custom types require manual
schema review and fail explicitly. `down` is deliberately a no-op: rolling back
application code must not narrow a column containing names longer than 255.

Widening uses `ALGORITHM=INPLACE` with no COPY fallback. MariaDB can silently
convert oversized unique BTREE indexes to HASH during a COPY; this migration
rejects that path. Even safe configurations that require COPY (for example,
latin1 VARCHAR(255) to VARCHAR(500), changing the byte-length prefix) fail intact
and require manual review. The normal utf8mb4/DYNAMIC schema is tested.

## Verification

The database-only suite uses a disposable server and creates/drops only its own
random `cadt_project_name_test_<uuid>` database. It never reads CADT connection
configuration. Supply `CADT_MIGRATION_TEST_HOST`, `CADT_MIGRATION_TEST_USER`,
`CADT_MIGRATION_TEST_PASSWORD` and optionally `CADT_MIGRATION_TEST_PORT`, then run:

```bash
npm run test:v2:database:project-name-width
```

The account needs database create/drop and table privileges for that test prefix.
Each pool connection uses strict SQL mode. Tests cover legacy rejection, Unicode
and the 500-character boundary, updates, data/index/attribute preservation,
idempotence, safe rollback and a real index-limit ALTER failure. SQLite no-op and
mirror metadata tests run with the normal V2 integration suite. CI runs the
database-only suite after the existing delayed MariaDB restart, preserving the
mirror down-start race and adding no blockchain commit cycles.

### Local checkpoint: November 23, 2026

MariaDB 10.11.19 (16 KB pages, DYNAMIC) passed all 15 database tests, both as root
and as a limited account using the CI database-prefix grant. SQLite/metadata
passed 3 tests, affected mirror regressions passed 115, and full V2 passed 2,000
with 5 existing pending cases. The parent regression runs used the pre-existing
external listener-family adapter to match the test client's IPv6 listener; all
1,211 requests matched, with no port mismatches. No permanent test harness change
was made. Native MySQL and the actual deployment have not been validated.

Intended red evidence preceded implementation: the old mirror model declared
255, and real strict-mode inserts rejected 256/500-character names with
`ER_DATA_TOO_LONG` while retaining the existing row. A later failing test exposed
MariaDB's silent unique BTREE-to-HASH conversion and led to the INPLACE-only
guard. One database invocation failed before tests with `ECONNREFUSED` while
Docker was closed; the restarted server passed. Complete logs and exit statuses
are retained under `/private/tmp/car236-step0/`. Lint, formatting, JSON/YAML,
emitted CI grant, workflow step order, shell syntax and whitespace checks passed.

## Deployment and recovery limits

Before deployment, inspect the actual source field values and remaining mirror
constraints; that collection is still pending. Verify `SHOW CREATE TABLE project`
and `SHOW INDEX FROM project` on the intended mirror. A 500-character utf8mb4
column requires up to 2,000 index bytes; additional indexed columns and engine
limits can make an otherwise valid widening fail. An ALTER error must be
investigated without shortening indexes or changing charset/row format silently.

After startup, verify the column and full indexes directly; existing setup error
handling can report readiness after a migration failure. This step does not fix
that behavior or add recovery machinery. Existing restart/backfill normally runs
when row counts are missing; equal-count stale values are not guaranteed to be
recopied. Successful widening supports names through 500 characters within the
existing charset; it does not repair every rejected row, support longer values,
or correct unrelated sector/type constraints. No production migration or
deployment has been performed as part of this implementation.
