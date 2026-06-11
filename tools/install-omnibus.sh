#!/usr/bin/env bash
#
# CADT Omnibus Installer
# Installs Chia (CLI), chia-tools, CADT, nginx reverse proxy, and configures CADT.
#
# Usage:
#   ./tools/install-omnibus.sh [OPTIONS]
#
# Run as a non-root user with sudo access. See --help for flags.

# -E: ERR trap inherited by subshells/functions; -e: exit on error;
# -u: unset variables are errors; pipefail: pipeline exit status reflects
# the first failing command (not just the last).
set -Eeuo pipefail

readonly SCRIPT_VERSION="1.0.0"
readonly GOVERNANCE_MAINNET="23f6498e015ebcd7190c97df30c032de8deb5c8934fc1caa928bc310e2b8a57e"
readonly GOVERNANCE_TESTNETA="1019153f631bb82e7fc4984dc1f0f2af9e95a7c29df743f7b4dcc2b975857409"
readonly CHIA_GPG_URL="https://repo.chia.net/FD39E6D3.pubkey.asc"
readonly GH_API_CHIA="https://api.github.com/repos/Chia-Network/chia-blockchain/releases"
readonly GH_API_TOOLS="https://api.github.com/repos/Chia-Network/chia-tools/releases"
readonly GH_API_CADT="https://api.github.com/repos/Chia-Network/cadt/releases"
readonly CHIA_ROOT="${HOME}/.chia/mainnet"
if [[ "${INSTALL_OMNIBUS_LIB_ONLY:-0}" == 1 ]]; then
  # Default-if-unset so tests can point filesystem-mutating helpers at fixtures.
  : "${DATALAYER_WWW_ROOT:=${CHIA_ROOT}/data_layer/www}"
else
  readonly DATALAYER_WWW_ROOT="${CHIA_ROOT}/data_layer/www"
fi
# Default-if-unset so tests can point this at a fixture by pre-setting
# CADT_CONFIG before sourcing. Not made `readonly` for the same reason.
: "${CADT_CONFIG:=${CHIA_ROOT}/cadt/config.yaml}"
readonly MIN_CPU_CORES=4
readonly MIN_RAM_KIB=$((7680 * 1024)) # 7.5 GiB
readonly DEFAULT_MIN_DISK_GIB=300
readonly SPINNER_CHARS="|/-\\"
readonly CERTBOT_WEBROOT="/var/www/certbot"

# Configurable via flags
NETWORK=""
CHIA_VERSION_CHOICE=""
CHIA_TOOLS_VERSION_CHOICE=""
CADT_VERSION_CHOICE=""
PUBLIC_ADDRESS=""
LOCAL_ONLY=false
TESTING_NO_PUBLIC_MIRROR=false
ENABLE_HTTPS=false
CERTBOT_DRY_RUN=false
READ_ONLY=""
CADT_API_KEY=""
KEY_MODE="" # generate | import
IMPORT_KEY_FILE=""
MNEMONIC_OUTPUT_FILE=""
MIN_DISK_GIB="${DEFAULT_MIN_DISK_GIB}"
ASSUME_YES=false

CHIA_APT_VER=""
TOOLS_APT_VER=""
CADT_APT_VER=""
DATALAYER_URL=""
PUBLIC_URL=""
LOG_FILE=""
# FD 3 holds the original terminal stdout after setup_logging dup's FD 1
# to the tee'd install log. Mnemonics and the final API key are emitted
# via private_echo/private_literal on FD 3 so they never pass through tee.
PRIVATE_FD=3

# Temp files (mnemonic, fetched release JSON) registered here are removed on
# exit — including die/on_error paths where RETURN traps don't fire.
TMP_FILES=()

# Colors (disabled when not a tty)
if [[ -t 1 ]]; then
  readonly C_RESET='\033[0m'
  readonly C_BOLD='\033[1m'
  readonly C_DIM='\033[2m'
  readonly C_RED='\033[31m'
  readonly C_GREEN='\033[32m'
  readonly C_YELLOW='\033[33m'
  readonly C_BLUE='\033[34m'
  readonly C_CYAN='\033[36m'
else
  readonly C_RESET='' C_BOLD='' C_DIM='' C_RED='' C_GREEN='' C_YELLOW='' C_BLUE='' C_CYAN=''
fi

# --- Testable helpers (sourced by bats with INSTALL_OMNIBUS_LIB_ONLY=1) ---

is_ipv4() {
  local host="$1"
  [[ "$host" =~ ^([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$ ]] || return 1
  local octet
  for octet in "${BASH_REMATCH[@]:1:4}"; do
    # Base-10 forced so leading zeros (e.g. "010") don't trigger octal parse errors.
    ((10#$octet >= 0 && 10#$octet <= 255)) || return 1
  done
  return 0
}

strip_url_scheme() {
  local input="$1"
  input="${input#http://}"
  input="${input#https://}"
  input="${input%/}"
  echo "$input"
}

is_domain() {
  local host="$1"
  ! is_ipv4 "$host" && [[ "$host" != *:* ]]
}

validate_public_address() {
  local addr="$1"
  [[ -n "$addr" ]] || return 1
  if is_ipv4 "$addr"; then
    return 0
  fi
  if [[ "$addr" =~ ^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$ ]]; then
    return 0
  fi
  return 1
}

format_gib_from_kib() {
  # Render KiB as GiB with one decimal place, integer-only math (no bc).
  # Used so the system info line and the "minimum requirements" line agree:
  # 7,864,320 KiB displays as "7.5", not "7" — otherwise the success message
  # ("7.5 GiB RAM" requirement met) contradicts the system line (was "7 GiB").
  local kib="$1"
  local mib=$((kib / 1024))
  local gib_int=$((mib / 1024))
  local gib_tenths=$(((mib % 1024) * 10 / 1024))
  printf '%d.%d' "$gib_int" "$gib_tenths"
}

meets_min_specs() {
  local cpu="$1" mem_kib="$2" disk_gib="$3" min_disk="$4"
  [[ "$cpu" -ge "${MIN_CPU_CORES}" ]] || return 1
  [[ "$mem_kib" -ge "${MIN_RAM_KIB}" ]] || return 1
  [[ "$disk_gib" -ge "$min_disk" ]] || return 1
  return 0
}

is_soft_spec_shortfall() {
  local cpu="$1" mem_kib="$2" disk_chia="$3" min_disk="${4:-$MIN_DISK_GIB}"
  [[ "$cpu" -ge "$((MIN_CPU_CORES - 1))" ]] || return 1
  [[ "$mem_kib" -ge "$((MIN_RAM_KIB * 9 / 10))" ]] || return 1
  [[ "$disk_chia" -ge "$((min_disk * 9 / 10))" ]] || return 1
  return 0
}

validate_network() {
  local network="$1"
  [[ "$network" == "mainnet" || "$network" == "testneta" ]] ||
    die "Invalid network: $network"
}

is_dpkg_package_installed() {
  local pkg="$1"
  dpkg -l "$pkg" 2>/dev/null | grep -q '^ii[[:space:]]'
}

normalize_mnemonic_file() {
  local path="$1"
  awk '
    {
      gsub(/\r/, " ")
      for (i = 1; i <= NF; i++) {
        if (seen) {
          printf " "
        }
        printf "%s", $i
        seen = 1
      }
    }
    END {
      if (seen) {
        printf "\n"
      }
    }
  ' "$path"
}

validate_supported_apt_versions() {
  # chia-tools apt repos publish stable only. Chia CLI and CADT have separate
  # prerelease/test repos toggled in setup_apt_repos when -rc packages are used.
  if is_prerelease_version "$TOOLS_APT_VER"; then
    die "chia-tools prerelease apt packages are not supported; choose stable or an explicit stable tag."
  fi
}

is_prerelease_version() {
  [[ "${1,,}" =~ (^|[-+~.])(alpha|beta|pre|preview|prerelease|rc)[0-9]*($|[-+~.]) ]]
}

cadt_health_curl_args() {
  local -n args_ref="$1"
  # connect-timeout + max-time prevent a stuck TCP connect from blowing the
  # caller's poll budget (we expect this to fail fast while CADT comes up).
  args_ref=(-fsS --connect-timeout 5 --max-time 10)
  if [[ -n "$CADT_API_KEY" ]]; then
    args_ref+=(-H "x-api-key: ${CADT_API_KEY}")
  fi
  args_ref+=("http://localhost:31310/v1/health")
}

build_datalayer_url() {
  if [[ "$TESTING_NO_PUBLIC_MIRROR" == true ]]; then
    DATALAYER_URL=""
    return 0
  fi

  local scheme="http"
  if [[ "$ENABLE_HTTPS" == true ]]; then
    scheme="https"
  fi
  DATALAYER_URL="${scheme}://${PUBLIC_ADDRESS}/data"
}

build_public_url() {
  if [[ -z "$PUBLIC_ADDRESS" ]]; then
    PUBLIC_URL="http://localhost:31310"
    return 0
  fi

  local scheme="http"
  if [[ "$ENABLE_HTTPS" == true ]]; then
    scheme="https"
  fi
  PUBLIC_URL="${scheme}://${PUBLIC_ADDRESS}"
}

pick_release_from_json() {
  local json_file="$1" mode="$2"
  if [[ ! -f "$json_file" ]]; then
    return 1
  fi
  case "$mode" in
    stable)
      jq -r '[.[] | select(.draft == false and .prerelease == false)] | .[0].tag_name // empty' "$json_file"
      ;;
    prerelease)
      jq -r '[.[] | select(.draft == false and .prerelease == true)] | .[0].tag_name // empty' "$json_file"
      ;;
    *)
      if [[ "$mode" =~ ^[0-9]+$ ]]; then
        jq -r --argjson idx "$((mode - 1))" \
          '[.[] | select(.draft == false)] | .[$idx].tag_name // empty' "$json_file"
      else
        return 1
      fi
      ;;
  esac
}

version_choice_needs_release_fetch() {
  case "${1,,}" in
    stable | latest | prerelease | rc | pre-release | beta) return 0 ;;
    *) return 1 ;;
  esac
}

