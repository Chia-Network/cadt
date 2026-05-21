#!/usr/bin/env bash
#
# CADT Omnibus Installer
# Installs Chia (CLI), chia-tools, CADT, nginx datalayer file server, and configures CADT.
#
# Usage:
#   ./tools/install-omnibus.sh [OPTIONS]
#
# Run as a non-root user with sudo access. See --help for flags.

set -Eeuo pipefail

readonly SCRIPT_VERSION="1.0.0"
readonly GOVERNANCE_MAINNET="23f6498e015ebcd7190c97df30c032de8deb5c8934fc1caa928bc310e2b8a57e"
readonly GOVERNANCE_TESTNETA="1019153f631bb82e7fc4984dc1f0f2af9e95a7c29df743f7b4dcc2b975857409"
readonly CHIA_GPG_URL="https://repo.chia.net/FD39E6D3.pubkey.asc"
readonly GH_API_CHIA="https://api.github.com/repos/Chia-Network/chia-blockchain/releases"
readonly GH_API_TOOLS="https://api.github.com/repos/Chia-Network/chia-tools/releases"
readonly GH_API_CADT="https://api.github.com/repos/Chia-Network/cadt/releases"
readonly CHIA_ROOT="${HOME}/.chia/mainnet"
readonly CADT_CONFIG="${CHIA_ROOT}/cadt/config.yaml"
readonly MIN_CPU_CORES=4
readonly MIN_RAM_KIB=$((7680 * 1024)) # 7.5 GiB
readonly DEFAULT_MIN_DISK_GIB=300
readonly SPINNER_CHARS="|/-\\"

# Configurable via flags
NETWORK=""
CHIA_VERSION_CHOICE=""
CHIA_TOOLS_VERSION_CHOICE=""
CADT_VERSION_CHOICE=""
DATALAYER_HOST=""
DATALAYER_PORT=80
READ_ONLY=""
CADT_API_KEY=""
KEY_MODE="" # generate | import
IMPORT_KEY_FILE=""
MNEMONIC_OUTPUT_FILE=""
MIN_DISK_GIB="${DEFAULT_MIN_DISK_GIB}"
ASSUME_YES=false
WARN_DNS=0

CHIA_APT_VER=""
TOOLS_APT_VER=""
CADT_APT_VER=""
DATALAYER_URL=""
LOG_FILE=""
PRIVATE_FD=3

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

normalize_apt_version() {
  local tag="$1"
  echo "$tag"
}

denormalize_tag_from_apt() {
  local ver="$1"
  if [[ "$ver" =~ ~rc ]]; then
    echo "${ver/~rc/-rc}"
  else
    echo "$ver"
  fi
}

