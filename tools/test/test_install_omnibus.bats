#!/usr/bin/env bats

setup() {
  export INSTALL_OMNIBUS_LIB_ONLY=1
  # shellcheck source=/dev/null
  source "${BATS_TEST_DIRNAME}/../install-omnibus.sh"
}

wait_for_pid_exit() {
  local pid="$1"
  for _ in {1..20}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    sleep 0.05
  done
  return 1
}

@test "normalize_apt_version leaves release candidate tags unchanged" {
  [[ "$(normalize_apt_version "2.7.1-rc2")" == "2.7.1-rc2" ]]
  [[ "$(normalize_apt_version "1.7.26-rc28")" == "1.7.26-rc28" ]]
}

@test "normalize_apt_version leaves stable tags unchanged" {
  [[ "$(normalize_apt_version "2.7.0")" == "2.7.0" ]]
}

@test "denormalize_tag_from_apt converts ~rc to -rc" {
  [[ "$(denormalize_tag_from_apt "2.7.1~rc2")" == "2.7.1-rc2" ]]
}

@test "pick_release_from_json stable returns first non-prerelease" {
  local fixture="${BATS_TEST_DIRNAME}/fixtures/chia-releases.json"
  local tag
  tag=$(pick_release_from_json "$fixture" stable)
  [[ -n "$tag" ]]
  run jq -r --arg t "$tag" '.[] | select(.tag_name == $t) | .prerelease' "$fixture"
  [[ "$output" == "false" ]]
}

@test "pick_release_from_json prerelease returns first prerelease" {
  local fixture="${BATS_TEST_DIRNAME}/fixtures/cadt-releases.json"
  local tag
  tag=$(pick_release_from_json "$fixture" prerelease)
  [[ -n "$tag" ]]
  run jq -r --arg t "$tag" '.[] | select(.tag_name == $t) | .prerelease' "$fixture"
  [[ "$output" == "true" ]]
}

@test "pick_release_from_json index returns numbered release" {
  local fixture="${BATS_TEST_DIRNAME}/fixtures/chia-releases.json"
  local tag
  tag=$(pick_release_from_json "$fixture" 1)
  [[ -n "$tag" ]]
}

@test "validate_datalayer_host sets WARN_DNS for hostname" {
  WARN_DNS=0
  validate_datalayer_host "datalayer.example.com"
  [[ "$WARN_DNS" -eq 1 ]]
}

@test "validate_datalayer_host does not warn for IPv4" {
  WARN_DNS=0
  validate_datalayer_host "203.0.113.10"
  [[ "$WARN_DNS" -eq 0 ]]
}

@test "meets_min_specs passes for adequate hardware" {
  meets_min_specs 8 $((10 * 1024 * 1024)) 500 300
}

@test "meets_min_specs fails for low disk" {
  ! meets_min_specs 8 $((10 * 1024 * 1024)) 50 300
}

@test "soft spec shortfall requires every metric to be close" {
  is_soft_spec_shortfall 3 $((7 * 1024 * 1024)) 270 270
  ! is_soft_spec_shortfall 8 $((10 * 1024 * 1024)) 50 300
  ! is_soft_spec_shortfall 8 $((10 * 1024 * 1024)) 300 50
}

@test "validate_network rejects unsupported network names" {
  validate_network mainnet
  validate_network testneta

  run validate_network testnet
  [[ "$status" -ne 0 ]]
  [[ "$output" == *"Invalid network: testnet"* ]]
}

@test "validate_supported_apt_versions rejects unsupported Chia prereleases" {
  CHIA_APT_VER="2.7.1-rc2"
  TOOLS_APT_VER="1.2.3"
  CADT_APT_VER="1.7.26-rc28"

  run validate_supported_apt_versions

  [[ "$status" -ne 0 ]]
  [[ "$output" == *"chia-blockchain-cli prerelease apt packages are not supported"* ]]
}

@test "validate_supported_apt_versions allows CADT prereleases" {
  CHIA_APT_VER="2.7.1"
  TOOLS_APT_VER="1.2.3"
  CADT_APT_VER="1.7.26-rc28"

  validate_supported_apt_versions
}

@test "cadt_health_curl_args includes API key header only when configured" {
  local args

  CADT_API_KEY=""
  cadt_health_curl_args args
  [[ "${args[*]}" == "-fsS http://localhost:31310/v1/health" ]]

  CADT_API_KEY="secret-key"
  cadt_health_curl_args args
  [[ "${args[*]}" == "-fsS -H x-api-key: secret-key http://localhost:31310/v1/health" ]]
}

@test "apply_config_defaults sets optional non-interactive defaults" {
  DATALAYER_PORT=""
  KEY_MODE=""
  READ_ONLY=""

  apply_config_defaults

  [[ "$DATALAYER_PORT" == "80" ]]
  [[ "$KEY_MODE" == "generate" ]]
  [[ "$READ_ONLY" == "false" ]]
}

