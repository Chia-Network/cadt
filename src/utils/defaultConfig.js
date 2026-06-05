export const defaultConfig = {
  APP: {
    CW_PORT: 31310,
    BIND_ADDRESS: 'localhost',
    /**
     * Number of reverse-proxy hops between the internet and CADT.
     * Passed to Express `trust proxy` via `resolveTrustProxyHops`
     * (src/utils/trust-proxy.js), which requires a non-negative
     * integer:
     *   0  – no proxy (default, direct access)
     *   1  – one hop  (nginx OR Cloudflare-only)
     *   2  – two hops (Cloudflare → nginx, typical k8s ingress setup)
     * Setting this correctly lets express-rate-limit see the real
     * client IP instead of the proxy IP.  Booleans (`true`/`false`)
     * and non-numeric strings (e.g. `"loopback"`) are explicitly
     * rejected and fall back to 0 with a warning log; `true` in
     * particular would trust the user-supplied leftmost IP and defeat
     * rate limiting.
     */
    TRUST_PROXY: 0,
    DATALAYER_URL: 'https://localhost:8562',
    WALLET_URL: 'https://localhost:9256',
    USE_SIMULATOR: false,
    CHIA_NETWORK: 'mainnet',
    USE_DEVELOPMENT_MODE: false,
    DEFAULT_FEE: 3000,
    DEFAULT_COIN_AMOUNT: 300,
    CERTIFICATE_FOLDER_PATH: null,
    DATALAYER_FILE_SERVER_URL: null,
    AUTO_SUBSCRIBE_FILESTORE: false,
    AUTO_MIRROR_EXTERNAL_STORES: true,
    /**
     * When true, DataLayer subscriptions are kept in sync with the governance
     * orgList: orgs removed from the list are unsubscribed (data retained);
     * orgs on the list with subscribed=false are re-subscribed. Requires a
     * non-empty orgList from a successful governance sync before any removal.
     */
    ONLY_CADT_SUBSCRIPTIONS: true,
    LOG_LEVEL: 'info',
    TASKS: {
      GOVERNANCE_SYNC_TASK_INTERVAL: 120,
      ORGANIZATION_META_SYNC_TASK_INTERVAL: 120,
      PICKLIST_SYNC_TASK_INTERVAL: 120,
      MIRROR_CHECK_TASK_INTERVAL: 900,
      VALIDATE_ORGANIZATION_TABLE_TASK_INTERVAL: 1800,
      COIN_MANAGEMENT_TASK_INTERVAL: 21600,
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
  V1: {
    ENABLE: true,
    READ_ONLY: false,
    CADT_API_KEY: null,
    IS_GOVERNANCE_BODY: false,
    GOVERNANCE: {
      GOVERNANCE_BODY_ID:
        '23f6498e015ebcd7190c97df30c032de8deb5c8934fc1caa928bc310e2b8a57e',
    },
    MIRROR_DB: {
      DB_USERNAME: null,
      DB_PASSWORD: null,
      DB_NAME: null,
      DB_HOST: null,
    },
  },
  V2: {
    ENABLE: true,
    READ_ONLY: false,
    CADT_API_KEY: null,
    IS_GOVERNANCE_BODY: false,
    GOVERNANCE: {
      GOVERNANCE_BODY_ID:
        '23f6498e015ebcd7190c97df30c032de8deb5c8934fc1caa928bc310e2b8a57e',
    },
    MIRROR_DB: {
      DB_USERNAME: null,
      DB_PASSWORD: null,
      DB_NAME: null,
      DB_HOST: null,
    },
  },
};