is_ipv4() {
  local host="$1"
  [[ "$host" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]
}

validate_datalayer_host() {
  local host="$1"
  WARN_DNS=0
  if is_ipv4 "$host"; then
    return 0
  fi
  if [[ "$host" == *:* ]]; then
    # crude IPv6 bracket check
    return 0
  fi
  WARN_DNS=1
  return 0
}

meets_min_specs() {
  local cpu="$1" mem_kib="$2" disk_gib="$3" min_disk="$4"
  [[ "$cpu" -ge "${MIN_CPU_CORES}" ]] || return 1
  [[ "$mem_kib" -ge "${MIN_RAM_KIB}" ]] || return 1
  [[ "$disk_gib" -ge "$min_disk" ]] || return 1
  return 0
}

is_soft_spec_shortfall() {
  local cpu="$1" mem_kib="$2" disk_root="$3" disk_home="$4"
  [[ "$cpu" -ge "$((MIN_CPU_CORES - 1))" ]] || return 1
  [[ "$mem_kib" -ge "$((MIN_RAM_KIB * 9 / 10))" ]] || return 1
  [[ "$disk_root" -ge "$((MIN_DISK_GIB * 9 / 10))" ]] || return 1
  [[ "$disk_home" -ge "$((MIN_DISK_GIB * 9 / 10))" ]] || return 1
  return 0
}

validate_network() {
  local network="$1"
  [[ "$network" == "mainnet" || "$network" == "testneta" ]] ||
    die "Invalid network: $network"
}

apply_config_defaults() {
  [[ -z "$KEY_MODE" ]] && KEY_MODE=generate
  [[ -z "$READ_ONLY" ]] && READ_ONLY=false
  if [[ -z "$CADT_API_KEY" && "$READ_ONLY" != true ]]; then
    CADT_API_KEY=$(openssl rand -hex 24)
  fi
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
  if [[ "$CHIA_APT_VER" == *~rc* || "$CHIA_APT_VER" == *-rc* ]]; then
    die "chia-blockchain-cli prerelease apt packages are not supported; choose stable or an explicit stable tag."
  fi
  if [[ "$TOOLS_APT_VER" == *~rc* || "$TOOLS_APT_VER" == *-rc* ]]; then
    die "chia-tools prerelease apt packages are not supported; choose stable or an explicit stable tag."
  fi
}

cadt_health_curl_args() {
  local -n args_ref="$1"
  args_ref=(-fsS)
  if [[ -n "$CADT_API_KEY" ]]; then
    args_ref+=(-H "x-api-key: ${CADT_API_KEY}")
  fi
  args_ref+=("http://localhost:31310/v1/health")
}

pick_release_from_json() {
  # Usage: pick_release_from_json <json_file> <stable|prerelease|index>
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

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --network=*)
        NETWORK="${1#*=}"
        ;;
      --network)
        NETWORK="$2"
        shift
        ;;
      --chia-version=*)
        CHIA_VERSION_CHOICE="${1#*=}"
        ;;
      --chia-version)
        CHIA_VERSION_CHOICE="$2"
        shift
        ;;
      --chia-tools-version=*)
        CHIA_TOOLS_VERSION_CHOICE="${1#*=}"
        ;;
      --chia-tools-version)
        CHIA_TOOLS_VERSION_CHOICE="$2"
        shift
        ;;
      --cadt-version=*)
        CADT_VERSION_CHOICE="${1#*=}"
        ;;
      --cadt-version)
        CADT_VERSION_CHOICE="$2"
        shift
        ;;
      --datalayer-host=*)
        DATALAYER_HOST="${1#*=}"
        ;;
      --datalayer-host)
        DATALAYER_HOST="$2"
        shift
        ;;
      --read-only)
        READ_ONLY=true
        ;;
      --api-key=*)
        CADT_API_KEY="${1#*=}"
        ;;
      --api-key)
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
        KEY_MODE=import
        IMPORT_KEY_FILE="$2"
        shift
        ;;
      --mnemonic-output-file=*)
        MNEMONIC_OUTPUT_FILE="${1#*=}"
        ;;
      --mnemonic-output-file)
        MNEMONIC_OUTPUT_FILE="$2"
        shift
        ;;
      --min-disk-gb=*)
        MIN_DISK_GIB="${1#*=}"
        ;;
      --min-disk-gb)
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
  --chia-version=stable|<stable-tag>
  --chia-tools-version=stable|<stable-tag>
  --cadt-version=stable|prerelease|<tag>
  --datalayer-host=<hostname-or-ip>
  --read-only                      observer mode
  --api-key=<key>
  --generate-key                   generate a new Chia key
  --import-key-from-file=<path>  import mnemonic from file
  --mnemonic-output-file=<path>  write generated mnemonic here (not logged)
  --min-disk-gb=<n>              minimum free disk GiB (default: 300)
  --yes, -y                        skip confirmation prompts
  --help, -h
EOF
}

