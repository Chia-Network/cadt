#!/usr/bin/env bash
# Lint tools/install-omnibus.sh (shellcheck, bash -n, shfmt)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="${ROOT}/install-omnibus.sh"

echo "==> bash -n"
bash -n "$SCRIPT"

echo "==> shellcheck"
if command -v shellcheck >/dev/null 2>&1; then
  shellcheck -x "$SCRIPT"
else
  echo "shellcheck not installed; skipping (install with: sudo apt-get install shellcheck)"
fi

echo "==> shfmt"
if command -v shfmt >/dev/null 2>&1; then
  shfmt -d -i 2 -ci "$SCRIPT"
else
  echo "shfmt not installed; skipping"
fi

echo "All lint checks passed."
