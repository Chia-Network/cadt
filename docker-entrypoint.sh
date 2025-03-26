#!/bin/bash

CONFIG_PATH="/root/.chia/mainnet/cadt/v1/config.yaml"

# Function to update yaml value if environment variable exists
update_yaml_if_env_exists() {
    local env_var=$1
    local yaml_path=$2

    if [ ! -z "${!env_var}" ]; then
        if [[ "${!env_var}" == "true" || "${!env_var}" == "false" ]]; then
            yq eval "$yaml_path |= ${!env_var}" -i $CONFIG_PATH
        else
            yq eval "$yaml_path |= \"${!env_var}\"" -i $CONFIG_PATH
        fi
    fi
}

# Create config directory if it doesn't exist
mkdir -p /root/.chia/mainnet/cadt/v1

# If config doesn't exist, create it with default values from defaultConfig.js
if [ ! -f $CONFIG_PATH ]; then
    # Use Node to convert defaultConfig.js to YAML
    CONFIG_PATH=$CONFIG_PATH node -e '
        const yaml = require("yaml");
        const fs = require("fs");
        (async () => {
            const { defaultConfig } = await import("/app/src/utils/defaultConfig.js");
            fs.writeFileSync(process.env.CONFIG_PATH, yaml.stringify(defaultConfig));
        })();
    '
fi

# MIRROR_DB section
update_yaml_if_env_exists "DB_USERNAME" '.MIRROR_DB.DB_USERNAME'
update_yaml_if_env_exists "DB_PASSWORD" '.MIRROR_DB.DB_PASSWORD'
update_yaml_if_env_exists "DB_NAME" '.MIRROR_DB.DB_NAME'
update_yaml_if_env_exists "DB_HOST" '.MIRROR_DB.DB_HOST'

# APP section
update_yaml_if_env_exists "CW_PORT" '.APP.CW_PORT'
update_yaml_if_env_exists "BIND_ADDRESS" '.APP.BIND_ADDRESS'
update_yaml_if_env_exists "DATALAYER_URL" '.APP.DATALAYER_URL'
update_yaml_if_env_exists "WALLET_URL" '.APP.WALLET_URL'
update_yaml_if_env_exists "USE_SIMULATOR" '.APP.USE_SIMULATOR'
update_yaml_if_env_exists "READ_ONLY" '.APP.READ_ONLY'
update_yaml_if_env_exists "CADT_API_KEY" '.APP.CADT_API_KEY'
update_yaml_if_env_exists "CHIA_NETWORK" '.APP.CHIA_NETWORK'
update_yaml_if_env_exists "USE_DEVELOPMENT_MODE" '.APP.USE_DEVELOPMENT_MODE'
update_yaml_if_env_exists "IS_GOVERNANCE_BODY" '.APP.IS_GOVERNANCE_BODY'
update_yaml_if_env_exists "DEFAULT_FEE" '.APP.DEFAULT_FEE'
update_yaml_if_env_exists "DEFAULT_COIN_AMOUNT" '.APP.DEFAULT_COIN_AMOUNT'
update_yaml_if_env_exists "CERTIFICATE_FOLDER_PATH" '.APP.CERTIFICATE_FOLDER_PATH'
update_yaml_if_env_exists "DATALAYER_FILE_SERVER_URL" '.APP.DATALAYER_FILE_SERVER_URL'
update_yaml_if_env_exists "AUTO_SUBSCRIBE_FILESTORE" '.APP.AUTO_SUBSCRIBE_FILESTORE'
update_yaml_if_env_exists "AUTO_MIRROR_EXTERNAL_STORES" '.APP.AUTO_MIRROR_EXTERNAL_STORES'
update_yaml_if_env_exists "LOG_LEVEL" '.APP.LOG_LEVEL'

# APP.TASKS section
update_yaml_if_env_exists "GOVERNANCE_SYNC_TASK_INTERVAL" '.APP.TASKS.GOVERNANCE_SYNC_TASK_INTERVAL'
update_yaml_if_env_exists "ORGANIZATION_META_SYNC_TASK_INTERVAL" '.APP.TASKS.ORGANIZATION_META_SYNC_TASK_INTERVAL'
update_yaml_if_env_exists "PICKLIST_SYNC_TASK_INTERVAL" '.APP.TASKS.PICKLIST_SYNC_TASK_INTERVAL'
update_yaml_if_env_exists "MIRROR_CHECK_TASK_INTERVAL" '.APP.TASKS.MIRROR_CHECK_TASK_INTERVAL'
update_yaml_if_env_exists "CHECK_ORG_TABLE_SUBSCRIPTIONS_TASK_INTERVAL" '.APP.TASKS.CHECK_ORG_TABLE_SUBSCRIPTIONS_TASK_INTERVAL'

# GOVERNANCE section
update_yaml_if_env_exists "GOVERNANCE_BODY_ID" '.GOVERNANCE.GOVERNANCE_BODY_ID'

# Execute the command passed to docker run
exec "$@"