cleanup_background_processes() {
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

on_error() {
  local line="$1"
  cleanup_background_processes
  echo -e "\n${C_RED}Install failed at line ${line}.${C_RESET}" >&2
  if [[ -n "${LOG_FILE:-}" ]]; then
    echo -e "${C_DIM}See log: ${LOG_FILE}${C_RESET}" >&2
  fi
  echo "If this persists, share the log with the CADT team." >&2
  exit 1
}

if [[ "${INSTALL_OMNIBUS_LIB_ONLY:-0}" != 1 ]]; then
  trap 'on_error ${LINENO}' ERR
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

require_sudo() {
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
  df -BG "$path" 2>/dev/null | awk 'NR==2 { gsub(/G/,"",$4); print $4 }'
}

check_min_specs() {
  local cpu mem_kib disk_root disk_home
  cpu=$(nproc)
  mem_kib=$(awk '/MemTotal:/ {print $2}' /proc/meminfo)
  disk_root=$(get_free_disk_gib /)
  disk_home=$(get_free_disk_gib "${HOME}")

  info "System: ${cpu} CPUs, $((mem_kib / 1024 / 1024)) GiB RAM, ${disk_root} GiB free on /, ${disk_home} GiB free on \$HOME"

  if meets_min_specs "$cpu" "$mem_kib" "$disk_root" "$MIN_DISK_GIB" &&
    meets_min_specs "$cpu" "$mem_kib" "$disk_home" "$MIN_DISK_GIB"; then
    success "Meets minimum requirements (${MIN_DISK_GIB} GiB disk, ${MIN_CPU_CORES} CPUs, 8 GiB RAM)"
    return 0
  fi

  if is_soft_spec_shortfall "$cpu" "$mem_kib" "$disk_root" "$disk_home" &&
    confirm "System is slightly below recommended specs. Continue anyway?"; then
    warn "Continuing with below-minimum hardware."
    return 0
  fi

  die "System does not meet minimum requirements: ${MIN_CPU_CORES} CPUs, 8 GiB RAM, ${MIN_DISK_GIB} GiB free disk on / and \$HOME."
}

check_existing_install() {
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
  if systemctl list-unit-files 'chia-*@*.service' 2>/dev/null | grep -q enabled; then
    warn "Found enabled chia systemd units"
    found=true
  fi
  if systemctl list-unit-files 'cadt@*.service' 2>/dev/null | grep -q enabled; then
    warn "Found enabled cadt systemd units"
    found=true
  fi
  if [[ "$found" == true ]]; then
    die "An existing Chia or CADT install was detected. Remove packages and ~/.chia before re-running, or restore from a clean snapshot."
  fi
  success "No existing Chia/CADT install detected"
}

fetch_releases_json() {
  local url="$1" dest="$2"
  local auth=()
  if [[ -n "${GH_TOKEN:-}" ]]; then
    auth=(-H "Authorization: Bearer ${GH_TOKEN}")
  fi
  curl -fsSL "${auth[@]}" "$url" -o "$dest"
}

resolve_version_choice() {
  local choice="$1" json_file="$2" var_name="$3"
  local tag=""
  case "${choice,,}" in
    stable | latest)
      tag=$(pick_release_from_json "$json_file" stable)
      ;;
    prerelease | rc | pre-release)
      tag=$(pick_release_from_json "$json_file" prerelease)
      ;;
    *)
      tag="$choice"
      ;;
  esac
  [[ -n "$tag" ]] || die "Could not resolve version for choice: $choice"
  printf -v "$var_name" '%s' "$(normalize_apt_version "$tag")"
}

prompt_version_choice() {
  local label="$1" gh_url="$2" var_choice="$3" var_apt="$4"
  if [[ -n "${!var_apt}" ]]; then
    return 0
  fi
  local current="${!var_choice}"
  if [[ -n "$current" ]]; then
    local tmp
    tmp=$(mktemp)
    fetch_releases_json "$gh_url" "$tmp"
    resolve_version_choice "$current" "$tmp" "$var_apt"
    rm -f "$tmp"
    return 0
  fi

  local tmp
  tmp=$(mktemp)
  fetch_releases_json "$gh_url" "$tmp"

  echo ""
  info "Select ${label} version:"
  echo "  1) Latest stable"
  echo "  2) Latest pre-release"
  echo "  3) Pick from list"
  local pick
  prompt_default pick "Choice" "1"

  local tag=""
  case "$pick" in
    1) tag=$(pick_release_from_json "$tmp" stable) ;;
    2) tag=$(pick_release_from_json "$tmp" prerelease) ;;
    3)
      echo ""
      jq -r '.[] | select(.draft == false) | "\(.tag_name)\t\(if .prerelease then "pre-release" else "stable" end)"' "$tmp" |
        head -15 | nl -w2 -s') '
      local num
      prompt_default num "Enter number" "1"
      tag=$(pick_release_from_json "$tmp" "$num")
      ;;
    *) die "Invalid choice" ;;
  esac
  rm -f "$tmp"
  [[ -n "$tag" ]] || die "No release found for ${label}"
  printf -v "$var_apt" '%s' "$(normalize_apt_version "$tag")"
  success "${label}: ${tag} (apt: ${!var_apt})"
}

