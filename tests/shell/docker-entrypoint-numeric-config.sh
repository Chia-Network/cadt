#!/bin/bash
#
# Exercises docker-entrypoint.sh's config writers against a throwaway config
# file and prints the result to stdout for the caller to assert on.
#
# Standalone use:
#   bash tests/shell/docker-entrypoint-numeric-config.sh
#
# Requires mikefarah yq v4 (the version the Docker image installs).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

cat > "$TMP_DIR/config.yaml" << 'EOF'
APP:
  DEFAULT_FEE: 3000
  DEFAULT_COIN_AMOUNT: 300
  CHIA_NETWORK: mainnet
  USE_SIMULATOR: false
  CERTIFICATE_FOLDER_PATH: /some/path
V1:
  CADT_API_KEY: placeholder
  GOVERNANCE:
    GOVERNANCE_BODY_ID: placeholder
EOF

# Load the helper functions without running the container startup steps.
export CADT_ENTRYPOINT_FUNCTIONS_ONLY=1
# shellcheck source=/dev/null
source "$REPO_ROOT/docker-entrypoint.sh"

# The helpers read UNIFIED_CONFIG_PATH at call time, so point them at the
# temporary file rather than /root/.chia.
# shellcheck disable=SC2034  # read by the functions sourced above
UNIFIED_CONFIG_PATH="$TMP_DIR/config.yaml"

export DEFAULT_FEE=300
export DEFAULT_COIN_AMOUNT=300
export CHIA_NETWORK=testnet
export USE_SIMULATOR=true
export CERTIFICATE_FOLDER_PATH=
# Digit-only values on non-numeric keys must keep their quotes.
export V1_CADT_API_KEY=12345678
export V1_GOVERNANCE_BODY_ID=99999999

update_numeric_app_config "DEFAULT_FEE" '.DEFAULT_FEE'
update_numeric_app_config "DEFAULT_COIN_AMOUNT" '.DEFAULT_COIN_AMOUNT'
update_app_config "CHIA_NETWORK" '.CHIA_NETWORK'
update_app_config "USE_SIMULATOR" '.USE_SIMULATOR'
update_app_config "CERTIFICATE_FOLDER_PATH" '.CERTIFICATE_FOLDER_PATH'
update_v1_config "V1_CADT_API_KEY" '.CADT_API_KEY'
update_v1_config "V1_GOVERNANCE_BODY_ID" '.GOVERNANCE.GOVERNANCE_BODY_ID'

cat "$TMP_DIR/config.yaml"