validate_min_disk_gb() {
  # Catch non-numeric values up front so check_min_specs doesn't blow up
  # inside an arithmetic context.
  [[ "$MIN_DISK_GIB" =~ ^[0-9]+$ ]] || die "--min-disk-gb must be a non-negative integer (got: $MIN_DISK_GIB)"
}

validate_yes_args() {
  [[ "$ASSUME_YES" == true ]] || return 0
  local missing=()
  [[ -z "$NETWORK" ]] && missing+=("--network")
  [[ -z "$PUBLIC_ADDRESS" && "$TESTING_NO_PUBLIC_MIRROR" != true ]] && missing+=("--public-address")

  if [[ "$KEY_MODE" == "import" ]]; then
    # Catch a missing/unreadable import path now, before apt mutates anything.
    if [[ -z "$IMPORT_KEY_FILE" ]]; then
      missing+=("--import-key-from-file")
    elif [[ ! -f "$IMPORT_KEY_FILE" ]]; then
      die "--yes: import key file not found: $IMPORT_KEY_FILE"
    fi
  else
    # generate (default): without an output file the 24-word seed is unrecoverable.
    if [[ -z "$MNEMONIC_OUTPUT_FILE" ]]; then
      missing+=("--mnemonic-output-file (or --import-key-from-file)")
    else
      validate_mnemonic_output_file_path "$MNEMONIC_OUTPUT_FILE"
    fi
  fi

  if [[ ${#missing[@]} -gt 0 ]]; then
    die "--yes requires: ${missing[*]} (no safe defaults; abort before mutating the system)"
  fi

  validate_testing_no_public_mirror_network
}

validate_testing_no_public_mirror_network() {
  [[ "$TESTING_NO_PUBLIC_MIRROR" == true ]] || return 0
  [[ "$NETWORK" == "testneta" ]] ||
    die "--testing-no-public-mirror is only supported with --network=testneta"
}

warn_no_public_mirror() {
  warn "Testing mode: DataLayer file server URL will not be advertised."
  echo "  Your data will not sync to any other CADT participants or show up on observers"
  echo "  and will be only available on this computer. However, you will be able to sync data"
  echo "  from other CADT participants to this machine. Only use this for testing purposes."
}

validate_mnemonic_output_file_path() {
  local path="$1"
  # Reject sinks (/dev/null, /dev/stdout, pipes, etc.) — they would silently
  # destroy the mnemonic. Only a regular-file destination is safe.
  if [[ -L "$path" ]]; then
    die "--mnemonic-output-file must not be a symlink: $path"
  fi
  if [[ -e "$path" && ! -f "$path" ]]; then
    die "--mnemonic-output-file must be a regular file (got special file: $path)"
  fi
  local parent
  parent=$(dirname "$path")
  [[ -d "$parent" ]] || die "--mnemonic-output-file: parent directory does not exist: $parent"
  [[ -w "$parent" ]] || die "--mnemonic-output-file: parent directory not writable: $parent"
}

write_mnemonic_to_output_file() {
  # Atomic write that doesn't follow symlinks: write to a sibling tmpfile then
  # rename. rename(2) replaces a symlink at the destination rather than
  # writing through it, so a TOCTOU race that swaps in a symlink between
  # validate_mnemonic_output_file_path and this call cannot redirect the seed.
  local mnemonic="$1" target="$2"
  if [[ -L "$target" ]]; then
    die "--mnemonic-output-file: refusing to write to symlink: $target"
  fi
  if [[ -e "$target" && ! -f "$target" ]]; then
    die "--mnemonic-output-file: refusing to write to special file: $target"
  fi
  local dir tmp
  dir=$(dirname "$target")
  tmp=$(mktemp "${dir}/.mnemonic.XXXXXX") || die "Could not create temp file in ${dir}"
  register_tmp_file "$tmp"
  chmod 600 "$tmp"
  printf '%s\n' "$mnemonic" >"$tmp"
  mv -f -- "$tmp" "$target"
}

parse_args() {
  _require_arg() { [[ $# -ge 2 ]] || die "$1 requires a value"; }
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --network=*)
        NETWORK="${1#*=}"
        ;;
      --network)
        _require_arg "$@"
        NETWORK="$2"
        shift
        ;;
      --chia-version=*)
        CHIA_VERSION_CHOICE="${1#*=}"
        ;;
      --chia-version)
        _require_arg "$@"
        # shellcheck disable=SC2034 # read indirectly via ${!var_choice}
        CHIA_VERSION_CHOICE="$2"
        shift
        ;;
      --chia-tools-version=*)
        CHIA_TOOLS_VERSION_CHOICE="${1#*=}"
        ;;
      --chia-tools-version)
        _require_arg "$@"
        # shellcheck disable=SC2034 # read indirectly via ${!var_choice}
        CHIA_TOOLS_VERSION_CHOICE="$2"
        shift
        ;;
      --cadt-version=*)
        CADT_VERSION_CHOICE="${1#*=}"
        ;;
      --cadt-version)
        _require_arg "$@"
        # shellcheck disable=SC2034 # read indirectly via ${!var_choice}
        CADT_VERSION_CHOICE="$2"
        shift
        ;;
      --public-address=*)
        PUBLIC_ADDRESS=$(strip_url_scheme "${1#*=}")
        ;;
      --public-address)
        _require_arg "$@"
        PUBLIC_ADDRESS=$(strip_url_scheme "$2")
        shift
        ;;
      --local-only)
        LOCAL_ONLY=true
        ;;
      --testing-no-public-mirror)
        TESTING_NO_PUBLIC_MIRROR=true
        ;;
      --https)
        ENABLE_HTTPS=true
        ;;
      --certbot-dry-run)
        CERTBOT_DRY_RUN=true
        ;;
      --read-only)
        READ_ONLY=true
        ;;
      --api-key=*)
        CADT_API_KEY="${1#*=}"
        ;;
      --api-key)
        _require_arg "$@"
        CADT_API_KEY="$2"
        shift
        ;;
      --generate-key)
        KEY_MODE=generate
        ;;
      --import-key-from-file=*)
        KEY_MODE=import
        IMPORT_KEY_FILE="${1#*=}"
        ;;
      --import-key-from-file)
        _require_arg "$@"
        KEY_MODE=import
        IMPORT_KEY_FILE="$2"
        shift
        ;;
      --mnemonic-output-file=*)
        MNEMONIC_OUTPUT_FILE="${1#*=}"
        ;;
      --mnemonic-output-file)
        _require_arg "$@"
        MNEMONIC_OUTPUT_FILE="$2"
        shift
        ;;
      --min-disk-gb=*)
        MIN_DISK_GIB="${1#*=}"
        ;;
      --min-disk-gb)
        _require_arg "$@"
        MIN_DISK_GIB="$2"
        shift
        ;;
      --yes | -y)
        ASSUME_YES=true
        ;;
      --help | -h)
        print_usage
        exit 0
        ;;
      --version)
        echo "install-omnibus.sh ${SCRIPT_VERSION}"
        exit 0
        ;;
      *)
        die "Unknown option: $1 (use --help)"
        ;;
    esac
    shift
  done
}

# --- UI helpers ---

die() {
  cleanup_background_processes
  cleanup_tmp_files
  echo -e "${C_RED}ERROR:${C_RESET} $*" >&2
  exit 1
}

warn() {
  echo -e "${C_YELLOW}WARNING:${C_RESET} $*"
}

info() {
  echo -e "${C_CYAN}==>${C_RESET} ${C_BOLD}$*${C_RESET}"
}

phase() {
  local label="$1"
  echo ""
  echo -e "${C_BOLD}${C_BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}"
  echo -e "${C_BOLD}${C_BLUE}  $label${C_RESET}"
  echo -e "${C_BOLD}${C_BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}"
  echo ""
}

success() {
  echo -e "${C_GREEN}✓${C_RESET} $*"
}

private_echo() {
  # Write to private FD (not tee'd to install log)
  printf '%b\n' "$*" >&${PRIVATE_FD}
}

private_literal() {
  # Write sensitive literal text to the terminal without tee logging.
  printf '%s\n' "$*" >&${PRIVATE_FD}
}

