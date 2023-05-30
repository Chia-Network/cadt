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
    DEFAULT_FEE: 300000000,
    DEFAULT_COIN_AMOUNT: 300000000,
    DATALAYER_FILE_SERVER_URL: null,
    TASKS: {
      AUDIT_SYNC_TASK_INTERVAL: 30,
      DATAMODEL_SYNC_TASK_INTERVAL: 60,
      GOVERNANCE_SYNC_TASK_INTERVAL: 86400,
      ORGANIZATION_META_SYNC_TASK_INTERVAL: 86400,
      PICKLIST_SYNC_TASK_INTERVAL: 30,
    },
  },
  GOVERNANCE: {
    GOVERNANCE_BODY_ID:
      '23f6498e015ebcd7190c97df30c032de8deb5c8934fc1caa928bc310e2b8a57e',
  },
};
