export const defaultConfig = {
  MIRROR_DB: {
    DB_USERNAME: null,
    DB_PASSWORD: null,
    DB_NAME: null,
    DB_HOST: null,
  },
  APP: {
    CW_PORT: 31310,
    BIND_ADDRESS: 'localhost',
    DATALAYER_URL: 'https://localhost:8562',
    WALLET_URL: 'https://localhost:9256',
    USE_SIMULATOR: false,
    READ_ONLY: false,
    CADT_API_KEY: null,
    CHIA_NETWORK: 'mainnet',
    USE_DEVELOPMENT_MODE: false,
    IS_GOVERNANCE_BODY: false,
    DEFAULT_FEE: 3000,
    DEFAULT_COIN_AMOUNT: 300,
    CERTIFICATE_FOLDER_PATH: null,
    DATALAYER_FILE_SERVER_URL: null,
    AUTO_SUBSCRIBE_FILESTORE: false,
    AUTO_MIRROR_EXTERNAL_STORES: true,
    LOG_LEVEL: 'info',
    TASKS: {
      GOVERNANCE_SYNC_TASK_INTERVAL: 86400,
      ORGANIZATION_META_SYNC_TASK_INTERVAL: 300,
      PICKLIST_SYNC_TASK_INTERVAL: 60,
      MIRROR_CHECK_TASK_INTERVAL: 86460,
      VALIDATE_ORGANIZATION_TABLE_TASK_INTERVAL: 1800,
    },
    /**
     * limits to prevent loop bound DOS attack
     */
    REQUEST_CONTENT_LIMITS: {
      STAGING: {
        EDIT_DATA_LEN: 200,
      },
      UNITS: {
        INCLUDE_COLUMNS_LEN: 200,
        MARKETPLACE_IDENTIFIERS_LEN: 200,
      },
      PROJECTS: {
        INCLUDE_COLUMNS_LEN: 200,
        PROJECT_IDS_LEN: 200,
      },
    },
  },
  GOVERNANCE: {
    GOVERNANCE_BODY_ID:
      '23f6498e015ebcd7190c97df30c032de8deb5c8934fc1caa928bc310e2b8a57e',
  },
};