print_usage() {
  cat <<'EOF'
CADT Omnibus Installer — installs Chia CLI, chia-tools, CADT, and nginx.

Run as a non-root user with sudo access.

Options:
  --network=mainnet|testneta
  --chia-version=stable|prerelease|beta|<tag>
  --chia-tools-version=stable|<stable-tag>
  --cadt-version=stable|prerelease|<tag>
  --public-address=<domain-or-ip>  public address for this server
  --local-only                     skip CADT API proxy (datalayer files still served)
  --testing-no-public-mirror       testing only; leave DataLayer URL unadvertised
  --https                          enable HTTPS with Let's Encrypt certbot
  --certbot-dry-run                run certbot in dry-run mode (for testing)
  --read-only                      observer mode
  --api-key=<key>
  --generate-key                   generate a new Chia key
  --import-key-from-file=<path>    import mnemonic from file
  --mnemonic-output-file=<path>    write generated mnemonic here (not logged)
  --min-disk-gb=<n>                minimum free disk GiB (default: 300; flag name
                                   is gb but the value is GiB)
  --yes, -y                        skip confirmation prompts (see below)
  --help, -h

Non-interactive (--yes) requires explicit values for fields with no safe
default. Aborts before any system mutation if anything below is missing:

  --network=...
  --public-address=...
    (or --testing-no-public-mirror for testing-only installs)
  one of:
    --import-key-from-file=<path>     (preferred: bring your own seed)
    --mnemonic-output-file=<path>     (with --generate-key; cannot be /dev/null)

Optional flags fall back to defaults under --yes (latest stable for each
component, auto-generated API key, read-write mode).
EOF
}

cleanup_background_processes() {
  # Kill spinner first: a dying spinner can corrupt the next error line
  # with a stray \r. Then stop the sudo keepalive so no further sudo -n
  # calls happen during cleanup.
  if [[ -n "${SPINNER_PID:-}" ]]; then
    kill "$SPINNER_PID" 2>/dev/null || true
    wait "$SPINNER_PID" 2>/dev/null || true
    SPINNER_PID=""
  fi
  if [[ -n "${SUDO_KEEPALIVE_PID:-}" ]]; then
    kill "$SUDO_KEEPALIVE_PID" 2>/dev/null || true
    wait "$SUDO_KEEPALIVE_PID" 2>/dev/null || true
    SUDO_KEEPALIVE_PID=""
  fi
}

register_tmp_file() {
  TMP_FILES+=("$1")
}

cleanup_tmp_files() {
  local f
  # Guard against unset/empty when the array hasn't been added to.
  for f in "${TMP_FILES[@]+"${TMP_FILES[@]}"}"; do
    if [[ -n "$f" && -e "$f" ]]; then
      rm -f "$f" 2>/dev/null || true
    fi
  done
  TMP_FILES=()
}

on_exit() {
  cleanup_background_processes
  cleanup_tmp_files
}

on_error() {
  local line="$1"
  cleanup_background_processes
  cleanup_tmp_files
  echo -e "\n${C_RED}Install failed at line ${line}.${C_RESET}" >&2
  if [[ -n "${LOG_FILE:-}" ]]; then
    echo -e "${C_DIM}See log: ${LOG_FILE}${C_RESET}" >&2
  fi
  echo "If this persists, share the log with the CADT team." >&2
  exit 1
}

if [[ "${INSTALL_OMNIBUS_LIB_ONLY:-0}" != 1 ]]; then
  trap 'on_error ${LINENO}' ERR
  # EXIT fires regardless of success/failure path so registered temp files
  # (mnemonics, fetched release JSON) always get scrubbed.
  trap on_exit EXIT
fi

spinner_start() {
  local msg="$1"
  SPINNER_MSG="$msg"
  SPINNER_PID=""
  (
    local i=0
    while true; do
      printf '\r%s %s ' "${SPINNER_CHARS:$((i % 4)):1}" "$SPINNER_MSG"
      sleep 0.15
      i=$((i + 1))
    done
  ) &
  SPINNER_PID=$!
}

spinner_stop() {
  local status="${1:-0}"
  if [[ -n "${SPINNER_PID:-}" ]]; then
    kill "$SPINNER_PID" 2>/dev/null || true
    wait "$SPINNER_PID" 2>/dev/null || true
    SPINNER_PID=""
  fi
  printf '\r\033[K'
  if [[ "$status" -eq 0 ]]; then
    success "$SPINNER_MSG — done"
  fi
}

prompt_default() {
  local var_name="$1" prompt="$2" default="$3"
  local input
  # Honor --yes only when a default is available; otherwise we must still ask
  # so a required field isn't silently set to "".
  if [[ "$ASSUME_YES" == true && -n "$default" ]]; then
    printf -v "$var_name" '%s' "$default"
    return 0
  fi
  if [[ -n "$default" ]]; then
    read -r -p "${prompt} [${default}]: " input </dev/tty
    input="${input:-$default}"
  else
    read -r -p "${prompt}: " input </dev/tty
  fi
  printf -v "$var_name" '%s' "$input"
}

confirm() {
  local prompt="$1"
  if [[ "$ASSUME_YES" == true ]]; then
    return 0
  fi
  local ans
  read -r -p "${prompt} [y/N]: " ans </dev/tty
  [[ "${ans,,}" == "y" || "${ans,,}" == "yes" ]]
}

refuse_root() {
  # Root is the most fundamental misuse — surface it before flag validation
  # so users see "do not run as root" instead of "missing --network".
  if [[ "$EUID" -eq 0 ]]; then
    cat >&2 <<'EOF'

ERROR: Do not run this installer as root.

Create a dedicated user with sudo access and run the installer as that user:

  sudo adduser cadt
  sudo usermod -aG sudo cadt
  su - cadt
  ./tools/install-omnibus.sh

Chia and CADT must run as a regular user (systemd units use cadt@USERNAME).

EOF
    exit 1
  fi
}

require_sudo() {
  if ! sudo -n true 2>/dev/null; then
    info "sudo access required; you may be prompted for your password once."
    sudo -v
  fi
  # Keep sudo timestamp fresh in background
  while true; do
    sleep 60
    sudo -n true 2>/dev/null || true
  done &
  SUDO_KEEPALIVE_PID=$!
}

setup_logging() {
  LOG_FILE="/tmp/cadt-install-$(date +%Y%m%d-%H%M%S).log"
  : >"$LOG_FILE"
  chmod 600 "$LOG_FILE"
  # Private FD for mnemonic (not logged)
  exec 3>&1
  exec > >(tee -a "$LOG_FILE") 2>&1
  info "Install log: ${LOG_FILE}"
}

check_os() {
  [[ -f /etc/os-release ]] || die "Cannot detect OS (/etc/os-release missing)."
  # shellcheck source=/dev/null
  source /etc/os-release
  local ok=false
  if [[ "${ID:-}" == "ubuntu" || "${ID:-}" == "debian" ]]; then
    ok=true
  elif [[ "${ID_LIKE:-}" == *debian* ]]; then
    ok=true
  fi
  if [[ "$ok" != true ]]; then
    die "Unsupported OS: ${PRETTY_NAME:-unknown}. Ubuntu or Debian is required."
  fi
  success "OS: ${PRETTY_NAME:-$ID}"
}

check_architecture() {
  local arch
  arch=$(dpkg --print-architecture)
  case "$arch" in
    amd64 | arm64) success "Architecture: $arch" ;;
    *) die "Unsupported architecture: $arch (need amd64 or arm64)" ;;
  esac
}

get_free_disk_gib() {
  local path="$1"
  local disk_path gib
  disk_path=$(existing_path_for_disk_check "$path")
  gib=$(df -BG "$disk_path" 2>/dev/null | awk 'NR==2 { gsub(/G/,"",$4); print $4 }')
  echo "${gib:-0}"
}

existing_path_for_disk_check() {
  local path="$1"
  while [[ ! -e "$path" ]]; do
    local parent
    parent=$(dirname "$path")
    if [[ "$parent" == "$path" ]]; then
      break
    fi
    path="$parent"
  done
  echo "$path"
}

check_min_specs() {
  local cpu mem_kib disk_root disk_home disk_chia chia_disk_path
  cpu=$(nproc)
  mem_kib=$(awk '/MemTotal:/ {print $2}' /proc/meminfo)
  disk_root=$(get_free_disk_gib /)
  disk_home=$(get_free_disk_gib "${HOME}")
  disk_chia=$(get_free_disk_gib "$CHIA_ROOT")
  chia_disk_path=$(existing_path_for_disk_check "$CHIA_ROOT")

  local mem_gib min_ram_gib
  mem_gib=$(format_gib_from_kib "$mem_kib")
  min_ram_gib=$(format_gib_from_kib "$MIN_RAM_KIB")

  info "System: ${cpu} CPUs, ${mem_gib} GiB RAM, ${disk_root} GiB free on /, ${disk_home} GiB free on \$HOME"
  info "Chia storage: ${disk_chia} GiB free at ${CHIA_ROOT} (checked ${chia_disk_path})"

  if meets_min_specs "$cpu" "$mem_kib" "$disk_chia" "$MIN_DISK_GIB"; then
    success \
      "Meets minimum requirements (${MIN_DISK_GIB} GiB Chia storage, ${MIN_CPU_CORES} CPUs, ${min_ram_gib} GiB RAM)"
    return 0
  fi

  if is_soft_spec_shortfall "$cpu" "$mem_kib" "$disk_chia"; then
    if [[ "$ASSUME_YES" == true ]]; then
      # --yes still accepts soft shortfall, but the warning must be visible
      # since confirm() doesn't print anything.
      warn "System is slightly below recommended specs; --yes accepting and continuing."
      return 0
    fi
    if confirm "System is slightly below recommended specs. Continue anyway?"; then
      warn "Continuing with below-minimum hardware."
      return 0
    fi
  fi

  die \
    "System does not meet minimum requirements: ${MIN_CPU_CORES} CPUs, ${min_ram_gib} GiB RAM, ${MIN_DISK_GIB} GiB free disk for Chia at ${CHIA_ROOT}."
}