verify_apt_package_version() {
  local pkg="$1" ver="$2"
  if [[ -z "$ver" ]]; then
    return 0
  fi
  if apt-cache madison "$pkg" 2>/dev/null | awk -v v="$ver" '$3 == v {found=1} END {exit !found}'; then
    return 0
  fi
  die "Package ${pkg} version ${ver} not found in apt repositories. Try another version."
}

install_prerequisites() {
  spinner_start "Installing prerequisites"
  sudo apt-get update -qq >>"$LOG_FILE" 2>&1
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    curl ca-certificates gnupg jq openssl python3 python3-yaml >>"$LOG_FILE" 2>&1
  spinner_stop 0
}

setup_apt_repos() {
  spinner_start "Configuring Chia apt repositories"
  curl -fsSL "$CHIA_GPG_URL" | sudo gpg --batch --yes --dearmor -o /usr/share/keyrings/chia.gpg
  local arch
  arch=$(dpkg --print-architecture)
  local signed="deb [arch=${arch} signed-by=/usr/share/keyrings/chia.gpg]"
  sudo rm -f /etc/apt/sources.list.d/chia-test.list /etc/apt/sources.list.d/cadt-test.list
  echo "${signed} https://repo.chia.net/debian/ stable main" |
    sudo tee /etc/apt/sources.list.d/chia.list >/dev/null
  echo "${signed} https://repo.chia.net/cadt/debian/ stable main" |
    sudo tee /etc/apt/sources.list.d/cadt.list >/dev/null
  if [[ "$CADT_APT_VER" == *~rc* || "$CADT_APT_VER" == *-rc* ]]; then
    echo "${signed} https://repo.chia.net/cadt-test/debian/ stable main" |
      sudo tee /etc/apt/sources.list.d/cadt-test.list >/dev/null
  fi
  echo "${signed} https://repo.chia.net/chia-tools/debian/ stable main" |
    sudo tee /etc/apt/sources.list.d/chia-tools.list >/dev/null
  sudo apt-get update -qq >>"$LOG_FILE" 2>&1
  spinner_stop 0
}

