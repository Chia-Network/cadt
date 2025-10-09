#!/bin/bash

V1_CONFIG_PATH="/root/.chia/mainnet/cadt/v1/config.yaml"
V2_CONFIG_PATH="/root/.chia/mainnet/cadt/v2/config.yaml"

# Function to update yaml value if environment variable exists
update_yaml_if_env_exists() {
    local env_var=$1
    local yaml_path=$2
    local config_path=$3

    # Check if the environment variable is set (even if empty)
    if [ -n "${!env_var+x}" ]; then
        if [[ "${!env_var}" == "true" || "${!env_var}" == "false" ]]; then
            yq eval "$yaml_path |= ${!env_var}" -i $config_path
        elif [ -z "${!env_var}" ]; then
            yq eval "$yaml_path |= null" -i $config_path
        else
            yq eval "$yaml_path |= \"${!env_var}\"" -i $config_path
        fi
    fi
}

# Function to create config file if it doesn't exist
create_config_if_not_exists() {
    local config_path=$1

    if [ ! -f $config_path ]; then
        # Use Node to convert defaultConfig.js to YAML
        CONFIG_PATH=$config_path node -e '
            const yaml = require("yaml");
            const fs = require("fs");
            (async () => {
                const { defaultConfig } = await import("/app/src/utils/defaultConfig.js");
                fs.writeFileSync(process.env.CONFIG_PATH, yaml.stringify(defaultConfig));
            })();
        '
    fi
}

# Create config directories if they don't exist
mkdir -p /root/.chia/mainnet/cadt/v1
mkdir -p /root/.chia/mainnet/cadt/v2

# Create config files if they don't exist
create_config_if_not_exists $V1_CONFIG_PATH
create_config_if_not_exists $V2_CONFIG_PATH

# Function to update both config files with environment variables
update_both_configs() {
    local env_var=$1
    local yaml_path=$2

    update_yaml_if_env_exists "$env_var" "$yaml_path" $V1_CONFIG_PATH
    update_yaml_if_env_exists "$env_var" "$yaml_path" $V2_CONFIG_PATH
}

# MIRROR_DB section
update_both_configs "DB_USERNAME" '.MIRROR_DB.DB_USERNAME'
update_both_configs "DB_PASSWORD" '.MIRROR_DB.DB_PASSWORD'
update_both_configs "DB_NAME" '.MIRROR_DB.DB_NAME'
update_both_configs "DB_HOST" '.MIRROR_DB.DB_HOST'

# APP section
update_both_configs "CW_PORT" '.APP.CW_PORT'
update_both_configs "BIND_ADDRESS" '.APP.BIND_ADDRESS'
update_both_configs "DATALAYER_URL" '.APP.DATALAYER_URL'
update_both_configs "WALLET_URL" '.APP.WALLET_URL'
update_both_configs "USE_SIMULATOR" '.APP.USE_SIMULATOR'
update_both_configs "READ_ONLY" '.APP.READ_ONLY'
update_both_configs "CADT_API_KEY" '.APP.CADT_API_KEY'
update_both_configs "CHIA_NETWORK" '.APP.CHIA_NETWORK'
update_both_configs "USE_DEVELOPMENT_MODE" '.APP.USE_DEVELOPMENT_MODE'
update_both_configs "IS_GOVERNANCE_BODY" '.APP.IS_GOVERNANCE_BODY'
update_both_configs "DEFAULT_FEE" '.APP.DEFAULT_FEE'
update_both_configs "DEFAULT_COIN_AMOUNT" '.APP.DEFAULT_COIN_AMOUNT'
update_both_configs "CERTIFICATE_FOLDER_PATH" '.APP.CERTIFICATE_FOLDER_PATH'
update_both_configs "DATALAYER_FILE_SERVER_URL" '.APP.DATALAYER_FILE_SERVER_URL'
update_both_configs "AUTO_SUBSCRIBE_FILESTORE" '.APP.AUTO_SUBSCRIBE_FILESTORE'
update_both_configs "AUTO_MIRROR_EXTERNAL_STORES" '.APP.AUTO_MIRROR_EXTERNAL_STORES'
update_both_configs "LOG_LEVEL" '.APP.LOG_LEVEL'

# APP.TASKS section
update_both_configs "GOVERNANCE_SYNC_TASK_INTERVAL" '.APP.TASKS.GOVERNANCE_SYNC_TASK_INTERVAL'
update_both_configs "ORGANIZATION_META_SYNC_TASK_INTERVAL" '.APP.TASKS.ORGANIZATION_META_SYNC_TASK_INTERVAL'
update_both_configs "PICKLIST_SYNC_TASK_INTERVAL" '.APP.TASKS.PICKLIST_SYNC_TASK_INTERVAL'
update_both_configs "MIRROR_CHECK_TASK_INTERVAL" '.APP.TASKS.MIRROR_CHECK_TASK_INTERVAL'
update_both_configs "CHECK_ORG_TABLE_SUBSCRIPTIONS_TASK_INTERVAL" '.APP.TASKS.CHECK_ORG_TABLE_SUBSCRIPTIONS_TASK_INTERVAL'

# GOVERNANCE section
update_both_configs "GOVERNANCE_BODY_ID" '.GOVERNANCE.GOVERNANCE_BODY_ID'

# Print config file contents if DOCKER_DEBUG is true
if [ "${DOCKER_DEBUG}" = "true" ]; then
    echo "=== CADT V1 Config File Contents ==="
    cat $V1_CONFIG_PATH
    echo "===================================="
    echo "=== CADT V2 Config File Contents ==="
    cat $V2_CONFIG_PATH
    echo "===================================="
fi

# Execute the command passed to docker run
exec "$@"