check_existing_install() {
  # Each artifact below catches a different prior-install shape:
  #   dpkg rows  → official apt packages from a previous omnibus run
  #   /opt trees → tarball or manual installs not visible to dpkg
  #   ~/.chia    → `chia init` (or partial install) already ran for this user
  #   systemd    → enabled units that would conflict with new service files
  local found=false
  for pkg in chia-blockchain-cli cadt chia-tools; do
    if is_dpkg_package_installed "$pkg"; then
      warn "Package already installed: $pkg"
      found=true
    fi
  done
  [[ -d /opt/chia ]] && warn "Found /opt/chia" && found=true
  [[ -d /opt/cadt ]] && warn "Found /opt/cadt" && found=true
  if [[ -f "${CHIA_ROOT}/config/config.yaml" ]]; then
    warn "Found existing Chia config at ${CHIA_ROOT}/config/config.yaml"
    found=true
  fi
  # systemctl list-unit-files prints "UNIT STATE PRESET"; match column 2 only
  # so that disabled units with VENDOR_PRESET=enabled don't trigger a false positive.
  if systemctl list-unit-files 'chia-*@*.service' --no-legend 2>/dev/null |
    awk '$2 == "enabled" { f=1 } END { exit !f }'; then
    warn "Found enabled chia systemd units"
    found=true
  fi
  if systemctl list-unit-files 'cadt@*.service' --no-legend 2>/dev/null |
    awk '$2 == "enabled" { f=1 } END { exit !f }'; then
    warn "Found enabled cadt systemd units"
    found=true
  fi
  if [[ "$found" == true ]]; then
    die "An existing Chia or CADT install was detected. Remove packages and ~/.chia before re-running, or restore from a clean snapshot."
  fi
  success "No existing Chia/CADT install detected"
}

fetch_releases_json() {
  local url="$1" dest="$2" label="${3:-release}" flag_hint="${4:-version}"
  local auth=()
  if [[ -n "${GH_TOKEN:-}" ]]; then
    auth=(-H "Authorization: Bearer ${GH_TOKEN}")
  fi
  local sep="?"
  [[ "$url" == *\?* ]] && sep="&"
  local page=1 page_count page_file
  local max_pages=10
  local page_files=()

  while true; do
    page_file=$(mktemp)
    register_tmp_file "$page_file"
    page_files+=("$page_file")
    if ! curl -fsSL "${auth[@]}" "${url}${sep}per_page=100&page=${page}" -o "$page_file"; then
      die "Could not fetch ${label} releases from GitHub. Retry, set GH_TOKEN, or pass an exact --${flag_hint}=<tag> value."
    fi
    page_count=$(jq 'length' "$page_file")
    ((page_count < 100)) && break
    if ((page >= max_pages)); then
      die "Could not find a final ${label} releases page after ${max_pages} GitHub pages. Pass an exact --${flag_hint}=<tag> value."
    fi
    page=$((page + 1))
  done

  jq -s 'add' "${page_files[@]}" >"$dest"
}

version_flag_for_label() {
  case "$1" in
    chia-blockchain-cli) echo "chia-version" ;;
    chia-tools) echo "chia-tools-version" ;;
    cadt) echo "cadt-version" ;;
    *) echo "version" ;;
  esac
}

resolve_version_choice() {
  local choice="$1" json_file="$2" var_name="$3"
  local tag=""
  case "${choice,,}" in
    stable | latest)
      tag=$(pick_release_from_json "$json_file" stable)
      ;;
    prerelease | rc | pre-release | beta)
      tag=$(pick_release_from_json "$json_file" prerelease)
      ;;
    *)
      tag="$choice"
      ;;
  esac
  [[ -n "$tag" ]] || die "Could not resolve version for choice: $choice"
  printf -v "$var_name" '%s' "$tag"
}

prompt_version_choice() {
  local label="$1" gh_url="$2" var_choice="$3" var_apt="$4" allow_prerelease="${5:-false}"
  if [[ -n "${!var_apt}" ]]; then
    return 0
  fi
  local current="${!var_choice}"
  if [[ -n "$current" ]]; then
    if [[ "$allow_prerelease" != true && "$current" =~ ^([Pp]rerelease|[Rr][Cc]|[Pp]re-release|[Bb]eta)$ ]]; then
      die "${label} prerelease aliases are not supported; choose stable or an explicit stable tag."
    fi
    if version_choice_needs_release_fetch "$current"; then
      local tmp
      tmp=$(mktemp)
      register_tmp_file "$tmp"
      fetch_releases_json "$gh_url" "$tmp" "$label" "$(version_flag_for_label "$label")"
      resolve_version_choice "$current" "$tmp" "$var_apt"
      rm -f "$tmp"
    else
      printf -v "$var_apt" '%s' "$current"
    fi
    return 0
  fi

  local tmp
  tmp=$(mktemp)
  register_tmp_file "$tmp"
  fetch_releases_json "$gh_url" "$tmp" "$label" "$(version_flag_for_label "$label")"

  echo ""
  info "Select ${label} version:"
  echo "  1) Latest stable"
  if [[ "$allow_prerelease" == true ]]; then
    echo "  2) Latest pre-release"
    echo "  3) Pick from list"
  else
    echo "  2) Pick from list"
  fi
  local pick
  prompt_default pick "Choice" "1"

  local tag=""
  if [[ "$allow_prerelease" == true ]]; then
    case "$pick" in
      1) tag=$(pick_release_from_json "$tmp" stable) ;;
      2) tag=$(pick_release_from_json "$tmp" prerelease) ;;
      3)
        echo ""
        local listed=0
        listed=$(jq -r '[.[] | select(.draft == false)] | length' "$tmp")
        ((listed > 15)) && listed=15
        jq -r '.[] | select(.draft == false) | "\(.tag_name)\t\(if .prerelease then "pre-release" else "stable" end)"' "$tmp" |
          head -15 | nl -w2 -s') '
        local num
        prompt_default num "Enter number (1-${listed})" "1"
        if ! [[ "$num" =~ ^[0-9]+$ ]] || ((num < 1 || num > listed)); then
          die "Invalid selection: ${num}. Choose between 1 and ${listed}."
        fi
        tag=$(pick_release_from_json "$tmp" "$num")
        ;;
      *) die "Invalid choice" ;;
    esac
  else
    case "$pick" in
      1) tag=$(pick_release_from_json "$tmp" stable) ;;
      2)
        echo ""
        local listed=0
        listed=$(jq -r '[.[] | select(.draft == false and .prerelease == false)] | length' "$tmp")
        ((listed > 15)) && listed=15
        jq -r '.[] | select(.draft == false and .prerelease == false) | .tag_name' "$tmp" |
          head -15 | nl -w2 -s') '
        local num
        prompt_default num "Enter number (1-${listed})" "1"
        if ! [[ "$num" =~ ^[0-9]+$ ]] || ((num < 1 || num > listed)); then
          die "Invalid selection: ${num}. Choose between 1 and ${listed}."
        fi
        tag=$(jq -r --argjson idx "$((num - 1))" \
          '[.[] | select(.draft == false and .prerelease == false)] | .[$idx].tag_name // empty' "$tmp")
        ;;
      *) die "Invalid choice" ;;
    esac
  fi
  rm -f "$tmp"
  [[ -n "$tag" ]] || die "No release found for ${label}"
  printf -v "$var_apt" '%s' "$tag"
  success "${label}: ${tag} (apt: ${!var_apt})"
}

# Verify the requested apt pin exists; if not, downshift to the highest
# *published* version on the same track (stable vs -rc*) that is also
# <= the requested version, and update the caller's variable.
#
# GitHub Releases sometimes publishes slightly ahead of the apt build
# pipeline, so the brand-new tag the resolver picked may not be in apt yet.
# Without a fallback the installer dies; with this, the user gets the
# next-oldest published version and a warning. We never upgrade past the
# user's pin — a request for rc28 with apt-only-has-rc29 dies rather than
# silently installing something newer the user did not ask for.
verify_or_fallback_apt_version() {
  local pkg="$1" var_name="$2"
  local want="${!var_name}"
  [[ -z "$want" ]] && return 0

  # `|| true` so a non-zero apt-cache (e.g. unknown package) doesn't trip
  # the ERR trap; we want to fall through to our specific die message below.
  local available
  available=$(apt-cache madison "$pkg" 2>/dev/null | awk '{print $3}' | sort -V -r -u || true)

  # Exact-match wins; no fallback needed.
  if [[ -n "$available" ]] && grep -qFx -- "$want" <<<"$available"; then
    return 0
  fi

  # Track selection: prerelease tags come from prerelease/test repos; stable
  # pins must not silently fall back to prerelease packages.
  local want_rc=false
  is_prerelease_version "$want" && want_rc=true

  # sort -V -r already orders newest-first. Walk the list and pick the first
  # entry that is on the same track AND not newer than what was requested
  # (dpkg --compare-versions is the authoritative semver-ish ordering for
  # Debian-style version strings, including -rcN suffixes).
  local fallback="" v
  while IFS= read -r v; do
    [[ -z "$v" ]] && continue
    if [[ "$want_rc" == true ]]; then
      is_prerelease_version "$v" || continue
    else
      is_prerelease_version "$v" && continue
    fi
    # Skip versions newer than the user's pin — refusing to upgrade past the
    # requested version is what makes this a "fallback" and not a "drift".
    if dpkg --compare-versions "$v" gt "$want" 2>/dev/null; then
      continue
    fi
    fallback="$v"
    break
  done <<<"$available"

  if [[ -z "$fallback" ]]; then
    die "Package ${pkg} version ${want} not in apt and no compatible fallback (<= ${want}) available. Run 'apt-cache madison ${pkg}' to see published versions."
  fi
  warn "Package ${pkg} version ${want} not yet in apt; using highest available <= requested: ${fallback}"
  printf -v "$var_name" '%s' "$fallback"
}