install_packages() {
  verify_apt_package_version chia-blockchain-cli "$CHIA_APT_VER"
  verify_apt_package_version chia-tools "$TOOLS_APT_VER"
  verify_apt_package_version cadt "$CADT_APT_VER"

  local chia_spec="chia-blockchain-cli"
  local tools_spec="chia-tools"
  local cadt_spec="cadt"
  [[ -n "$CHIA_APT_VER" ]] && chia_spec="${chia_spec}=${CHIA_APT_VER}"
  [[ -n "$TOOLS_APT_VER" ]] && tools_spec="${tools_spec}=${TOOLS_APT_VER}"
  [[ -n "$CADT_APT_VER" ]] && cadt_spec="${cadt_spec}=${CADT_APT_VER}"

  spinner_start "Installing chia-blockchain-cli (${CHIA_APT_VER:-latest})"
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y "$chia_spec" >>"$LOG_FILE" 2>&1
  spinner_stop 0

  spinner_start "Installing chia-tools (${TOOLS_APT_VER:-latest})"
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y "$tools_spec" >>"$LOG_FILE" 2>&1
  spinner_stop 0

  spinner_start "Installing cadt (${CADT_APT_VER:-latest})"
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y "$cadt_spec" >>"$LOG_FILE" 2>&1
  spinner_stop 0

  spinner_start "Installing nginx"
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nginx >>"$LOG_FILE" 2>&1
  spinner_stop 0
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

  local tmpjson
  tmpjson=$(mktemp)
  if [[ -z "$CHIA_APT_VER" ]]; then
    if [[ -n "$CHIA_VERSION_CHOICE" ]]; then
      fetch_releases_json "$GH_API_CHIA" "$tmpjson"
      resolve_version_choice "$CHIA_VERSION_CHOICE" "$tmpjson" CHIA_APT_VER
    else
      CHIA_VERSION_CHOICE=""
      prompt_version_choice "chia-blockchain-cli" "$GH_API_CHIA" CHIA_VERSION_CHOICE CHIA_APT_VER
    fi
  fi

  if [[ -z "$TOOLS_APT_VER" ]]; then
    if [[ -n "$CHIA_TOOLS_VERSION_CHOICE" ]]; then
      fetch_releases_json "$GH_API_TOOLS" "$tmpjson"
      resolve_version_choice "$CHIA_TOOLS_VERSION_CHOICE" "$tmpjson" TOOLS_APT_VER
    else
      CHIA_TOOLS_VERSION_CHOICE=""
      prompt_version_choice "chia-tools" "$GH_API_TOOLS" CHIA_TOOLS_VERSION_CHOICE TOOLS_APT_VER
    fi
  fi

  if [[ -z "$CADT_APT_VER" ]]; then
    if [[ -n "$CADT_VERSION_CHOICE" ]]; then
      fetch_releases_json "$GH_API_CADT" "$tmpjson"
      resolve_version_choice "$CADT_VERSION_CHOICE" "$tmpjson" CADT_APT_VER
    else
      CADT_VERSION_CHOICE=""
      prompt_version_choice "cadt" "$GH_API_CADT" CADT_VERSION_CHOICE CADT_APT_VER
    fi
  fi
  rm -f "$tmpjson"
  validate_supported_apt_versions

  if [[ -z "$DATALAYER_HOST" ]]; then
    local default_ip=""
    default_ip=$(curl -fsSL --max-time 10 https://api.ipify.org 2>/dev/null || echo "127.0.0.1")
    prompt_default DATALAYER_HOST "DataLayer public hostname or IP" "$default_ip"
  fi
  validate_datalayer_host "$DATALAYER_HOST"
  if [[ "$WARN_DNS" -eq 1 ]]; then
    warn "DNS for '${DATALAYER_HOST}' must point to this machine so others can fetch your DataLayer files."
    confirm "Continue with hostname '${DATALAYER_HOST}'?" || die "Aborted."
  fi

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
  elif [[ -z "$CADT_API_KEY" ]]; then
    CADT_API_KEY=""
  fi

  build_datalayer_url

  if ! $ASSUME_YES; then
    echo ""
    info "Installation summary:"
    echo "  Network:              ${NETWORK}"
    echo "  chia-blockchain-cli:  ${CHIA_APT_VER:-latest}"
    echo "  chia-tools:           ${TOOLS_APT_VER:-latest}"
    echo "  cadt:                 ${CADT_APT_VER:-latest}"
    echo "  DataLayer URL:        ${DATALAYER_URL}"
    echo "  Key:                  ${KEY_MODE}"
    echo "  Read-only:            ${READ_ONLY}"
    echo "  CADT API key:         $([[ -n "$CADT_API_KEY" ]] && echo '(set)' || echo '(none)')"
    echo ""
    confirm "Proceed with installation?" || die "Aborted by user."
  fi
}

build_datalayer_url() {
  local host="$DATALAYER_HOST" port="$DATALAYER_PORT"
  if [[ "$port" == "80" ]]; then
    DATALAYER_URL="http://${host}"
  else
    DATALAYER_URL="http://${host}:${port}"
  fi
}

get_chia_network_dir() {
  local net
  if [[ -f "${CHIA_ROOT}/config/config.yaml" ]]; then
    net=$(grep -E '^selected_network:' "${CHIA_ROOT}/config/config.yaml" | awk '{print $2}')
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

setup_chia_keys_generate() {
  info "Generating new Chia wallet key..."

  if [[ "$ASSUME_YES" == true && -z "$MNEMONIC_OUTPUT_FILE" ]]; then
    chia keys generate -l "CADT"
    success "Chia key generated and added to keychain"
    return 0
  fi

  local mnemonic
  mnemonic=$(chia keys generate_and_print 2>/dev/null | tr -d '\r')
  [[ -n "$mnemonic" ]] || die "Failed to generate mnemonic"

  if [[ -n "$MNEMONIC_OUTPUT_FILE" ]]; then
    printf '%s\n' "$mnemonic" >"$MNEMONIC_OUTPUT_FILE"
    chmod 600 "$MNEMONIC_OUTPUT_FILE" 2>/dev/null || true
  fi

  if [[ "$ASSUME_YES" != true ]]; then
    private_echo ""
    private_echo "${C_RED}╔══════════════════════════════════════════════════════════════╗${C_RESET}"
    private_echo "${C_RED}║  WRITE DOWN YOUR 24-WORD MNEMONIC — IT CANNOT BE RECOVERED  ║${C_RESET}"
    private_echo "${C_RED}╚══════════════════════════════════════════════════════════════╝${C_RESET}"
    private_echo ""
    private_echo "$mnemonic"
    private_echo ""
    local confirm_phrase="I HAVE WRITTEN DOWN MY MNEMONIC"
    local typed=""
    while [[ "$typed" != "$confirm_phrase" ]]; do
      read -r -p "Type '${confirm_phrase}' to continue: " typed </dev/tty
    done
  fi

  local tmpkey
  tmpkey=$(mktemp)
  printf '%s\n' "$mnemonic" >"$tmpkey"
  chmod 600 "$tmpkey"
  chia keys add -f "$tmpkey" -l "CADT"
  rm -f "$tmpkey"
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
  local tmpkey
  tmpkey=$(mktemp)
  printf '%s\n' "$mnemonic" >"$tmpkey"
  chmod 600 "$tmpkey"
  chia keys add -f "$tmpkey" -l "CADT"
  rm -f "$tmpkey"
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

configure_nginx_datalayer() {
  local net="$1"
  local src="${CHIA_ROOT}/data_layer/db/server_files_location_${net}"
  local dst="/var/www/server_files_location_${net}"

  info "Configuring nginx for DataLayer file serving..."

  sudo systemctl stop "chia-data-layer@${USER}"

  if [[ -L "$src" ]]; then
    sudo rm -f "$src"
  elif [[ -d "$src" ]]; then
    sudo mv "$src" "$dst"
  else
    sudo mkdir -p "$dst"
  fi

  sudo mkdir -p "$dst"
  sudo chown -R "${USER}:${USER}" "$dst"
  sudo find "$dst" -type d -exec chmod 755 {} \;
  sudo find "$dst" -type f -exec chmod 644 {} \; 2>/dev/null || true
  ln -sfn "$dst" "$src"

  sudo mkdir -p "/etc/systemd/system/chia-data-layer@${USER}.service.d"
  sudo tee "/etc/systemd/system/chia-data-layer@${USER}.service.d/umask.conf" >/dev/null <<EOF
[Service]
UMask=0022
EOF
  sudo systemctl daemon-reload

  sudo tee /etc/nginx/sites-available/cadt-datalayer >/dev/null <<EOF
server {
    listen ${DATALAYER_PORT} default_server;
    listen [::]:${DATALAYER_PORT} default_server;

    root ${dst};
    autoindex off;

    server_name ${DATALAYER_HOST};

    expires 30d;
    add_header Pragma "public";
    add_header Cache-Control "public";

    location / {
        try_files \$uri =404;
    }
}
EOF

  sudo rm -f /etc/nginx/sites-enabled/default
  sudo ln -sf /etc/nginx/sites-available/cadt-datalayer /etc/nginx/sites-enabled/cadt-datalayer
  sudo nginx -t
  sudo systemctl enable nginx >>"$LOG_FILE" 2>&1
  sudo systemctl reload nginx

  sudo systemctl start "chia-data-layer@${USER}"

  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${DATALAYER_PORT}/" || echo "000")
  if [[ "$code" != "404" && "$code" != "200" && "$code" != "403" ]]; then
    die "nginx smoke test failed (HTTP ${code})"
  fi
  success "nginx serving DataLayer files at ${DATALAYER_URL}"
}

patch_cadt_config() {
  local governance_id="$GOVERNANCE_MAINNET"
  if [[ "$NETWORK" == "testneta" ]]; then
    governance_id="$GOVERNANCE_TESTNETA"
  fi

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
  echo "  CADT API:          http://localhost:31310"
  echo "  DataLayer files:   ${DATALAYER_URL}"
  if [[ "$WARN_DNS" -eq 1 ]]; then
    warn "Ensure DNS for ${DATALAYER_HOST} points to this machine."
  fi
  echo "  Network:           ${NETWORK}"
  echo "  Governance ID:     ${governance_id}"
  if [[ -n "$CADT_API_KEY" ]]; then
    echo "  API key:           (set; shown on terminal only)"
    private_literal "  API key:           ${CADT_API_KEY}"
  else
    echo "  API key:           (not set)"
  fi
  echo ""
  info "Next steps — home organization"
  echo "  Wait until 'chia show -s' reports synced before creating a home org."
  if [[ "$NETWORK" == "testneta" ]]; then
    echo "  Get test TXCH from the current testneta faucet for your environment."
  fi
  echo "  Create home org (v2):"
  echo "    curl -X POST http://localhost:31310/v2/organizations \\"
  echo "      -H 'Content-Type: application/json' \\"
  if [[ -n "$CADT_API_KEY" ]]; then
    echo "      -H 'x-api-key: <api-key>' \\"
  fi
  echo "      -d '{\"name\":\"My Organization\"}'"
  echo "  Import existing org:"
  echo "    curl -X PUT http://localhost:31310/v2/organizations \\"
  echo "      -H 'Content-Type: application/json' \\"
  if [[ -n "$CADT_API_KEY" ]]; then
    echo "      -H 'x-api-key: <api-key>' \\"
  fi
  echo "      -d '{\"orgUid\":\"<org-uid>\",\"isHome\":true}'"
  echo "  Docs: https://github.com/Chia-Network/cadt/blob/develop/docs/cadt_rpc_api_v2.md"
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
  require_sudo
  setup_logging

  phase "Phase 0: Preflight checks"
  check_os
  check_architecture
  check_min_specs
  check_existing_install

  phase "Phase 1: Configuration"
  # Resolve versions from flags without prompts when all set
  local tmpjson
  tmpjson=$(mktemp)
  if [[ -n "$CHIA_VERSION_CHOICE" && -z "$CHIA_APT_VER" ]]; then
    fetch_releases_json "$GH_API_CHIA" "$tmpjson"
    resolve_version_choice "$CHIA_VERSION_CHOICE" "$tmpjson" CHIA_APT_VER
  fi
  if [[ -n "$CHIA_TOOLS_VERSION_CHOICE" && -z "$TOOLS_APT_VER" ]]; then
    fetch_releases_json "$GH_API_TOOLS" "$tmpjson"
    resolve_version_choice "$CHIA_TOOLS_VERSION_CHOICE" "$tmpjson" TOOLS_APT_VER
  fi
  if [[ -n "$CADT_VERSION_CHOICE" && -z "$CADT_APT_VER" ]]; then
    fetch_releases_json "$GH_API_CADT" "$tmpjson"
    resolve_version_choice "$CADT_VERSION_CHOICE" "$tmpjson" CADT_APT_VER
  fi
  rm -f "$tmpjson"
  validate_supported_apt_versions

  if [[ -z "$NETWORK" || -z "$CHIA_APT_VER" || -z "$TOOLS_APT_VER" || -z "$CADT_APT_VER" ||
    -z "$DATALAYER_HOST" ]]; then
    run_prompts
  else
    validate_supported_apt_versions
    validate_network "$NETWORK"
    validate_datalayer_host "$DATALAYER_HOST"
    if [[ "$WARN_DNS" -eq 1 ]]; then
      warn "DNS for '${DATALAYER_HOST}' must point to this machine so others can fetch your DataLayer files."
      confirm "Continue with hostname '${DATALAYER_HOST}'?" || die "Aborted."
    fi
    apply_config_defaults
    build_datalayer_url
    if ! $ASSUME_YES; then
      echo ""
      confirm "Proceed with installation?" || die "Aborted by user."
    fi
  fi

  # Export API key for CI follow-up steps
  if [[ -n "${GITHUB_ENV:-}" && -n "$CADT_API_KEY" ]]; then
    echo "API_KEY=${CADT_API_KEY}" >>"$GITHUB_ENV"
  fi

  phase "Phase 2: Installing packages"
  install_prerequisites
  setup_apt_repos
  install_packages

  phase "Phase 3: Initializing Chia"
  init_chia

  phase "Phase 4: Starting Chia services"
  start_chia_services
  local net
  net=$(get_chia_network_dir)

  phase "Phase 5: Configuring nginx"
  configure_nginx_datalayer "$net"

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
