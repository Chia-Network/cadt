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

@test "normalize_apt_version converts -rc to ~rc for Debian" {
  [[ "$(normalize_apt_version "2.7.1-rc2")" == "2.7.1~rc2" ]]
  [[ "$(normalize_apt_version "1.7.26-rc28")" == "1.7.26~rc28" ]]
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

@test "strip_url_scheme removes http prefix" {
  [[ "$(strip_url_scheme "http://example.com")" == "example.com" ]]
}

@test "strip_url_scheme removes https prefix" {
  [[ "$(strip_url_scheme "https://example.com")" == "example.com" ]]
}

@test "strip_url_scheme removes trailing slash" {
  [[ "$(strip_url_scheme "https://example.com/")" == "example.com" ]]
}

@test "strip_url_scheme passes through bare domain" {
  [[ "$(strip_url_scheme "example.com")" == "example.com" ]]
}

@test "strip_url_scheme passes through IP address" {
  [[ "$(strip_url_scheme "203.0.113.10")" == "203.0.113.10" ]]
}

@test "is_domain identifies domains correctly" {
  is_domain "example.com"
  is_domain "cadt.chia.net"
  ! is_domain "203.0.113.10"
  ! is_domain "::1"
}

@test "validate_public_address accepts valid domains and IPs" {
  validate_public_address "example.com"
  validate_public_address "cadt.chia.net"
  validate_public_address "203.0.113.10"
  validate_public_address "my-server.example.org"
  ! validate_public_address ""
  ! validate_public_address "has spaces.com"
}

@test "build_datalayer_url produces http URL with /data path" {
  PUBLIC_ADDRESS="203.0.113.10"
  ENABLE_HTTPS=false
  build_datalayer_url
  [[ "$DATALAYER_URL" == "http://203.0.113.10/data" ]]
}

@test "build_datalayer_url produces https URL when HTTPS enabled" {
  PUBLIC_ADDRESS="cadt.example.com"
  ENABLE_HTTPS=true
  build_datalayer_url
  [[ "$DATALAYER_URL" == "https://cadt.example.com/data" ]]
}

@test "build_public_url produces correct scheme" {
  PUBLIC_ADDRESS="cadt.example.com"
  ENABLE_HTTPS=false
  build_public_url
  [[ "$PUBLIC_URL" == "http://cadt.example.com" ]]

  ENABLE_HTTPS=true
  build_public_url
  [[ "$PUBLIC_URL" == "https://cadt.example.com" ]]
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
  CHIA_APT_VER="2.7.1~rc2"
  TOOLS_APT_VER="1.2.3"
  CADT_APT_VER="1.7.26~rc28"

  run validate_supported_apt_versions

  [[ "$status" -ne 0 ]]
  [[ "$output" == *"chia-blockchain-cli prerelease apt packages are not supported"* ]]
}

@test "validate_supported_apt_versions allows CADT prereleases" {
  CHIA_APT_VER="2.7.1"
  TOOLS_APT_VER="1.2.3"
  CADT_APT_VER="1.7.26~rc28"

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
  KEY_MODE=""
  READ_ONLY=""
  CADT_API_KEY=""

  apply_config_defaults

  [[ "$KEY_MODE" == "generate" ]]
  [[ "$READ_ONLY" == "false" ]]
  [[ -n "$CADT_API_KEY" ]]
}

@test "apply_config_defaults skips API key generation in read-only mode" {
  KEY_MODE=""
  READ_ONLY="true"
  CADT_API_KEY=""

  apply_config_defaults

  [[ -z "$CADT_API_KEY" ]]
}

@test "apply_config_defaults preserves explicit API key" {
  KEY_MODE=""
  READ_ONLY=""
  CADT_API_KEY="user-provided-key"

  apply_config_defaults

  [[ "$CADT_API_KEY" == "user-provided-key" ]]
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
  DATALAYER_URL="http://127.0.0.1/data"
  READ_ONLY=false
  CADT_API_KEY="abc'\\def"

  patch_cadt_config

  [[ "$(cat "${BATS_TEST_TMPDIR}/api_key")" == "$CADT_API_KEY" ]]
}

@test "parse_args sets network, public-address, and flags" {
  NETWORK=""
  CHIA_VERSION_CHOICE=""
  PUBLIC_ADDRESS=""
  LOCAL_ONLY=false
  ENABLE_HTTPS=false
  CERTBOT_DRY_RUN=false
  parse_args \
    --network=testneta \
    --chia-version=stable \
    --public-address=127.0.0.1 \
    --generate-key \
    --yes \
    --min-disk-gb=10
  [[ "$NETWORK" == "testneta" ]]
  [[ "$CHIA_VERSION_CHOICE" == "stable" ]]
  [[ "$PUBLIC_ADDRESS" == "127.0.0.1" ]]
  [[ "$KEY_MODE" == "generate" ]]
  [[ "$ASSUME_YES" == true ]]
  [[ "$MIN_DISK_GIB" == "10" ]]
}

@test "parse_args strips URL scheme from --public-address" {
  PUBLIC_ADDRESS=""
  parse_args --public-address=https://cadt.example.com/
  [[ "$PUBLIC_ADDRESS" == "cadt.example.com" ]]
}

@test "parse_args handles --local-only and --https flags" {
  LOCAL_ONLY=false
  ENABLE_HTTPS=false
  CERTBOT_DRY_RUN=false
  PUBLIC_ADDRESS=""
  parse_args --public-address=example.com --local-only --https --certbot-dry-run
  [[ "$LOCAL_ONLY" == true ]]
  [[ "$ENABLE_HTTPS" == true ]]
  [[ "$CERTBOT_DRY_RUN" == true ]]
  [[ "$PUBLIC_ADDRESS" == "example.com" ]]
}

@test "is_ipv4 recognizes dotted quads" {
  is_ipv4 "192.168.1.1"
  ! is_ipv4 "not-an-ip"
}
