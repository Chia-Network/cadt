#!/usr/bin/env bash
# Focused simulator baselines for CAR-229, with disposable config and logs.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

MODE="${1:-all}"
case "$MODE" in
  all|redaction|delete|planner|preview|confirmation|guards|regression|xls|crud|v1|v2) ;;
  *) echo "Usage: bash scripts/test-car-229.sh [all|redaction|delete|planner|preview|confirmation|guards|regression|xls|crud|v1|v2]" >&2; exit 2 ;;
esac

node -e 'if (Number(process.versions.node.split(".")[0]) < 24) process.exit(1)' || {
  echo "Node >=24 is required; select the version in .nvmrc first." >&2
  exit 1
}
if [[ ! -x node_modules/.bin/mocha ]]; then
  echo "Install locked dependencies with npm ci first." >&2
  exit 1
fi

CAR229_TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/cadt-car229.XXXXXX")"
trap 'rm -rf "$CAR229_TEST_ROOT"' EXIT
export CHIA_ROOT="$CAR229_TEST_ROOT"
export NODE_ENV=test USE_SIMULATOR=true CW_PORT="${CAR229_TEST_PORT:-31319}"
mkdir -p "$CHIA_ROOT/cadt/v1/logs" "$CHIA_ROOT/cadt/v2/logs"
cp tests/v2/config/test-config.yaml "$CHIA_ROOT/cadt/config.yaml"

run_specs() {
  local selection=()
  if [[ -n "${CAR229_TEST_GREP:-}" ]]; then
    selection+=(--grep "$CAR229_TEST_GREP")
  fi
  bash tests/run-tests.sh ./node_modules/.bin/mocha \
    --loader node_modules/extensionless/src/register.js \
    --reporter "${CAR229_TEST_REPORTER:-dot}" --exit --timeout 300000 --fail-zero "$@" "${selection[@]}"
}

# Keep V1 server imports in a separate process from the V2 suites.
if [[ "$MODE" == all || "$MODE" == redaction ]]; then
  run_specs tests/integration/log-redaction.spec.js
fi
if [[ "$MODE" == all || "$MODE" == preview ]]; then
  run_specs tests/v2/integration/delete-preview*.spec.js
fi
if [[ "$MODE" == all || "$MODE" == confirmation ]]; then
  run_specs tests/v2/integration/delete-confirmation*.spec.js tests/v2/integration/delete-preview-token.spec.js
fi
if [[ "$MODE" == all || "$MODE" == planner ]]; then
  run_specs tests/v2/integration/cascade-delete-planner.spec.js
fi
if [[ "$MODE" == all || "$MODE" == delete ]]; then
  run_specs tests/v2/integration/{project,verification,issuance,unit}-v2.spec.js \
    --grep DELETE
fi
if [[ "$MODE" == all || "$MODE" == guards ]]; then
  run_specs tests/v2/integration/v2-data-assertions.spec.js
  run_specs tests/v2/integration/{methodology,program,stakeholder,label,project-methodology,location,validation}-v2.spec.js --grep DELETE
fi
if [[ "$MODE" == all || "$MODE" == regression ]]; then
  run_specs tests/v2/integration/staging-v2.spec.js \
    tests/v2/integration/v2-staging-validation.spec.js \
    tests/v2/integration/read-only-enforcement.spec.js \
    --grep 'Read Endpoints|Additional Endpoints|V1/V2 Isolation|validateStagedRecord|CSV batch upload parity|assertChangeListNotNullCompleteness|READ_ONLY enforcement'
fi
if [[ "$MODE" == all || "$MODE" == xls ]]; then
  run_specs tests/v2/integration/v2-xls.spec.js
fi

if [[ "$MODE" == crud ]]; then
  run_specs tests/v2/integration/{project,verification,issuance,unit}-v2.spec.js
fi
if [[ "$MODE" == v2 ]]; then
  npm run test:v2
fi
if [[ "$MODE" == v1 ]]; then
  run_specs tests/integration/{project,unit}.spec.js
fi
