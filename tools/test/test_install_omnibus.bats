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

@test "pick_release_from_json stable returns the first non-prerelease tag exactly" {
  # Assert exact tag so a future jq/order regression can't pass with any
  # non-empty string. chia-releases.json puts RCs before 2.7.0, so stable
  # must skip them and land on 2.7.0.
  local fixture="${BATS_TEST_DIRNAME}/fixtures/chia-releases.json"
  local tag
  tag=$(pick_release_from_json "$fixture" stable)
  [[ "$tag" == "2.7.0" ]]
}

@test "pick_release_from_json prerelease returns the newest prerelease exactly" {
  local fixture="${BATS_TEST_DIRNAME}/fixtures/cadt-releases.json"
  local tag
  tag=$(pick_release_from_json "$fixture" prerelease)
  [[ "$tag" == "1.7.26-rc28" ]]
}

@test "pick_release_from_json index 1 returns the first non-draft release exactly" {
  local fixture="${BATS_TEST_DIRNAME}/fixtures/chia-releases.json"
  local tag
  tag=$(pick_release_from_json "$fixture" 1)
  [[ "$tag" == "2.7.1-rc2" ]]
}

@test "pick_release_from_json index out of range returns empty" {
  local fixture="${BATS_TEST_DIRNAME}/fixtures/chia-releases.json"
  local tag
  tag=$(pick_release_from_json "$fixture" 99)
  [[ -z "$tag" ]]
}

@test "pick_release_from_json stable returns empty when no stable releases exist" {
  # cadt-releases.json is all prereleases — stable mode must yield empty.
  local fixture="${BATS_TEST_DIRNAME}/fixtures/cadt-releases.json"
  local tag
  tag=$(pick_release_from_json "$fixture" stable)
  [[ -z "$tag" ]]
}

@test "pick_release_from_json on missing file returns non-zero" {
  run pick_release_from_json /nonexistent/path.json stable
  [[ "$status" -ne 0 ]]
}

@test "pick_release_from_json on empty array returns empty" {
  local empty="${BATS_TEST_TMPDIR}/empty.json"
  printf '[]\n' >"$empty"
  local tag
  tag=$(pick_release_from_json "$empty" stable)
  [[ -z "$tag" ]]
}

@test "resolve_version_choice stable maps to first non-prerelease tag" {
  local fixture="${BATS_TEST_DIRNAME}/fixtures/chia-releases.json"
  local got
  resolve_version_choice stable "$fixture" got
  [[ "$got" == "2.7.0" ]]
}

@test "resolve_version_choice passes explicit tags through unchanged" {
  local fixture="${BATS_TEST_DIRNAME}/fixtures/chia-releases.json"
  local got
  resolve_version_choice "9.9.9" "$fixture" got
  [[ "$got" == "9.9.9" ]]
}

@test "resolve_version_choice dies when no release matches the choice" {
  local fixture="${BATS_TEST_DIRNAME}/fixtures/cadt-releases.json"
  local got
  # 'stable' over an all-prerelease list produces an empty pick → die.
  run resolve_version_choice stable "$fixture" got
  [[ "$status" -ne 0 ]]
  [[ "$output" == *"Could not resolve version"* ]]
}

@test "resolve_version_choice resolves the 'latest' alias the same as 'stable'" {
  local fixture="${BATS_TEST_DIRNAME}/fixtures/chia-releases.json"
  local got
  resolve_version_choice latest "$fixture" got
  [[ "$got" == "2.7.0" ]]
}

@test "resolve_version_choice resolves rc and pre-release aliases" {
  local fixture="${BATS_TEST_DIRNAME}/fixtures/cadt-releases.json"
  local a b
  resolve_version_choice prerelease "$fixture" a
  resolve_version_choice rc "$fixture" b
  [[ "$a" == "1.7.26-rc28" && "$b" == "1.7.26-rc28" ]]
}

