# CAR-236 Step 0: MySQL mirror project fields

The registered `20261123120000-widen-project-fields-v2` migration widens
`project.project_name` to `VARCHAR(500)` and `project_sector`/`project_type` to
`VARCHAR(768)` on MySQL-compatible V2 mirrors.
SQLite source schemas and V1/API validation are unchanged. Historical migrations
are unchanged, so the new migration runs on both existing and fresh installations.

Only the VARCHAR length changes. Existing rows, full indexes, column charset,
collation, nullability, defaults and comments are retained. Wider VARCHAR and
TEXT/MEDIUMTEXT/LONGTEXT columns are left intact. Other custom types require manual
schema review and fail explicitly. `down` is deliberately a no-op: rolling back
application code must not narrow columns containing values longer than 255.
All three definitions are validated before one ALTER TABLE changes the required
columns together; one unsafe field leaves the entire table unchanged.

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
npm run test:v2:database:project-fields-width
```

The account needs database create/drop and table privileges for that test prefix.
Each pool connection uses strict SQL mode. Tests cover legacy rejection of full
bundled sector/type arrays, Unicode and exact 500/768-character boundaries,
updates, data/index/attribute preservation, mixed already-wide columns,
idempotence, safe rollback and genuine unsafe ALTER failures. SQLite no-op and
mirror metadata tests run with the normal V2 integration suite. CI runs the
database-only suite after the existing delayed MariaDB restart, preserving the
mirror down-start race and adding no blockchain commit cycles.

### Initial name-only checkpoint: November 23, 2026

MariaDB 10.11.19 (16 KB pages, DYNAMIC) passed all 15 database tests, both as root
and as a limited account using the CI database-prefix grant. SQLite/metadata
passed 3 tests, affected mirror regressions passed 115, and full V2 passed 2,000
with 5 existing pending cases. The parent regression runs used the pre-existing
external listener-family adapter to match the test client's IPv6 listener; all
1,211 requests matched, with no port mismatches. No permanent test harness change
was made. At this initial checkpoint, native MySQL and the actual deployment had
not been validated.

Intended red evidence preceded implementation: the old mirror model declared
255, and real strict-mode inserts rejected 256/500-character names with
`ER_DATA_TOO_LONG` while retaining the existing row. A later failing test exposed
MariaDB's silent unique BTREE-to-HASH conversion and led to the INPLACE-only
guard. One database invocation failed before tests with `ECONNREFUSED` while
Docker was closed; the restarted server passed. Complete logs and exit statuses
are retained under `/private/tmp/car236-step0/`. Lint, formatting, JSON/YAML,
emitted CI grant, workflow step order, shell syntax and whitespace checks passed.

The expanded tests first ran against the name-only implementation: strict-mode
inserts of the complete bundled sector/type arrays still failed after migration,
and mirror metadata remained VARCHAR(255)/TEXT. Expanded-scope evidence is under
`/private/tmp/car236-step0/three-fields/`.

### Expanded three-field checkpoint: November 23, 2026

All 19 database tests passed on disposable MariaDB 10.11.19 and native MySQL
8.4.13, including full 768-character utf8mb4 indexes and Unicode roundtrips.
SQLite/metadata passed 5 tests, affected mirror regressions passed 117, and full
V2 passed 2,002 with 5 existing pending cases. The same external listener adapter
matched all 1,211 intended IPv6 requests with no port mismatches.

Native MySQL exposed redundant charset display in SHOW CREATE TABLE and distinct
index-limit error codes. Tests now normalize only a target VARCHAR's redundant
utf8mb4 charset token when its matching collation is explicit, and expect exact
engine-specific errors. Failure/idempotence snapshots retain raw DDL. No
production change was needed for these engine differences. Read-only deployment
metadata and mirror profiles were collected; actual deployment DDL and recovery
remain unexecuted.

## Deployment and recovery limits

Read-only inspection of the intended target found utf8mb4, InnoDB DYNAMIC and
16 KB pages; each full 768-character index can use its 3,072-byte key limit.
Current mirrored maxima were 181 sector / 178 type characters. The complete
distinct bundled selections serialize to 581 / 508 characters respectively.
These observations support this pragmatic stopgap, not a full input-parity claim.
Arrays have no item-count limit and permit duplicates; JSON requests allow 5 MiB,
file uploads 25 MiB, and observer ingestion bypasses these HTTP entry limits.
Valid incoming serialized arrays can therefore still exceed 768 characters. No
input cap, deduplication or truncation is added.

Before deployment, verify `SHOW CREATE TABLE project`, `SHOW INDEX FROM project`,
actual source values and remaining constraints. Additional indexed columns or
other engine/page configurations can make widening fail. An ALTER error must be
investigated without silently changing indexes, charset or row format.

After startup, verify the column and full indexes directly; existing setup error
handling can report readiness after a migration failure. This step does not fix
that behavior or add recovery machinery. Existing restart/backfill normally runs
when row counts are missing; equal-count stale values are not guaranteed to be
recopied. Successful widening supports names through 500 and serialized
sector/type values through 768 characters within the existing charset; it does
not repair every rejected row or support longer values. No production migration or
deployment has been performed as part of this implementation.