@test "is_dpkg_package_installed detects installed dpkg rows" {
  local bin="${BATS_TEST_TMPDIR}/bin"
  mkdir -p "$bin"
  cat >"${bin}/dpkg" <<'EOF'
#!/usr/bin/env bash
case "$2" in
  cadt)
    echo "ii  cadt 1.2.3 amd64 CADT"
    ;;
  *)
    echo "un  $2 <none> <none>"
    ;;
esac
EOF
  chmod +x "${bin}/dpkg"

  PATH="${bin}:$PATH"

  is_dpkg_package_installed cadt
  ! is_dpkg_package_installed chia-tools
}

@test "normalize_mnemonic_file converts all whitespace to single spaces" {
  local mnemonic_file="${BATS_TEST_TMPDIR}/mnemonic.txt"
  printf 'word1\nword2\r\nword3\tword4   word5\n' >"$mnemonic_file"

  [[ "$(normalize_mnemonic_file "$mnemonic_file")" == "word1 word2 word3 word4 word5" ]]
}

@test "cleanup_background_processes stops tracked background pids" {
  sleep 60 &
  local spinner_pid=$!
  sleep 60 &
  local keepalive_pid=$!
  SPINNER_PID="$spinner_pid"
  SUDO_KEEPALIVE_PID="$keepalive_pid"

  cleanup_background_processes

  [[ -z "$SPINNER_PID" ]]
  [[ -z "$SUDO_KEEPALIVE_PID" ]]
  wait_for_pid_exit "$spinner_pid"
  wait_for_pid_exit "$keepalive_pid"
  wait "$spinner_pid" 2>/dev/null || true
  wait "$keepalive_pid" 2>/dev/null || true
}

@test "die cleans up tracked background pids before exiting" {
  sleep 60 &
  local spinner_pid=$!
  sleep 60 &
  local keepalive_pid=$!
  SPINNER_PID="$spinner_pid"
  SUDO_KEEPALIVE_PID="$keepalive_pid"

  run die "boom"

  [[ "$status" -eq 1 ]]
  [[ "$output" == *"ERROR:"*"boom"* ]]
  wait_for_pid_exit "$spinner_pid"
  wait_for_pid_exit "$keepalive_pid"
  wait "$spinner_pid" 2>/dev/null || true
  wait "$keepalive_pid" 2>/dev/null || true
}

@test "private output can render escapes without transforming literals" {
  local private_file="${BATS_TEST_TMPDIR}/private-output.txt"
  exec 9>"$private_file"
  PRIVATE_FD=9

  private_echo '\033[31mred\033[0m'
  private_literal 'abc\ndef'
  exec 9>&-

  run sed -n '1p' "$private_file"
  [[ "$output" == $'\033[31mred\033[0m' ]]
  run sed -n '2p' "$private_file"
  [[ "$output" == 'abc\ndef' ]]
}

@test "patch_cadt_config passes quoted api key without Python interpolation" {
  local bin="${BATS_TEST_TMPDIR}/bin"
  mkdir -p "$bin"
  cat >"${bin}/python3" <<EOF
#!/usr/bin/env bash
if [[ "\${1:-}" == "-c" ]]; then
  exit 0
fi
printf '%s' "\${CADT_API_KEY_VALUE}" >"${BATS_TEST_TMPDIR}/api_key"
exit 0
EOF
  chmod +x "${bin}/python3"

  PATH="${bin}:$PATH"
  NETWORK=mainnet
  DATALAYER_URL="http://127.0.0.1"
  READ_ONLY=false
  CADT_API_KEY="abc'\\def"

  patch_cadt_config

  [[ "$(cat "${BATS_TEST_TMPDIR}/api_key")" == "$CADT_API_KEY" ]]
}

@test "parse_args sets network and versions" {
  NETWORK=""
  CHIA_VERSION_CHOICE=""
  parse_args \
    --network=testneta \
    --chia-version=stable \
    --datalayer-host=127.0.0.1 \
    --datalayer-port=8080 \
    --generate-key \
    --yes \
    --min-disk-gb=10
  [[ "$NETWORK" == "testneta" ]]
  [[ "$CHIA_VERSION_CHOICE" == "stable" ]]
  [[ "$DATALAYER_HOST" == "127.0.0.1" ]]
  [[ "$DATALAYER_PORT" == "8080" ]]
  [[ "$KEY_MODE" == "generate" ]]
  [[ "$ASSUME_YES" == true ]]
  [[ "$MIN_DISK_GIB" == "10" ]]
}

@test "is_ipv4 recognizes dotted quads" {
  is_ipv4 "192.168.1.1"
  ! is_ipv4 "not-an-ip"
}