@test "resolve_version_choice stable picks chia-tools 1.3.9 from its fixture" {
  # Wire the otherwise unused chia-tools fixture; protects against drift if
  # chia-tools fixture format ever diverges from chia/cadt fixtures.
  local fixture="${BATS_TEST_DIRNAME}/fixtures/chia-tools-releases.json"
  local got
  resolve_version_choice stable "$fixture" got
  [[ "$got" == "1.3.9" ]]
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

@test "validate_supported_apt_versions rejects chia-tools prereleases" {
  # Mirror of the chia-blockchain-cli RC rejection; copy-paste error in the
  # second guard would otherwise leave tools RC installs silently allowed.
  CHIA_APT_VER="2.7.1"
  TOOLS_APT_VER="1.2.3-rc1"
  CADT_APT_VER="1.7.26"

  run validate_supported_apt_versions
  [[ "$status" -ne 0 ]]
  [[ "$output" == *"chia-tools prerelease apt packages are not supported"* ]]
}

@test "verify_apt_package_version succeeds when madison lists the version" {
  local bin="${BATS_TEST_TMPDIR}/bin"
  mkdir -p "$bin"
  cat >"${bin}/apt-cache" <<'EOF'
#!/usr/bin/env bash
# Mimic apt-cache madison output: pkg | version | source
echo "  cadt | 1.7.26 | https://repo.chia.net cadt/main amd64 Packages"
EOF
  chmod +x "${bin}/apt-cache"
  PATH="${bin}:$PATH"

  verify_apt_package_version cadt "1.7.26"
}

@test "verify_apt_package_version dies when version not in madison" {
  local bin="${BATS_TEST_TMPDIR}/bin"
  mkdir -p "$bin"
  cat >"${bin}/apt-cache" <<'EOF'
#!/usr/bin/env bash
echo "  cadt | 1.7.25 | https://repo.chia.net cadt/main amd64 Packages"
EOF
  chmod +x "${bin}/apt-cache"
  PATH="${bin}:$PATH"

  run verify_apt_package_version cadt "1.7.26"
  [[ "$status" -ne 0 ]]
  [[ "$output" == *"not found in apt repositories"* ]]
}

@test "verify_apt_package_version is a no-op when version arg is empty" {
  # Latest-from-apt path: no specific pin to verify.
  verify_apt_package_version cadt ""
}

@test "cadt_health_curl_args includes API key header only when configured" {
  local args

  CADT_API_KEY=""
  cadt_health_curl_args args
  [[ "${args[*]}" == "-fsS --connect-timeout 5 --max-time 10 http://localhost:31310/v1/health" ]]

  CADT_API_KEY="secret-key"
  cadt_health_curl_args args
  [[ "${args[*]}" == "-fsS --connect-timeout 5 --max-time 10 -H x-api-key: secret-key http://localhost:31310/v1/health" ]]
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

@test "patch_cadt_config rewrites real YAML with expected APP/V1/V2 values" {
  if ! command -v python3 >/dev/null 2>&1 ||
    ! python3 -c 'import yaml' >/dev/null 2>&1; then
    skip "python3 + pyyaml required"
  fi

  # Real config.yaml fixture; patch_cadt_config must mutate it in place.
  CADT_CONFIG="${BATS_TEST_TMPDIR}/config.yaml"
  cat >"$CADT_CONFIG" <<'YAML'
APP:
  CHIA_NETWORK: mainnet
  BIND_ADDRESS: 0.0.0.0
V1:
  READ_ONLY: false
  CADT_API_KEY: null
V2:
  READ_ONLY: false
  CADT_API_KEY: null
YAML

  NETWORK=testneta
  DATALAYER_URL="http://example.com/data"
  READ_ONLY=true
  CADT_API_KEY="my-secret-key"

  patch_cadt_config

  python3 - "$CADT_CONFIG" <<'PY'
import sys, yaml
with open(sys.argv[1]) as f:
    c = yaml.safe_load(f)
assert c["APP"]["CHIA_NETWORK"] == "testneta", c["APP"].get("CHIA_NETWORK")
assert c["APP"]["BIND_ADDRESS"] == "127.0.0.1", c["APP"].get("BIND_ADDRESS")
assert c["APP"]["DATALAYER_FILE_SERVER_URL"] == "http://example.com/data", c["APP"].get("DATALAYER_FILE_SERVER_URL")
for sec in ("V1", "V2"):
    assert c[sec]["READ_ONLY"] is True, (sec, c[sec]["READ_ONLY"])
    assert c[sec]["CADT_API_KEY"] == "my-secret-key", (sec, c[sec]["CADT_API_KEY"])
    # Testneta governance id from install-omnibus.sh
    assert (
        c[sec]["GOVERNANCE"]["GOVERNANCE_BODY_ID"]
        == "1019153f631bb82e7fc4984dc1f0f2af9e95a7c29df743f7b4dcc2b975857409"
    ), (sec, c[sec]["GOVERNANCE"])
PY
}

@test "patch_cadt_config preserves literal API key when value contains shell-meaningful chars" {
  if ! command -v python3 >/dev/null 2>&1 ||
    ! python3 -c 'import yaml' >/dev/null 2>&1; then
    skip "python3 + pyyaml required"
  fi

  CADT_CONFIG="${BATS_TEST_TMPDIR}/config.yaml"
  cat >"$CADT_CONFIG" <<'YAML'
APP: {}
V1: {}
V2: {}
YAML

  NETWORK=mainnet
  DATALAYER_URL="http://127.0.0.1/data"
  READ_ONLY=false
  # Backticks, single+double quotes, dollar-prefix, backslash — all hazards if
  # patch_cadt_config interpolates the key into Python source instead of env.
  CADT_API_KEY="a\`b\"c'd\$e\\f"

  patch_cadt_config

  python3 - "$CADT_CONFIG" "$CADT_API_KEY" <<'PY'
import sys, yaml
with open(sys.argv[1]) as f:
    c = yaml.safe_load(f)
expected = sys.argv[2]
for sec in ("V1", "V2"):
    assert c[sec]["CADT_API_KEY"] == expected, (sec, c[sec]["CADT_API_KEY"], expected)
PY
}

@test "patch_cadt_config sets governance ID for mainnet" {
  if ! command -v python3 >/dev/null 2>&1 ||
    ! python3 -c 'import yaml' >/dev/null 2>&1; then
    skip "python3 + pyyaml required"
  fi

  CADT_CONFIG="${BATS_TEST_TMPDIR}/config.yaml"
  cat >"$CADT_CONFIG" <<'YAML'
APP: {}
V1: {}
V2: {}
YAML

  NETWORK=mainnet
  DATALAYER_URL="http://127.0.0.1/data"
  READ_ONLY=false
  CADT_API_KEY=""

  patch_cadt_config

  python3 - "$CADT_CONFIG" <<'PY'
import sys, yaml
with open(sys.argv[1]) as f:
    c = yaml.safe_load(f)
mainnet_id = "23f6498e015ebcd7190c97df30c032de8deb5c8934fc1caa928bc310e2b8a57e"
for sec in ("V1", "V2"):
    assert c[sec]["GOVERNANCE"]["GOVERNANCE_BODY_ID"] == mainnet_id, (sec, c[sec]["GOVERNANCE"])
    # Empty CADT_API_KEY env should map to None (null) in YAML.
    assert c[sec]["CADT_API_KEY"] is None, (sec, c[sec]["CADT_API_KEY"])
PY
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

@test "parse_args dies on unknown option with usage hint" {
  run parse_args --not-a-real-flag
  [[ "$status" -ne 0 ]]
  [[ "$output" == *"Unknown option"* ]]
  [[ "$output" == *"--help"* ]]
}

@test "parse_args dies when a value-taking flag has no value" {
  run parse_args --network
  [[ "$status" -ne 0 ]]
  [[ "$output" == *"requires a value"* ]]
}

@test "parse_args sets KEY_MODE=import via --import-key-from-file" {
  KEY_MODE=""
  IMPORT_KEY_FILE=""
  parse_args --import-key-from-file=/tmp/seed.txt
  [[ "$KEY_MODE" == "import" ]]
  [[ "$IMPORT_KEY_FILE" == "/tmp/seed.txt" ]]
}

@test "parse_args sets READ_ONLY=true via --read-only" {
  READ_ONLY=""
  parse_args --read-only
  [[ "$READ_ONLY" == true ]]
}

@test "parse_args captures --api-key value" {
  CADT_API_KEY=""
  parse_args --api-key="my-secret"
  [[ "$CADT_API_KEY" == "my-secret" ]]
}

@test "validate_yes_args dies when --yes is set but required flags missing" {
  ASSUME_YES=true
  NETWORK=""
  PUBLIC_ADDRESS=""
  KEY_MODE=""
  IMPORT_KEY_FILE=""
  MNEMONIC_OUTPUT_FILE=""

  run validate_yes_args
  [[ "$status" -ne 0 ]]
  [[ "$output" == *"--yes requires:"* ]]
  [[ "$output" == *"--network"* ]]
  [[ "$output" == *"--public-address"* ]]
  [[ "$output" == *"--mnemonic-output-file"* ]]
}

@test "validate_yes_args passes when --yes is set with required flags and generate" {
  ASSUME_YES=true
  NETWORK=testneta
  PUBLIC_ADDRESS=example.com
  KEY_MODE=""
  IMPORT_KEY_FILE=""
  MNEMONIC_OUTPUT_FILE="${BATS_TEST_TMPDIR}/seed.txt"

  validate_yes_args
}

@test "validate_yes_args requires --import-key-from-file when KEY_MODE=import" {
  ASSUME_YES=true
  NETWORK=testneta
  PUBLIC_ADDRESS=example.com
  KEY_MODE=import
  IMPORT_KEY_FILE=""
  MNEMONIC_OUTPUT_FILE=""

  run validate_yes_args
  [[ "$status" -ne 0 ]]
  [[ "$output" == *"--import-key-from-file"* ]]
}

@test "validate_yes_args dies on unreadable --import-key-from-file" {
  ASSUME_YES=true
  NETWORK=testneta
  PUBLIC_ADDRESS=example.com
  KEY_MODE=import
  IMPORT_KEY_FILE="/nonexistent/path/to/key"
  MNEMONIC_OUTPUT_FILE=""

  run validate_yes_args
  [[ "$status" -ne 0 ]]
  [[ "$output" == *"import key file not found"* ]]
}

@test "validate_mnemonic_output_file_path rejects /dev/null and special files" {
  run validate_mnemonic_output_file_path /dev/null
  [[ "$status" -ne 0 ]]
  [[ "$output" == *"regular file"* ]]
}

@test "validate_mnemonic_output_file_path rejects symlinks" {
  local link="${BATS_TEST_TMPDIR}/seed-link"
  ln -s "${BATS_TEST_TMPDIR}/target" "$link"

  run validate_mnemonic_output_file_path "$link"
  [[ "$status" -ne 0 ]]
  [[ "$output" == *"symlink"* ]]
}

@test "write_mnemonic_to_output_file refuses to write to a symlink (TOCTOU defense)" {
  TMP_FILES=()
  local link="${BATS_TEST_TMPDIR}/seed-link"
  ln -s "${BATS_TEST_TMPDIR}/elsewhere" "$link"

  run write_mnemonic_to_output_file "word1 word2" "$link"
  [[ "$status" -ne 0 ]]
  [[ "$output" == *"symlink"* ]]
  [[ ! -e "${BATS_TEST_TMPDIR}/elsewhere" ]]
}

@test "write_mnemonic_to_output_file writes 600-mode file atomically" {
  TMP_FILES=()
  local target="${BATS_TEST_TMPDIR}/seed.txt"

  write_mnemonic_to_output_file "word1 word2 word3" "$target"

  [[ -f "$target" ]]
  [[ "$(cat "$target")" == "word1 word2 word3" ]]
  # Mode should be 600 (owner read+write only).
  local mode
  mode=$(stat -c '%a' "$target")
  [[ "$mode" == "600" ]]
}

@test "validate_mnemonic_output_file_path rejects unwritable parent" {
  run validate_mnemonic_output_file_path /nonexistent-parent-dir/seed.txt
  [[ "$status" -ne 0 ]]
  [[ "$output" == *"parent directory does not exist"* ]]
}

@test "validate_mnemonic_output_file_path accepts a writable tmp path" {
  validate_mnemonic_output_file_path "${BATS_TEST_TMPDIR}/seed.txt"
}

@test "validate_yes_args rejects --mnemonic-output-file=/dev/null" {
  ASSUME_YES=true
  NETWORK=testneta
  PUBLIC_ADDRESS=example.com
  KEY_MODE=generate
  IMPORT_KEY_FILE=""
  MNEMONIC_OUTPUT_FILE=/dev/null

  run validate_yes_args
  [[ "$status" -ne 0 ]]
  [[ "$output" == *"regular file"* ]]
}

@test "validate_yes_args requires --mnemonic-output-file when generating under --yes" {
  ASSUME_YES=true
  NETWORK=testneta
  PUBLIC_ADDRESS=example.com
  KEY_MODE=generate
  IMPORT_KEY_FILE=""
  MNEMONIC_OUTPUT_FILE=""

  run validate_yes_args
  [[ "$status" -ne 0 ]]
  [[ "$output" == *"--mnemonic-output-file"* ]]
}

@test "extract_mnemonic_line picks the 24-word line out of generate_and_print output" {
  # Real chia keys generate_and_print format: header / 24-word seed / footer.
  local fake_output mnemonic words
  fake_output="Generating private key. Mnemonic (24 secret words):
$(printf 'word%d ' {1..24})
Note that this key has not been added to the keychain. Run chia keys add"

  mnemonic=$(printf '%s\n' "$fake_output" | extract_mnemonic_line)

  [[ -n "$mnemonic" ]]
  words=$(printf '%s\n' "$mnemonic" | awk '{print NF}')
  [[ "$words" -eq 24 ]]
  ! grep -q "Generating" <<<"$mnemonic"
  ! grep -q "keychain" <<<"$mnemonic"
}

@test "extract_mnemonic_line returns empty when no 24-word line is present" {
  local out
  out=$(printf 'one two three\nfour five\n' | extract_mnemonic_line)
  [[ -z "$out" ]]
}

@test "validate_min_disk_gb accepts integers and rejects non-numeric" {
  MIN_DISK_GIB=300
  validate_min_disk_gb

  MIN_DISK_GIB=0
  validate_min_disk_gb

  MIN_DISK_GIB="abc"
  run validate_min_disk_gb
  [[ "$status" -ne 0 ]]
  [[ "$output" == *"non-negative integer"* ]]

  MIN_DISK_GIB="-5"
  run validate_min_disk_gb
  [[ "$status" -ne 0 ]]
}

@test "is_ipv4 recognizes dotted quads and rejects out-of-range octets" {
  is_ipv4 "192.168.1.1"
  is_ipv4 "0.0.0.0"
  is_ipv4 "255.255.255.255"
  ! is_ipv4 "not-an-ip"
  ! is_ipv4 "999.999.999.999"
  ! is_ipv4 "256.0.0.1"
  ! is_ipv4 "1.2.3"
  ! is_ipv4 "1.2.3.4.5"
}