install_prerequisites() {
  # Skip the apt round trip (and pre-confirm system mutation) when the user
  # already has everything we need. Most Ubuntu installs ship these but minimal
  # cloud images may be missing python3-yaml/gnupg/jq/ca-certificates.
  local missing=()
  command -v curl >/dev/null 2>&1 || missing+=(curl)
  command -v jq >/dev/null 2>&1 || missing+=(jq)
  command -v openssl >/dev/null 2>&1 || missing+=(openssl)
  command -v setfacl >/dev/null 2>&1 || missing+=(acl)
  command -v gpg >/dev/null 2>&1 || missing+=(gnupg)
  command -v python3 >/dev/null 2>&1 || missing+=(python3)
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import yaml' >/dev/null 2>&1 || missing+=(python3-yaml)
  else
    missing+=(python3-yaml)
  fi
  # ca-certificates has no PATH binary; dpkg query is the reliable signal.
  # Skipping it leaves downstream HTTPS (release JSON, GPG keyring, certbot)
  # to fail with opaque TLS errors on minimal images.
  is_dpkg_package_installed ca-certificates || missing+=(ca-certificates)

  if [[ ${#missing[@]} -eq 0 ]]; then
    success "Prerequisites already installed"
    return 0
  fi

  spinner_start "Installing prerequisites: ${missing[*]}"
  # shellcheck disable=SC2024
  sudo apt-get update -qq >>"$LOG_FILE" 2>&1
  # shellcheck disable=SC2024
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    "${missing[@]}" >>"$LOG_FILE" 2>&1
  spinner_stop 0
}

setup_apt_repos() {
  spinner_start "Configuring Chia apt repositories"
  # apt-key is deprecated/removed in modern Debian; the supported pattern is
  # `gpg --dearmor` into /usr/share/keyrings and `signed-by=` per source list.
  curl -fsSL "$CHIA_GPG_URL" | sudo gpg --batch --yes --dearmor -o /usr/share/keyrings/chia.gpg
  local arch
  arch=$(dpkg --print-architecture)
  local signed="deb [arch=${arch} signed-by=/usr/share/keyrings/chia.gpg]"
  # Remove any leftover *-test lists so a previous RC-targeted run can't pin
  # the new install to test sources unintentionally.
  sudo rm -f \
    /etc/apt/sources.list.d/chia-test.list \
    /etc/apt/sources.list.d/chia-blockchain-prerelease.list \
    /etc/apt/sources.list.d/cadt-test.list
  echo "${signed} https://repo.chia.net/debian/ stable main" |
    sudo tee /etc/apt/sources.list.d/chia.list >/dev/null
  if is_prerelease_version "$CHIA_APT_VER"; then
    echo "${signed} https://repo.chia.net/prerelease/debian/ prerelease main" |
      sudo tee /etc/apt/sources.list.d/chia-blockchain-prerelease.list >/dev/null
  fi
  echo "${signed} https://repo.chia.net/cadt/debian/ stable main" |
    sudo tee /etc/apt/sources.list.d/cadt.list >/dev/null
  if [[ "$CADT_APT_VER" == *-rc* ]]; then
    echo "${signed} https://repo.chia.net/cadt-test/debian/ stable main" |
      sudo tee /etc/apt/sources.list.d/cadt-test.list >/dev/null
  fi
  echo "${signed} https://repo.chia.net/chia-tools/debian/ stable main" |
    sudo tee /etc/apt/sources.list.d/chia-tools.list >/dev/null
  # shellcheck disable=SC2024
  sudo apt-get update -qq >>"$LOG_FILE" 2>&1
  spinner_stop 0
}

install_packages() {
  # Use the fallback-aware variant so a brand-new GitHub tag that hasn't
  # finished its apt build yet downshifts to the highest published version
  # on the same track instead of aborting the install.
  verify_or_fallback_apt_version chia-blockchain-cli CHIA_APT_VER
  verify_or_fallback_apt_version chia-tools TOOLS_APT_VER
  verify_or_fallback_apt_version cadt CADT_APT_VER

  local chia_spec="chia-blockchain-cli"
  local tools_spec="chia-tools"
  local cadt_spec="cadt"
  [[ -n "$CHIA_APT_VER" ]] && chia_spec="${chia_spec}=${CHIA_APT_VER}"
  [[ -n "$TOOLS_APT_VER" ]] && tools_spec="${tools_spec}=${TOOLS_APT_VER}"
  [[ -n "$CADT_APT_VER" ]] && cadt_spec="${cadt_spec}=${CADT_APT_VER}"

  spinner_start "Installing chia-blockchain-cli (${CHIA_APT_VER:-latest})"
  # shellcheck disable=SC2024
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y "$chia_spec" >>"$LOG_FILE" 2>&1
  spinner_stop 0

  spinner_start "Installing chia-tools (${TOOLS_APT_VER:-latest})"
  # shellcheck disable=SC2024
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y "$tools_spec" >>"$LOG_FILE" 2>&1
  spinner_stop 0

  spinner_start "Installing cadt (${CADT_APT_VER:-latest})"
  # shellcheck disable=SC2024
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y "$cadt_spec" >>"$LOG_FILE" 2>&1
  spinner_stop 0

  spinner_start "Installing nginx"
  # shellcheck disable=SC2024
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nginx >>"$LOG_FILE" 2>&1
  spinner_stop 0
}

prompt_public_address() {
  # Two responsibilities here:
  #   1. Acquire PUBLIC_ADDRESS (from --public-address or interactive prompt)
  #   2. Offer the HTTPS prompt for domain addresses in interactive mode
  # These were collapsed before with an early return that skipped the HTTPS
  # offer for preset addresses; keep them separate to make both consistent.
  if [[ "$TESTING_NO_PUBLIC_MIRROR" == true ]]; then
    warn_no_public_mirror
    if [[ "$ASSUME_YES" != true ]] && ! confirm "Is this really what you want?"; then
      TESTING_NO_PUBLIC_MIRROR=false
    elif [[ -z "$PUBLIC_ADDRESS" ]]; then
      LOCAL_ONLY=true
      return 0
    fi
  fi

  if [[ -z "$PUBLIC_ADDRESS" ]]; then
    if [[ "$ASSUME_YES" == true ]]; then
      die "--yes requires --public-address=<domain-or-ip> (no safe default)"
    fi

    while [[ -z "$PUBLIC_ADDRESS" ]]; do
      echo ""
      info "Public address for CADT and DataLayer file serving:"
      echo "  Enter a domain name (e.g. cadt.example.com)"
      echo "  Or press Enter to use this machine's public IP address"
      echo "  Type 'testing' to leave the DataLayer URL out of CADT config"
      echo ""
      local input=""
      read -r -p "Domain, IP, or testing: " input </dev/tty
      input=$(strip_url_scheme "$input")

      case "${input,,}" in
        testing | test-only | no-public-mirror)
          warn_no_public_mirror
          if confirm "Is this really what you want?"; then
            TESTING_NO_PUBLIC_MIRROR=true
            LOCAL_ONLY=true
            return 0
          fi
          continue
          ;;
      esac

      if [[ -z "$input" ]]; then
        local detected_ip=""
        spinner_start "Trying to get IP address automatically"
        detected_ip=$(curl -4 --max-time 8 -fsSL https://ip.chia.net 2>/dev/null || echo "")
        spinner_stop 0

        if [[ -n "$detected_ip" ]] && is_ipv4 "$detected_ip"; then
          local ip_ok=""
          read -r -p "Detected IP: ${detected_ip} — is this correct? [Y/n]: " ip_ok </dev/tty
          if [[ -z "$ip_ok" || "${ip_ok,,}" == "y" || "${ip_ok,,}" == "yes" ]]; then
            PUBLIC_ADDRESS="$detected_ip"
          fi
        fi

        if [[ -z "$PUBLIC_ADDRESS" ]]; then
          while true; do
            read -r -p "Enter this machine's public IP address: " input </dev/tty
            input=$(strip_url_scheme "$input")
            if is_ipv4 "$input"; then
              PUBLIC_ADDRESS="$input"
              break
            fi
            echo "  Invalid IP address. Please enter a valid IPv4 address (e.g. 203.0.113.10)"
          done
        fi
      else
        PUBLIC_ADDRESS="$input"
      fi
    done
  fi

  # Both paths converge here so validation and the HTTPS prompt fire whether
  # the address came from --public-address or the interactive read above.
  validate_public_address "$PUBLIC_ADDRESS" || die "Invalid public address: $PUBLIC_ADDRESS"

  if is_ipv4 "$PUBLIC_ADDRESS"; then
    echo ""
    warn "This should be a static IP address, such as an AWS Elastic IP address."
    echo ""
  fi

  if is_domain "$PUBLIC_ADDRESS" && [[ "$ENABLE_HTTPS" != true && "$ASSUME_YES" != true ]]; then
    if confirm "Enable HTTPS with Let's Encrypt for ${PUBLIC_ADDRESS}?"; then
      ENABLE_HTTPS=true
      warn "Port 80 and 443 must be open and reachable from the internet for certificate issuance."
    fi
  fi
}

run_prompts() {
  if [[ -z "$NETWORK" ]]; then
    echo ""
    info "Chia network for CADT:"
    echo "  1) mainnet (production)"
    echo "  2) testneta (recommended for testing)"
    local npick
    prompt_default npick "Choice" "1"
    case "$npick" in
      2 | testneta) NETWORK=testneta ;;
      *) NETWORK=mainnet ;;
    esac
  fi
  validate_network "$NETWORK"
  validate_testing_no_public_mirror_network

  if [[ -z "$CHIA_APT_VER" ]]; then
    prompt_version_choice "chia-blockchain-cli" "$GH_API_CHIA" CHIA_VERSION_CHOICE CHIA_APT_VER true
  fi
  if [[ -z "$TOOLS_APT_VER" ]]; then
    prompt_version_choice "chia-tools" "$GH_API_TOOLS" CHIA_TOOLS_VERSION_CHOICE TOOLS_APT_VER false
  fi
  if [[ -z "$CADT_APT_VER" ]]; then
    prompt_version_choice "cadt" "$GH_API_CADT" CADT_VERSION_CHOICE CADT_APT_VER true
  fi
  validate_supported_apt_versions

  prompt_public_address
  validate_testing_no_public_mirror_network

  if [[ -z "$KEY_MODE" ]]; then
    echo ""
    info "Chia wallet key:"
    echo "  g) Generate new key"
    echo "  i) Import existing 24-word mnemonic"
    local kpick
    prompt_default kpick "Choice" "g"
    case "${kpick,,}" in
      i | import) KEY_MODE=import ;;
      *) KEY_MODE=generate ;;
    esac
  fi

  if [[ -z "$READ_ONLY" ]]; then
    if [[ "$ASSUME_YES" == true ]]; then
      READ_ONLY=false
    elif confirm "Run CADT in read-only (observer) mode?"; then
      READ_ONLY=true
    else
      READ_ONLY=false
    fi
  fi

  if [[ -z "$CADT_API_KEY" && "$READ_ONLY" != true ]]; then
    if [[ "$ASSUME_YES" == true ]]; then
      CADT_API_KEY=$(openssl rand -hex 24)
    else
      echo ""
      info "CADT API key (for UI and API access):"
      echo "  a) Auto-generate (recommended)"
      echo "  e) Enter manually"
      echo "  s) Skip (leave blank)"
      local apick
      prompt_default apick "Choice" "a"
      case "${apick,,}" in
        e)
          read -r -s -p "API key: " CADT_API_KEY </dev/tty
          printf '\n' >/dev/tty
          ;;
        s) CADT_API_KEY="" ;;
        *) CADT_API_KEY=$(openssl rand -hex 24) ;;
      esac
    fi
  elif [[ -z "$CADT_API_KEY" ]]; then
    CADT_API_KEY=""
  fi

  build_datalayer_url
  build_public_url

  if [[ "$ASSUME_YES" != true ]]; then
    echo ""
    info "Installation summary:"
    echo "  Network:              ${NETWORK}"
    echo "  chia-blockchain-cli:  ${CHIA_APT_VER:-latest}"
    echo "  chia-tools:           ${TOOLS_APT_VER:-latest}"
    echo "  cadt:                 ${CADT_APT_VER:-latest}"
    echo "  Public address:       ${PUBLIC_ADDRESS}"
    echo "  DataLayer URL:        ${DATALAYER_URL:-'(blank; not advertised)'}"
    echo "  HTTPS:                ${ENABLE_HTTPS}"
    echo "  Local-only:           ${LOCAL_ONLY}"
    echo "  DataLayer advertised: $([[ "$TESTING_NO_PUBLIC_MIRROR" == true ]] && echo disabled || echo enabled)"
    echo "  Key:                  ${KEY_MODE}"
    echo "  Read-only:            ${READ_ONLY}"
    echo "  CADT API key:         $([[ -n "$CADT_API_KEY" ]] && echo '(set)' || echo '(none)')"
    echo ""
    confirm "Proceed with installation?" || die "Aborted by user."
  fi
}

