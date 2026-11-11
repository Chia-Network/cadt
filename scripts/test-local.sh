#!/usr/bin/env bash
# Local simulator tests with disposable config, logs and databases.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

case "${1:-}" in
  v1) DEFAULT_SPECS=('tests/integration/**/*.spec.js' 'tests/resources/**/*.spec.js'); DEFAULT_PORT=31310 ;;
  v2) DEFAULT_SPECS=('tests/v2/integration/**/*.spec.js'); DEFAULT_PORT=31311 ;;
  *) echo "Usage: bash scripts/test-local.sh v1|v2 [spec paths/globs ...] [Mocha options ...]" >&2; exit 2 ;;
esac
shift

# Spec paths precede options; leave Mocha's option parsing to Mocha.
SPECS=()
while [[ $# -gt 0 && "$1" != -* ]]; do
  SPECS+=("$1")
  shift
done
if [[ ${#SPECS[@]} -eq 0 ]]; then
  SPECS=("${DEFAULT_SPECS[@]}")
fi

node -e 'if (Number(process.versions.node.split(".")[0]) < 24) process.exit(1)' || {
  echo "Node >=24 is required; select the version in .nvmrc first." >&2
  exit 1
}
if [[ ! -x node_modules/.bin/mocha ]]; then
  echo "Install locked dependencies with npm ci first." >&2
  exit 1
fi

TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/cadt-local-test.XXXXXX")"
trap 'rm -rf "$TEST_ROOT"' EXIT
export CHIA_ROOT="$TEST_ROOT"
export NODE_ENV=test USE_SIMULATOR=true CW_PORT="${CW_PORT:-$DEFAULT_PORT}"
mkdir -p "$CHIA_ROOT/cadt/v1/logs" "$CHIA_ROOT/cadt/v2/logs"
cp tests/v2/config/test-config.yaml "$CHIA_ROOT/cadt/config.yaml"

bash tests/run-tests.sh ./node_modules/.bin/mocha \
  --loader node_modules/extensionless/src/register.js \
  --reporter dot --exit --timeout 300000 --fail-zero "${SPECS[@]}" "$@"
