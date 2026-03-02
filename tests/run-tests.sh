#!/usr/bin/env bash
#
# Test runner wrapper that provides isolated test databases.
#
# Features:
# - Generates a unique TEST_RUN_ID (epoch seconds) for each run
# - Creates test database directory (tests/test-dbs/)
# - Cleans up stale databases from interrupted runs (>24 hours old)
# - Cleans up this run's databases on exit (success, failure, or interrupt)
#
# Usage: tests/run-tests.sh <command> [args...]
# Example: tests/run-tests.sh npx cross-env NODE_ENV=test mocha ...

set -euo pipefail

# Resolve repo root (parent of the directory containing this script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_DB_DIR="$REPO_ROOT/tests/test-dbs"

# Generate unique run ID.
# Prefer epoch nanoseconds when supported (GNU date), and fall back to
# epoch seconds + random suffix for BSD/macOS portability.
RUN_EPOCH_SECONDS=$(date +%s)
RUN_NANOSECONDS=$(date +%N 2>/dev/null || true)
if [[ "$RUN_NANOSECONDS" =~ ^[0-9]+$ ]]; then
    export TEST_RUN_ID="${RUN_EPOCH_SECONDS}${RUN_NANOSECONDS}"
else
    export TEST_RUN_ID="${RUN_EPOCH_SECONDS}${RANDOM}"
fi
echo "[test-runner] TEST_RUN_ID=$TEST_RUN_ID"
echo "[test-runner] Database directory: $TEST_DB_DIR"

# Ensure test database directory exists
mkdir -p "$TEST_DB_DIR"

# Clean stale databases (>24 hours old based on filename timestamp)
NOW=$(date +%s)
STALE_THRESHOLD=86400  # 24 hours in seconds
STALE_COUNT=0

for f in "$TEST_DB_DIR"/*.sqlite3*; do
    [ -f "$f" ] || continue
    BASENAME=$(basename "$f")
    # Extract run ID: strip .sqlite3* suffix, then grab the number after the last dash
    # e.g., "test-v2-1739097600.sqlite3-wal" -> "1739097600"
    STRIPPED=${BASENAME%%.sqlite3*}
    FILE_TS=${STRIPPED##*-}
    # Only process if it looks like a valid epoch timestamp (10+ digits)
    if [[ "$FILE_TS" =~ ^[0-9]{10,}$ ]]; then
        # Normalize to epoch seconds (nanosecond IDs are 19 digits)
        if [ ${#FILE_TS} -gt 10 ]; then
            FILE_TS_SEC=${FILE_TS:0:10}
        else
            FILE_TS_SEC=$FILE_TS
        fi
        AGE=$((NOW - FILE_TS_SEC))
        if [ "$AGE" -gt "$STALE_THRESHOLD" ]; then
            rm -f "$f"
            STALE_COUNT=$((STALE_COUNT + 1))
        fi
    fi
done

if [ "$STALE_COUNT" -gt 0 ]; then
    echo "[test-runner] Cleaned up $STALE_COUNT stale database file(s) (>24h old)"
fi

# Set up cleanup trap - runs on exit regardless of success/failure/interrupt
cleanup() {
    if [ -n "${TEST_RUN_ID:-}" ]; then
        local CLEANED=0
        for f in "$TEST_DB_DIR"/*-"${TEST_RUN_ID}".sqlite3*; do
            [ -f "$f" ] || continue
            rm -f "$f"
            CLEANED=$((CLEANED + 1))
        done
        if [ "$CLEANED" -gt 0 ]; then
            echo "[test-runner] Cleaned up $CLEANED database file(s) for run $TEST_RUN_ID"
        fi
    fi
}
trap cleanup EXIT

# Run the actual test command (all arguments passed through)
echo "[test-runner] Running: $*"
"$@"
