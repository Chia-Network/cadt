#!/bin/bash

UNIFIED_CONFIG_PATH="/root/.chia/mainnet/cadt/config.yaml"

# Function to update yaml value if environment variable exists
update_yaml_if_env_exists() {
    local env_var=$1
    local yaml_path=$2
    local config_path=$3

    # Check if the environment variable is set (even if empty)
    if [ -n "${!env_var+x}" ]; then
        if [[ "${!env_var}" == "true" || "${!env_var}" == "false" ]]; then
            yq eval "$yaml_path |= ${!env_var}" -i "$config_path"
        elif [ -z "${!env_var}" ]; then
            yq eval "$yaml_path |= null" -i "$config_path"
        else
            yq eval "$yaml_path |= \"${!env_var}\"" -i "$config_path"
        fi
    fi
}

# Function to create config file if it doesn't exist
create_config_if_not_exists() {
    local config_path=$1

    if [ ! -f "$config_path" ]; then
        # Use Node to convert defaultConfig.js to YAML
        # Use a temporary .mjs file to properly handle ES module imports with top-level await
        local temp_script=$(mktemp /app/create-config-XXXXXX.mjs)
        cat > "$temp_script" << 'EOF'
import yaml from "js-yaml";
import fs from "fs";
import { defaultConfig } from "/app/src/utils/defaultConfig.js";
try {
    fs.writeFileSync(process.env.CONFIG_PATH, yaml.dump(defaultConfig));
    process.exit(0);
} catch (err) {
    console.error("Error creating config file:", err);
    process.exit(1);
}
EOF
        CONFIG_PATH="$config_path" node "$temp_script"
        local node_exit_code=$?
        rm -f "$temp_script"

        if [ $node_exit_code -ne 0 ]; then
            echo "Error: Failed to create config file at \"$config_path\"" >&2
            exit 1
        fi

        # Verify the file was created
        if [ ! -f "$config_path" ]; then
            echo "Error: Config file was not created at \"$config_path\"" >&2
            exit 1
        fi
    fi
}

# Create config directories if they don't exist
# V1 and V2 directories still needed for databases
mkdir -p /root/.chia/mainnet/cadt/v1
mkdir -p /root/.chia/mainnet/cadt/v2
# Unified config directory
mkdir -p /root/.chia/mainnet/cadt

# Create unified config file if it doesn't exist
create_config_if_not_exists "$UNIFIED_CONFIG_PATH"

# Function to update unified config with environment variables for APP section
update_app_config() {
    local env_var=$1
    local yaml_path=$2

    update_yaml_if_env_exists "$env_var" ".APP$yaml_path" "$UNIFIED_CONFIG_PATH"
}

# Function to update unified config with environment variables for V1 section
update_v1_config() {
    local env_var=$1
    local yaml_path=$2

    update_yaml_if_env_exists "$env_var" ".V1$yaml_path" "$UNIFIED_CONFIG_PATH"
}

# Function to update unified config with environment variables for V2 section
update_v2_config() {
    local env_var=$1
    local yaml_path=$2

    update_yaml_if_env_exists "$env_var" ".V2$yaml_path" "$UNIFIED_CONFIG_PATH"
}

# APP section (shared across V1 and V2)
update_app_config "CW_PORT" '.CW_PORT'
update_app_config "BIND_ADDRESS" '.BIND_ADDRESS'
update_app_config "DATALAYER_URL" '.DATALAYER_URL'
update_app_config "WALLET_URL" '.WALLET_URL'
update_app_config "USE_SIMULATOR" '.USE_SIMULATOR'
update_app_config "CHIA_NETWORK" '.CHIA_NETWORK'
update_app_config "USE_DEVELOPMENT_MODE" '.USE_DEVELOPMENT_MODE'
update_app_config "DEFAULT_FEE" '.DEFAULT_FEE'
update_app_config "DEFAULT_COIN_AMOUNT" '.DEFAULT_COIN_AMOUNT'
update_app_config "CERTIFICATE_FOLDER_PATH" '.CERTIFICATE_FOLDER_PATH'
update_app_config "DATALAYER_FILE_SERVER_URL" '.DATALAYER_FILE_SERVER_URL'
update_app_config "AUTO_SUBSCRIBE_FILESTORE" '.AUTO_SUBSCRIBE_FILESTORE'
update_app_config "AUTO_MIRROR_EXTERNAL_STORES" '.AUTO_MIRROR_EXTERNAL_STORES'
update_app_config "LOG_LEVEL" '.LOG_LEVEL'
update_app_config "TRUST_PROXY" '.TRUST_PROXY'