get_chia_network_dir() {
  local net=""
  # `|| true` so a missing `selected_network:` line (grep exit 1 under
  # pipefail) doesn't ERR-trap — we already have a $NETWORK fallback below.
  if [[ -f "${CHIA_ROOT}/config/config.yaml" ]]; then
    net=$(grep -E '^selected_network:' "${CHIA_ROOT}/config/config.yaml" | awk '{print $2}' || true)
  fi
  net="${net:-$NETWORK}"
  echo "$net"
}

init_chia() {
  info "Initializing Chia..."
  chia init
  success "Chia initialized at ${CHIA_ROOT}"

  if [[ "$KEY_MODE" == "generate" ]]; then
    setup_chia_keys_generate
  else
    setup_chia_keys_import
  fi

  if [[ "$NETWORK" == "testneta" ]]; then
    info "Switching Chia network to testneta..."
    chia-tools network switch testneta
    success "Network set to testneta"
  fi
}

extract_mnemonic_line() {
  # chia keys generate_and_print emits three lines (header / 24-word seed /
  # footer). Filter for the line that has exactly 24 whitespace-separated
  # words so we don't feed header text into `chia keys add -f`.
  awk 'NF == 24 { print; exit }'
}

format_mnemonic_for_display() {
  local mnemonic="$1"
  printf '  %s\n' "$mnemonic"
}

add_chia_key_from_mnemonic() {
  # Shared post-mnemonic logic for both generate and import paths.
  #   $1 mnemonic       — the validated 24-word seed
  #   $2 label          — keychain label ("CADT")
  #   $3 failure_hint   — log-safe message for the operator on failure
  # `chia keys add -f` swallows its own errors and exits 0, so we must
  # inspect stdout for the "Added private key" success marker. We never
  # echo add_output through die because mnemonic-validity errors can echo
  # parts of the seed and die's message is tee'd to the install log.
  local mnemonic="$1" label="$2" failure_hint="$3"
  local tmpkey
  tmpkey=$(mktemp)
  chmod 600 "$tmpkey"
  register_tmp_file "$tmpkey"
  printf '%s\n' "$mnemonic" >"$tmpkey"
  local add_output
  add_output=$(chia keys add -f "$tmpkey" -l "$label" 2>&1) || true
  rm -f "$tmpkey"
  if ! grep -q "Added private key" <<<"$add_output"; then
    die "$failure_hint"
  fi
}

setup_chia_keys_generate() {
  info "Generating new Chia wallet key..."

  local raw mnemonic
  # `|| true` so a non-zero exit from `chia keys generate_and_print` (e.g.,
  # locked keychain, missing chia binary) falls through to our descriptive
  # die below instead of tripping the ERR trap with a generic line-number
  # failure. Same pattern as verify_or_fallback_apt_version.
  raw=$(chia keys generate_and_print 2>/dev/null | tr -d '\r' || true)
  [[ -n "$raw" ]] || die "Failed to generate mnemonic (chia keys generate_and_print produced no output)"
  mnemonic=$(printf '%s\n' "$raw" | extract_mnemonic_line)
  [[ -n "$mnemonic" ]] || die "Could not parse 24-word mnemonic from chia keys output"

  if [[ -n "$MNEMONIC_OUTPUT_FILE" ]]; then
    write_mnemonic_to_output_file "$mnemonic" "$MNEMONIC_OUTPUT_FILE"
  fi

  if [[ "$ASSUME_YES" != true ]]; then
    private_echo ""
    private_echo "${C_RED}╔══════════════════════════════════════════════════════════════╗${C_RESET}"
    private_echo "${C_RED}║  WRITE DOWN YOUR 24-WORD MNEMONIC                           ║${C_RESET}"
    private_echo "${C_RED}║  THIS IS THE KEY TO ALL YOUR CADT DATA                      ║${C_RESET}"
    private_echo "${C_RED}╚══════════════════════════════════════════════════════════════╝${C_RESET}"
    private_echo ""
    private_echo "You cannot recover ownership of your data without this key."
    private_echo "To see it at any time, run: ${C_BOLD}chia keys show --show-mnemonic-seed${C_RESET}"
    private_echo ""
    private_echo "${C_YELLOW}${C_BOLD}$(format_mnemonic_for_display "$mnemonic")${C_RESET}"
    private_echo ""
    local confirm_phrase="CONTINUE"
    local typed=""
    while [[ "$typed" != "$confirm_phrase" ]]; do
      read -r -p "Type CONTINUE when you have your mnemonic stored securely: " typed </dev/tty
    done
  fi

  add_chia_key_from_mnemonic "$mnemonic" "CADT" \
    "chia keys add did not add the key. Re-run the installer; if this persists, check 'chia keys show' state and that the keyring is unlocked."
  success "Chia key added to keychain"
}

setup_chia_keys_import() {
  local mnemonic=""
  if [[ -n "$IMPORT_KEY_FILE" ]]; then
    [[ -f "$IMPORT_KEY_FILE" ]] || die "Key file not found: $IMPORT_KEY_FILE"
    mnemonic=$(normalize_mnemonic_file "$IMPORT_KEY_FILE")
  elif [[ "$ASSUME_YES" != true ]]; then
    read -r -s -p "Enter 24-word mnemonic: " mnemonic </dev/tty
    printf '\n' >/dev/tty
  else
    die "--import-key-from-file is required with --yes for key import"
  fi
  [[ -n "$mnemonic" ]] || die "Empty mnemonic"

  add_chia_key_from_mnemonic "$mnemonic" "CADT" \
    "chia keys add did not import the key (check that the mnemonic file is exactly 12/15/18/21/24 words)"
  success "Chia key imported"
}

