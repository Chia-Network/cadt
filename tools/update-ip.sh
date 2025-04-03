#!/bin/bash

# Author: Chia Network
# Description: Script to update the DATALAYER_FILE_SERVER_URL in the Core Registry CADT config file
# Note: This script must be run as root (using sudo)

# Script to automatically update the Core Registry mirror IP.
# Designed to run in cron or manually.  Will handle updating
# the Core Registry config file and recreating mirrors.
#
# Author: Zach Brown <z.brown@chia.net>, Chia Networks Inc
#
# Usage:
#   sudo ./tools/update-ip.sh --chia-user=<username> [--port=<port>] [--https] [--dry-run]
#
#   --chia-user=<username>  (Required) The username of the Chia user whose configuration will be updated
#   --dry-run              (Optional) Run in dry-run mode to see what changes would be made without actually making them
#   --port=<port>          (Optional) Specify a custom port for the DATALAYER_FILE_SERVER_URL. If not provided, the script will use the port from your Chia config file.
#   --https                (Optional) Use HTTPS instead of HTTP for the DATALAYER_FILE_SERVER_URL. If not provided, HTTP will be used.
#
# Example:
#   sudo ./tools/update-ip.sh --chia-user=ubuntu
#   sudo ./tools/update-ip.sh --chia-user=ubuntu --port=31310 --https --dry-run

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Error: This script must be run as root"
    exit 1
fi

# Parse command line arguments
CHIA_USER=""
DRY_RUN=false
PORT=""  # Will be set from config file or command line
USE_HTTPS=false

for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --chia-user=*)
            CHIA_USER="${arg#*=}"
            shift
            ;;
        --port=*)
            PORT="${arg#*=}"
            shift
            ;;
        --https)
            USE_HTTPS=true
            shift
            ;;
    esac
done

# Check if chia-user was provided
if [ -z "$CHIA_USER" ]; then
    echo "Error: --chia-user parameter is required"
    echo "Usage: $0 --chia-user=<username> [--port=<port>] [--https] [--dry-run]"
    exit 1
fi

# Check if chia user exists
if ! id "$CHIA_USER" &>/dev/null; then
    echo "Error: Chia user '$CHIA_USER' does not exist"
    exit 1
fi

# Function to check if a command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "Error: $1 is not installed. Please install it first."
        exit 1
    fi
}

# Check required commands
check_command "curl"
check_command "chia-tools"
check_command "chia"
check_command "systemctl"

# Get chia user's home directory
CHIA_HOME=$(getent passwd "$CHIA_USER" | cut -d: -f6)
if [ -z "$CHIA_HOME" ]; then
    echo "Error: Could not determine home directory for user $CHIA_USER"
    exit 1
fi

# If port not specified, get it from Chia config
if [ -z "$PORT" ]; then
    CHIA_CONFIG="$CHIA_HOME/.chia/mainnet/config/config.yaml"
    if [ ! -f "$CHIA_CONFIG" ]; then
        echo "Error: Chia config file not found at $CHIA_CONFIG"
        exit 1
    fi

    # Extract the host_port value from the data_layer section
    PORT=$(grep -A 10 "data_layer:" "$CHIA_CONFIG" | grep "host_port:" | head -1 | awk '{print $2}')

    if [ -z "$PORT" ]; then
        echo "Error: Could not find data_layer host_port in Chia config"
        exit 1
    fi

    echo "Using default port from Chia config: $PORT"
fi

# Get current IP address
echo "Fetching current IP address..."
CURRENT_IP=$(curl -s https://observer.climateactiondata.org/ip)
if [ -z "$CURRENT_IP" ]; then
    echo "Error: Failed to fetch IP address"
    exit 1
fi

# Construct the new DATALAYER_FILE_SERVER_URL
if [ "$USE_HTTPS" = true ]; then
    NEW_URL="https://${CURRENT_IP}:${PORT}"
else
    NEW_URL="http://${CURRENT_IP}:${PORT}"
fi

# Path to config file - Updated for Core-Registry-CADT
CONFIG_FILE="$CHIA_HOME/.chia/mainnet/core-registry/config.yaml"

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Config file not found at $CONFIG_FILE"
    exit 1
fi

# Check if the URL is already set correctly
EXISTING_URL=$(grep "DATALAYER_FILE_SERVER_URL:" "$CONFIG_FILE" | awk '{print $2}')
if [ "$EXISTING_URL" = "$NEW_URL" ]; then
    echo "DATALAYER URL is already set to the correct address of $NEW_URL"
    exit 0
fi

# Update the config file
if [ "$DRY_RUN" = true ]; then
    echo "DRY RUN: Would update DATALAYER_FILE_SERVER_URL to: $NEW_URL"
    echo "DRY RUN: Would delete all mirrors"
    sudo -u "$CHIA_USER" chia-tools data delete-mirrors --all --dry-run
    echo "DRY RUN: Would restart Core Registry CADT service"
else
    # Update the config file using sed
    sed -i "s|DATALAYER_FILE_SERVER_URL:.*|DATALAYER_FILE_SERVER_URL: $NEW_URL|" "$CONFIG_FILE"
    # Ensure the chia user owns the file
    chown "$CHIA_USER:$CHIA_USER" "$CONFIG_FILE"
    echo "Updated DATALAYER_FILE_SERVER_URL to: $NEW_URL"

    # Delete all mirrors
    echo "Deleting all mirrors..."
    sudo -u "$CHIA_USER" chia-tools data delete-mirrors --all
    echo "Mirrors deleted successfully"

    # Restart the Core Registry CADT service
    echo "Restarting Core Registry CADT service..."
    SERVICE_NAME="core-registry-cadt@${CHIA_USER}.service"
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        systemctl restart "$SERVICE_NAME"
        echo "Core Registry CADT service restarted successfully"
    else
        echo "Warning: Core Registry CADT service is not running. Skipping restart."
    fi
fi