# APP.TASKS section (shared)
update_app_config "GOVERNANCE_SYNC_TASK_INTERVAL" '.TASKS.GOVERNANCE_SYNC_TASK_INTERVAL'
update_app_config "ORGANIZATION_META_SYNC_TASK_INTERVAL" '.TASKS.ORGANIZATION_META_SYNC_TASK_INTERVAL'
update_app_config "PICKLIST_SYNC_TASK_INTERVAL" '.TASKS.PICKLIST_SYNC_TASK_INTERVAL'
update_app_config "MIRROR_CHECK_TASK_INTERVAL" '.TASKS.MIRROR_CHECK_TASK_INTERVAL'
update_app_config "VALIDATE_ORGANIZATION_TABLE_TASK_INTERVAL" '.TASKS.VALIDATE_ORGANIZATION_TABLE_TASK_INTERVAL'
update_app_config "COIN_MANAGEMENT_TASK_INTERVAL" '.TASKS.COIN_MANAGEMENT_TASK_INTERVAL'

# APP.REQUEST_CONTENT_LIMITS section (shared)
update_app_config "STAGING_EDIT_DATA_LEN" '.REQUEST_CONTENT_LIMITS.STAGING.EDIT_DATA_LEN'
update_app_config "UNITS_INCLUDE_COLUMNS_LEN" '.REQUEST_CONTENT_LIMITS.UNITS.INCLUDE_COLUMNS_LEN'
update_app_config "UNITS_MARKETPLACE_IDENTIFIERS_LEN" '.REQUEST_CONTENT_LIMITS.UNITS.MARKETPLACE_IDENTIFIERS_LEN'
update_app_config "PROJECTS_INCLUDE_COLUMNS_LEN" '.REQUEST_CONTENT_LIMITS.PROJECTS.INCLUDE_COLUMNS_LEN'
update_app_config "PROJECTS_PROJECT_IDS_LEN" '.REQUEST_CONTENT_LIMITS.PROJECTS.PROJECT_IDS_LEN'

# V1 section - independent configuration with V1_ prefix
update_v1_config "V1_ENABLE" '.ENABLE'
update_v1_config "V1_READ_ONLY" '.READ_ONLY'
update_v1_config "V1_CADT_API_KEY" '.CADT_API_KEY'
update_v1_config "V1_IS_GOVERNANCE_BODY" '.IS_GOVERNANCE_BODY'
update_v1_config "V1_GOVERNANCE_BODY_ID" '.GOVERNANCE.GOVERNANCE_BODY_ID'

# V1 MIRROR_DB section
update_v1_config "V1_DB_USERNAME" '.MIRROR_DB.DB_USERNAME'
update_v1_config "V1_DB_PASSWORD" '.MIRROR_DB.DB_PASSWORD'
update_v1_config "V1_DB_NAME" '.MIRROR_DB.DB_NAME'
update_v1_config "V1_DB_HOST" '.MIRROR_DB.DB_HOST'

# V2 section - independent configuration with V2_ prefix
update_v2_config "V2_ENABLE" '.ENABLE'
update_v2_config "V2_READ_ONLY" '.READ_ONLY'
update_v2_config "V2_CADT_API_KEY" '.CADT_API_KEY'
update_v2_config "V2_IS_GOVERNANCE_BODY" '.IS_GOVERNANCE_BODY'
update_v2_config "V2_GOVERNANCE_BODY_ID" '.GOVERNANCE.GOVERNANCE_BODY_ID'

# V2 MIRROR_DB section
update_v2_config "V2_DB_USERNAME" '.MIRROR_DB.DB_USERNAME'
update_v2_config "V2_DB_PASSWORD" '.MIRROR_DB.DB_PASSWORD'
update_v2_config "V2_DB_NAME" '.MIRROR_DB.DB_NAME'
update_v2_config "V2_DB_HOST" '.MIRROR_DB.DB_HOST'

# Print config file contents if DOCKER_DEBUG is true
if [ "${DOCKER_DEBUG}" = "true" ]; then
    echo "=== CADT Unified Config File Contents ==="
    cat "$UNIFIED_CONFIG_PATH"
    echo "=========================================="
fi

# Execute the command passed to docker run
exec "$@"