start_chia_services() {
  info "Starting Chia services (full node, wallet, data layer)..."
  sudo systemctl daemon-reload
  sudo systemctl enable --now \
    "chia-full-node@${USER}" \
    "chia-wallet@${USER}" \
    "chia-data-layer@${USER}"

  local net dir elapsed=0
  net=$(get_chia_network_dir)
  dir="${CHIA_ROOT}/data_layer/db/server_files_location_${net}"

  spinner_start "Waiting for chia-data-layer to initialize"
  while [[ ! -d "$dir" ]] && [[ "$elapsed" -lt 120 ]]; do
    sleep 2
    elapsed=$((elapsed + 2))
  done
  if [[ ! -d "$dir" ]]; then
    spinner_stop 1
    die "Timed out waiting for ${dir}"
  fi
  spinner_stop 0
}

grant_nginx_acl_for_path() {
  local path="$1"
  local current="/"
  IFS='/' read -r -a parts <<<"${path#/}"

  for ((i = 0; i < ${#parts[@]} - 1; i++)); do
    [[ -z "${parts[$i]}" ]] && continue
    current="${current%/}/${parts[$i]}"
    sudo setfacl -m u:www-data:--x "$current"
  done
  sudo setfacl -R -m u:www-data:rX "$path"
}

grant_nginx_access_to_datalayer_root() {
  local path="$1"
  local resolved
  grant_nginx_acl_for_path "$path"

  resolved=$(readlink -f "$path" 2>/dev/null || true)
  if [[ -n "$resolved" && "$resolved" != "$path" ]]; then
    grant_nginx_acl_for_path "$resolved"
  fi
}

setup_datalayer_directory() {
  local net="$1"
  local src="${CHIA_ROOT}/data_layer/db/server_files_location_${net}"
  local dst="${DATALAYER_WWW_ROOT}/server_files_location_${net}"

  info "Setting up DataLayer file directory..."

  # data-layer must be stopped before moving its server_files dir; otherwise
  # in-flight writes can race with the mv and end up in the wrong tree.
  sudo systemctl stop "chia-data-layer@${USER}"

  if [[ -L "$src" ]]; then
    sudo rm -f "$src"
  elif [[ -d "$src" ]]; then
    sudo mkdir -p "$dst"
    sudo cp -a "$src/." "$dst/"
    sudo rm -rf "$src"
  else
    sudo mkdir -p "$dst"
  fi

  sudo mkdir -p "$dst"
  sudo chown -R "${USER}:${USER}" "$dst"
  sudo find "$dst" -type d -exec chmod 755 {} \;
  sudo find "$dst" -type f -exec chmod 644 {} \; 2>/dev/null || true
  grant_nginx_access_to_datalayer_root "$dst"
  ln -sfn "$dst" "$src"

  # systemd's default UMask is 0022 on most distros but some images ship 0077,
  # which produces 600 files under /var/www that nginx (running as www-data)
  # cannot read. Pin UMask explicitly so /data/ stays world-readable.
  sudo mkdir -p "/etc/systemd/system/chia-data-layer@${USER}.service.d"
  sudo tee "/etc/systemd/system/chia-data-layer@${USER}.service.d/umask.conf" >/dev/null <<EOF
[Service]
UMask=0022
EOF
  sudo systemctl daemon-reload

  success "DataLayer files at ${dst} (symlinked from ${src})"
}

write_nginx_http_config() {
  # /data/ serves the DataLayer public file tree relocated by
  # setup_datalayer_directory. The conditional `location /` proxy block is
  # omitted when --local-only is set so the CADT API stays bound to
  # 127.0.0.1:31310 and is never reachable through nginx.
  local net="$1"
  local dst="${DATALAYER_WWW_ROOT}/server_files_location_${net}"

  sudo mkdir -p "$CERTBOT_WEBROOT"

  sudo tee /etc/nginx/sites-available/cadt >/dev/null <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${PUBLIC_ADDRESS};

    location /.well-known/acme-challenge/ {
        root ${CERTBOT_WEBROOT};
    }

    location /data/ {
        alias ${dst}/;
        autoindex off;
        expires 30d;
        add_header Cache-Control "public";
    }
$(if [[ "$LOCAL_ONLY" != true ]]; then
    cat <<'PROXY'

    location / {
        proxy_pass http://127.0.0.1:31310;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_read_timeout 90s;
    }
PROXY
  fi)
}
EOF
}

write_nginx_https_config() {
  # HTTPS layout: port 80 keeps the ACME-challenge alias for cert renewal
  # but 301-redirects everything else to https://. The real CADT proxy and
  # /data/ alias live in the 443 server block below.
  local net="$1"
  local dst="${DATALAYER_WWW_ROOT}/server_files_location_${net}"

  sudo tee /etc/nginx/sites-available/cadt >/dev/null <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${PUBLIC_ADDRESS};

    location /.well-known/acme-challenge/ {
        root ${CERTBOT_WEBROOT};
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${PUBLIC_ADDRESS};

    ssl_certificate /etc/letsencrypt/live/${PUBLIC_ADDRESS}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${PUBLIC_ADDRESS}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;
    add_header Strict-Transport-Security "max-age=63072000" always;

    location /data/ {
        alias ${dst}/;
        autoindex off;
        expires 30d;
        add_header Cache-Control "public";
    }
$(if [[ "$LOCAL_ONLY" != true ]]; then
    cat <<'PROXY'

    location / {
        proxy_pass http://127.0.0.1:31310;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_read_timeout 90s;
    }
PROXY
  fi)
}
EOF
}

configure_nginx() {
  local net="$1"

  info "Configuring nginx..."

  # Phase 1: write HTTP config and start nginx
  write_nginx_http_config "$net"

  sudo rm -f /etc/nginx/sites-enabled/default
  sudo ln -sf /etc/nginx/sites-available/cadt /etc/nginx/sites-enabled/cadt
  sudo nginx -t
  # shellcheck disable=SC2024
  sudo systemctl enable nginx >>"$LOG_FILE" 2>&1
  sudo systemctl restart nginx

  # Phase 2: if HTTPS requested, run certbot then write final config
  if [[ "$ENABLE_HTTPS" == true ]]; then
    setup_certbot "$net"
  fi

  sudo systemctl start "chia-data-layer@${USER}"

  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1/data/" || echo "000")
  # Acceptable codes: 404 (empty tree, no files yet), 200 (autoindex), 403
  # (autoindex off + dir), 301 (HTTPS redirect took over). Anything else
  # means nginx is broken or didn't apply the config we generated.
  if [[ "$code" != "404" && "$code" != "200" && "$code" != "403" && "$code" != "301" ]]; then
    die "nginx smoke test failed (HTTP ${code} on /data/)"
  fi
  success "nginx configured (public address: ${PUBLIC_ADDRESS})"
}

setup_certbot() {
  local net="$1"

  info "Setting up HTTPS with Let's Encrypt..."

  spinner_start "Installing certbot"
  # shellcheck disable=SC2024
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y certbot >>"$LOG_FILE" 2>&1
  spinner_stop 0

  sudo mkdir -p "$CERTBOT_WEBROOT"

  local certbot_args=(
    certonly
    --webroot
    -w "$CERTBOT_WEBROOT"
    -d "$PUBLIC_ADDRESS"
    --non-interactive
    --agree-tos
    --register-unsafely-without-email
    --deploy-hook "systemctl reload nginx"
  )

  if [[ "$CERTBOT_DRY_RUN" == true ]]; then
    certbot_args+=(--dry-run)
  fi

  spinner_start "Obtaining SSL certificate"
  # shellcheck disable=SC2024
  if sudo certbot "${certbot_args[@]}" >>"$LOG_FILE" 2>&1; then
    spinner_stop 0

    if [[ "$CERTBOT_DRY_RUN" != true ]]; then
      write_nginx_https_config "$net"
      sudo nginx -t
      sudo systemctl reload nginx
      success "HTTPS enabled with Let's Encrypt"
    else
      # Dry-run never installed certs — flip HTTPS back off and rebuild the
      # http:// URLs so the install summary, CADT config, and datalayer URL
      # all reflect what's actually live on disk.
      ENABLE_HTTPS=false
      build_datalayer_url
      build_public_url
      success "Certbot dry-run succeeded (HTTPS config not applied)"
    fi
  else
    spinner_stop 1
    # Certbot failure (rate-limit, port 80 unreachable, DNS) — fall back to
    # HTTP only and rebuild URLs so config/summary match the live nginx.
    warn "Certbot failed — continuing with HTTP only. Check log for details."
    ENABLE_HTTPS=false
    build_datalayer_url
    build_public_url
  fi
}

patch_cadt_config() {
  local governance_id="$GOVERNANCE_MAINNET"
  if [[ "$NETWORK" == "testneta" ]]; then
    governance_id="$GOVERNANCE_TESTNETA"
  fi

  # Values pass via env vars and the heredoc is single-quoted ('PY') so bash
  # never interpolates them into the Python source. This is what keeps API
  # keys with `, ', ", $, \ from being executed as Python or shell.
  CADT_CONFIG_PATH="$CADT_CONFIG" \
    CADT_NETWORK="$NETWORK" \
    CADT_DATALAYER_URL="$DATALAYER_URL" \
    CADT_GOVERNANCE_ID="$governance_id" \
    CADT_READ_ONLY="$READ_ONLY" \
    CADT_API_KEY_VALUE="$CADT_API_KEY" \
    python3 <<'PY'
import os
import yaml
from pathlib import Path

path = Path(os.environ["CADT_CONFIG_PATH"])
with path.open() as f:
    cfg = yaml.safe_load(f)

api_key = os.environ["CADT_API_KEY_VALUE"] or None
read_only = os.environ["CADT_READ_ONLY"] == "true"

cfg.setdefault("APP", {})["CHIA_NETWORK"] = os.environ["CADT_NETWORK"]
cfg["APP"]["DATALAYER_FILE_SERVER_URL"] = os.environ["CADT_DATALAYER_URL"]
# Lock CADT to loopback so the API is never exposed without nginx in front.
# nginx handles TLS termination, proxy headers, and (optionally) reverse
# proxying — direct public exposure of CADT's HTTP port is intentionally not
# supported by this installer.
cfg["APP"]["BIND_ADDRESS"] = "127.0.0.1"

for section in ("V1", "V2"):
    cfg.setdefault(section, {})
    cfg[section]["READ_ONLY"] = read_only
    cfg[section]["CADT_API_KEY"] = api_key
    cfg[section].setdefault("GOVERNANCE", {})["GOVERNANCE_BODY_ID"] = os.environ["CADT_GOVERNANCE_ID"]

with path.open("w") as f:
    yaml.dump(cfg, f, default_flow_style=False, sort_keys=False)
PY

  python3 -c "import yaml; yaml.safe_load(open('${CADT_CONFIG}'))"
  success "CADT config updated"
}

start_cadt_and_wait() {
  # CADT's bootstrap sequence is unusual: the package doesn't ship a config,
  # so we must start the service once to make CADT write its default
  # config.yaml, then stop it, patch the file in place, and re-enable. Doing
  # it in this order means our governance / network / API-key edits survive
  # the next service restart instead of being clobbered.
  info "Starting CADT to generate initial configuration..."
  sudo systemctl start "cadt@${USER}"

  local elapsed=0
  spinner_start "Waiting for CADT config file"
  while [[ ! -f "$CADT_CONFIG" ]] && [[ "$elapsed" -lt 60 ]]; do
    sleep 2
    elapsed=$((elapsed + 2))
  done
  if [[ ! -f "$CADT_CONFIG" ]]; then
    spinner_stop 1
    sudo systemctl status "cadt@${USER}" --no-pager -l || true
    sudo journalctl -u "cadt@${USER}" --no-pager -n 200 || true
    die "Timed out waiting for ${CADT_CONFIG}"
  fi
  spinner_stop 0

  sudo systemctl stop "cadt@${USER}"
  patch_cadt_config

  sudo systemctl enable --now "cadt@${USER}"

  elapsed=0
  spinner_start "Waiting for CADT API"
  local health_args
  cadt_health_curl_args health_args
  while [[ "$elapsed" -lt 120 ]]; do
    if curl "${health_args[@]}" >/dev/null 2>&1; then
      spinner_stop 0
      success "CADT API is responding"
      return 0
    fi
    sleep 3
    elapsed=$((elapsed + 3))
  done
  spinner_stop 1
  sudo journalctl -u "cadt@${USER}" --no-pager -n 100 || true
  die "CADT API did not become ready in time"
}

print_final_summary() {
  local governance_id="$GOVERNANCE_MAINNET"
  [[ "$NETWORK" == "testneta" ]] && governance_id="$GOVERNANCE_TESTNETA"

  echo ""
  echo -e "${C_GREEN}╔══════════════════════════════════════════════════════════════╗${C_RESET}"
  echo -e "${C_GREEN}║           CADT installation complete                        ║${C_RESET}"
  echo -e "${C_GREEN}╚══════════════════════════════════════════════════════════════╝${C_RESET}"
  echo ""
  info "Services"
  for svc in chia-full-node chia-wallet chia-data-layer cadt nginx; do
    local st
    if [[ "$svc" == "nginx" ]]; then
      st=$(systemctl is-active nginx 2>/dev/null || echo unknown)
    else
      st=$(systemctl is-active "${svc}@${USER}" 2>/dev/null || echo unknown)
    fi
    echo "  ${svc}: ${st}"
  done
  echo ""
  echo "  View CADT logs:    journalctl -u cadt@${USER} -f"
  echo "  Chia sync status:  chia show -s"
  echo ""
  info "Endpoints"
  if [[ "$LOCAL_ONLY" != true ]]; then
    echo "  CADT API (public): ${PUBLIC_URL}"
  fi
  echo "  CADT API (local):  http://localhost:31310"
  if [[ "$TESTING_NO_PUBLIC_MIRROR" == true ]]; then
    if [[ -n "$PUBLIC_ADDRESS" ]]; then
      echo "  DataLayer files:   ${PUBLIC_URL}/data"
      echo "                     not advertised in CADT config (testing only)"
    else
      echo "  DataLayer files:   not advertised in CADT config (testing only)"
      echo "                     no public DataLayer file server configured"
    fi
  else
    echo "  DataLayer files:   ${DATALAYER_URL}"
  fi
  echo "  Network:           ${NETWORK}"
  echo "  Governance ID:     ${governance_id}"
  if [[ -n "$CADT_API_KEY" ]]; then
    private_literal "  API key:           ${CADT_API_KEY}"
  else
    echo "  API key:           (not set)"
  fi
  echo ""
  if [[ -n "$PUBLIC_ADDRESS" ]] && is_domain "$PUBLIC_ADDRESS"; then
    info "DNS"
    echo "  Ensure DNS for '${PUBLIC_ADDRESS}' points to this machine."
    echo ""
  fi
  if [[ "$TESTING_NO_PUBLIC_MIRROR" == true ]]; then
    warn_no_public_mirror
    echo ""
  fi
  info "Next steps — home organization"
  echo "  Wait until 'chia show -s' reports synced before creating a home org."
  if [[ "$NETWORK" == "testneta" ]]; then
    echo "  Get test TXCH from the current testneta faucet for your environment."
  fi

  local api_url="http://localhost:31310"
  if [[ "$LOCAL_ONLY" != true ]]; then
    api_url="$PUBLIC_URL"
  fi
  echo "  Create home org (v2):"
  echo "    curl -X POST ${api_url}/v2/organizations \\"
  echo "      -H 'Content-Type: application/json' \\"
  if [[ -n "$CADT_API_KEY" ]]; then
    echo "      -H 'x-api-key: <api-key>' \\"
  fi
  echo "      -d '{\"name\":\"My Organization\"}'"
  echo ""
  echo "  Install log: ${LOG_FILE}"
  echo ""
  echo "  Full node sync may take days on mainnet; CADT writes may fail until synced."
}

main() {
  echo -e "${C_BOLD}${C_BLUE}"
  cat <<'BANNER'
   ____    _    ____ _____
  / ___|  / \  |  _ \_   _|
 | |     / _ \ | | | || |
 | |___ / ___ \| |_| || |
  \____/_/   \_\____/ |_|

  Automated Installer
BANNER
  echo -e "${C_RESET}"

  parse_args "$@"
  # Order matters: root is a more fundamental misuse than flag omissions,
  # so refuse_root must precede validate_yes_args. Both run before any
  # system mutation (sudo keepalive, apt) so abort paths are clean.
  refuse_root
  validate_yes_args
  validate_min_disk_gb
  require_sudo
  setup_logging

  phase "Phase 0: Preflight checks"
  check_os
  check_architecture
  check_min_specs
  check_existing_install

  # Bootstrap tools needed before any user-facing configuration:
  # jq+curl power version resolution; openssl powers --yes API key gen;
  # python3/python3-yaml power the config patch later. Doing it here means
  # Phase 1 (or prompts) can rely on these binaries existing.
  install_prerequisites

  phase "Phase 1: Configuration"
  # Single entry point regardless of how many flags were supplied. run_prompts
  # is fully no-op safe when all values are preset: prompt_version_choice
  # resolves flag-only inputs without prompting, prompt_default honors
  # ASSUME_YES, prompt_public_address still validates + offers HTTPS on a
  # preset domain, and the summary/confirm block at the end is gated by --yes.
  run_prompts

  phase "Phase 2: Installing packages"
  setup_apt_repos
  install_packages

  phase "Phase 3: Initializing Chia"
  init_chia

  phase "Phase 4: Starting Chia services"
  start_chia_services
  local net
  net=$(get_chia_network_dir)

  if [[ "$TESTING_NO_PUBLIC_MIRROR" == true && -z "$PUBLIC_ADDRESS" ]]; then
    phase "Phase 5: Skipping public DataLayer mirror"
    warn_no_public_mirror
  else
    phase "Phase 5: Configuring nginx"
    setup_datalayer_directory "$net"
    configure_nginx "$net"
  fi

  phase "Phase 6: Configuring and starting CADT"
  start_cadt_and_wait

  phase "Phase 7: Complete"
  print_final_summary

  cleanup_background_processes
}

if [[ "${INSTALL_OMNIBUS_LIB_ONLY:-0}" == 1 ]]; then
  # shellcheck disable=SC2317
  return 0 2>/dev/null || exit 0
fi

main "$@"
