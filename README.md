# Climate Action Data Trust

**Please review the [CAD Trust Terms and Conditions](docs/CAD_Trust_Registry_Terms_and_Conditions.pdf) and [CAD Trust User Terms and Conditions](docs/CAD_Trust_User_Terms_and_Conditions.pdf).**

This project provides the Climate Action Data Trust (CADT) API that integrates with the [Chia Blockchain](https://github.com/Chia-Network/chia-blockchain). For a user interface, see the [CADT UI project](https://github.com/Chia-Network/climate-warehouse-ui), which will connect to the CADT API.

This project was formerly known as the Climate Warehouse, and you may see this term used interchangeably with CADT.

## Installation

[Releases are available on the Github releases page](https://github.com/Chia-Network/cadt/releases) and binaries are built for Windows, macOS, and Linux. ARM binaries are available for Debian versions of Linux only.

Ubuntu Linux is the recommended operating system and the majority of the development work and testing focuses on this platorm.

System recommendation:

* 2 CPU cores
* 8 GB RAM
* 500 GB disk space

### Quickstart

1. Use an Ubuntu Linux machine with at least 2 CPU cores, 8 GB RAM, and 500 GB disk space.
1. Don't install as root, use a user account with sudo. This quickstart assumes a user account named `ubuntu`, as you would get by default on AWS.
1. Install prerequisites.

   ```bash
   sudo apt-get update && sudo apt-get install ca-certificates curl gnupg python3-yq
   ```

1. Add the apt key.

   ```bash
   curl -sL https://repo.chia.net/FD39E6D3.pubkey.asc | sudo gpg --dearmor -o /usr/share/keyrings/chia.gpg
   ```

1. Add apt repos.

   ```bash
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/chia.gpg] https://repo.chia.net/cadt/debian/ stable main" | sudo tee /etc/apt/sources.list.d/cadt.list > /dev/null
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/chia.gpg] https://repo.chia.net/debian/ stable main" | sudo tee /etc/apt/sources.list.d/chia.list > /dev/null
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/chia.gpg] https://repo.chia.net/chia-tools/debian/ stable main" | sudo tee /etc/apt/sources.list.d/chia-tools.list > /dev/null
   ```

1. Install CADT, Chia, chia-tools, and Nginx.

   ```bash
   sudo apt-get update
   sudo apt-get install chia-blockchain-cli cadt chia-tools nginx
   ```

1. Initialize Chia.

   ```bash
   chia init
   ```

1. Use testnet for development work (skip if this is your production setup).

   ```bash
   chia-tools network switch testneta
   yq -y -i '.APP.CHIA_NETWORK = "testnet"' ~/.chia/mainnet/cadt/config.yaml
   sudo systemctl restart cadt@ubuntu chia-full-node@ubuntu chia-wallet@ubuntu chia-data-layer@ubuntu
   ```

1. Configure the Datalayer public directory.

   ```bash
   sudo mkdir -p /var/www/data_layer
   sudo chown -R ubuntu /var/www/data_layer
   chia-tools config edit --set data_layer.server_files_location=/var/www/data_layer
   ```

1. Configure Nginx to serve Datalayer files.

   ```bash
   sudo rm -f /etc/nginx/conf.d/* && sudo rm -f /etc/nginx/sites-enabled/*
   sudo curl -fsSL -o /etc/nginx/conf.d/datalayer.conf https://raw.githubusercontent.com/Chia-Network/cadt/main/docs/nginx/datalayer.conf
   sudo nginx -t && sudo systemctl restart nginx
   ```

1. Configure CADT with the Datalayer address.

   Please use a domain name if possible instead of the IP address. Replace the `curl` part in `()` with your domain name if you can. Otherwise this will automatically use the IP address. **Note this IP address *MUST* be a static IP**.

   ```bash
   DATALAYER_FILE_SERVER_URL="http://$(curl -fsS https://ip.chia.net | tr -d '[:space:]')/data/"
   yq -y -i ".APP.DATALAYER_FILE_SERVER_URL = \"$DATALAYER_FILE_SERVER_URL\"" ~/.chia/mainnet/cadt/config.yaml
   ```

1. Set your API key.

   This sets it automatically to a random string, but you may use any API key you'd like by replacing the `openssl` section with your key.

   ```bash
   KEY=$(openssl rand -hex 10) yq -yi ".V1.CADT_API_KEY = \"$KEY\" | .V2.CADT_API_KEY = \"$KEY\"" ~/.chia/mainnet/cadt/config.yaml
   ```

1. Start and enable Chia, CADT, and Nginx.

   ```bash
   sudo systemctl enable nginx cadt@ubuntu chia-full-node@ubuntu chia-wallet@ubuntu chia-data-layer@ubuntu
   sudo systemctl start cadt@ubuntu chia-full-node@ubuntu chia-wallet@ubuntu chia-data-layer@ubuntu
   ```

1. Fund your Chia wallet (mainnet only).

   Sign up for an account at [https://vault.chia.net/](https://vault.chia.net/). Go to the "Buy XCH" section. We recommend buying at least 0.5 XCH. Once you have your funds, find your CADT wallet address:

   ```bash
   chia wallet get_address
   ```

   Send your XCH from vault.chia.net to your CADT chia wallet address.

1. Monitor progress and status.

   Chia full node syncing:

   ```bash
   chia show -s
   ```

   Chia wallet sync:

   ```bash
   chia wallet show
   ```

   Follow the Chia log:

   ```bash
   tail -f ~/.chia/mainnet/log/debug.log
   ```

   Follow the CADT log:

   ```bash
   journalctl -u cadt@ubuntu -f
   ```

1. Install a pre-release version (optional).

   Pre-release versions are not recommended for production. Only install if you are confident in your decision.

   ```bash
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/chia.gpg] https://repo.chia.net/cadt-test/debian/ stable main" | sudo tee /etc/apt/sources.list.d/cadt-test.list > /dev/null
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/chia.gpg] https://repo.chia.net/prerelease/debian/ prerelease main" | sudo tee /etc/apt/sources.list.d/chia-blockchain-prerelease.list > /dev/null
   sudo apt update
   sudo apt install cadt=1.7.26-rc3 chia-blockchain-cli=2.7.2-rc2
   ```

## Getting Started

This section is your entry point. What you need to set up depends on whether you are consuming data or writing it.

→ See [Installation](#installation)
→ See [Configuration](#configuration)
→ See [Run CADT on a Testnet](#run-cadt-on-a-testnet)

### For data users

If you only need to read and consume carbon credit data, set up CADT as usual: install the Chia services (wallet, full node, DataLayer) and run CADT as an observer node (`READ_ONLY` set to `true`). Once synced, CADT exposes a full set of GET endpoints for querying projects, units, issuances, and more.

→ See the GET endpoints in [`docs/cadt_rpc_api_v2.md`](docs/cadt_rpc_api_v2.md)

### For registries

If you are a registry writing carbon credit data to the blockchain, consider Node as a Service before self-hosting.

**Node as a Service (recommended)**
Chia provides an affordable hosted Node as a Service (NaaS) for registry partners. Chia manages all Chia blockchain infrastructure on your behalf, so your team can focus entirely on data mapping and API integration rather than node operations. To get started with NaaS, contact CAD Trust to be onboarded as a registry partner. If you self-host instead, complete the [Installation](#installation) and [Configuration](#configuration) steps with `READ_ONLY` set to `false`.

**1. Understand the v2 data model**
Review the machine-readable schema to understand the data tables, their fields, required values, picklists, and insert order. This is the reference your team (and any automated tools) should use when mapping your registry's data to CADT.
→ See [`docs/cadtrust-schema-v2.0.2.json`](docs/cadtrust-schema-v2.0.2.json)

**2. Map your registry fields to the CADT schema**
For each field in your source data, identify the corresponding CADT `apiField`, confirm the type and required status, and check picklist constraints. The schema file is designed to drive this mapping process directly — whether done manually or via an automated ETL pipeline or AI mapping agent.

**3. Submit data via the v2 API**
Use the RPC guide to understand the data model, endpoints, field tables, staging workflow, and curl examples for every entity.
→ See [`docs/cadt_rpc_api_v2.md`](docs/cadt_rpc_api_v2.md)

### For automated integrations and AI mapping agents (registries)

If you are building a machine-to-machine ETL pipeline or using an AI agent to automate field mapping, follow these steps:

**1. Load the schema**
Load [`docs/cadtrust-schema-v2.0.2.json`](docs/cadtrust-schema-v2.0.2.json) as your source of truth for field definitions, types, required flags, and picklist values.

**2. Map your registry fields**
Match source fields against the schema's `apiField`, `type`, `required`, `source`, and `description` properties. Only submit fields where `source` is `user_input` — fields with `source: system` or `source: api_generated` are set automatically by CADT.

**3. Validate picklist values**
For fields with a `picklist` property, check allowed values in the schema's `picklists` object. When a live CADT node is available, prefer the live values from `GET /v2/governance/meta/pickList` as the authoritative source.

**4. Follow insert order**
Create records in the sequence defined by `insert_order` in the schema — parent records must exist before children. Example: `program` → `methodology` → `project` → `project_methodology` → `issuance` → `unit`.

**5. Stage, review, commit**
All write operations in CADT go through a staging workflow. Records are staged first (POST/PUT returns a staged UUID), then committed to the blockchain in a single commit call. Nothing is written to the blockchain until commit.
→ See [Staging endpoints in the v2 RPC guide](docs/cadt_rpc_api_v2.md#staging)

## User Guide

The CADT application is designed to run 24/7, much like any other API. The simplest way to run the CADT application is to use the same machine the Chia Full Node, Wallet, and Datalayer services reside on. A simple webserver to serve Chia Datalayer files is also required.  CADT communicates with the Chia services over an RPC interface.  The RPC interface uses certificates to authenticate, which will work automatically when the CADT application is run as the same user on the same machine as the Chia services.  To run CADT on a separate machine from Chia, a public certificate from the Chia node must be used to authenticate (not yet documented).

Basic Chia installation instructions are provided above, but further installation options, please see the [Chia docs site](https://docs.chia.net/installation/).  For most CADT setups, we recommend the installing the headless `chia-blockchain-cli` package via the `apt` repo and using [systemd](https://docs.chia.net/installation/#systemd).

After the initial installation, it will take anywhere from a few days (most likely for a cloud-hosted server) to a few weeks (possible on lower-powered systems or servers with slow connections) to sync the Chia full node.  During this time, CADT can start syncing, but any writes to CADT are likely to fail.  For best results, we recommend waiting for the Chia full node to finish syncing before using CADT.  Check the status of the full node sync with `chia show -s`.

*Those familiar with bittorrent and have a fast connection can speed up the full node syncing by [downloading the database](https://www.chia.net/downloads/#database-checkpoint) and copying it into place manually*

### Configuration

In the `CHIA_ROOT` directory (usually `~/.chia/mainnet` on Linux), CADT will add a directory called `cadt` when the application is first run. The main CADT configuration file is called `config.yaml` and can be found at `~/.chia/mainnet/cadt/config.yaml`. This unified config file has three sections: `APP` (shared configuration), `V1` (V1-specific settings), and `V2` (V2-specific settings). Database files are stored in `cadt/v1` and `cadt/v2` subdirectories. The options in the config file are as follows (the full list of available options can be seen in the [config template](src/utils/defaultConfig.js)):

* **APP**: This section contains shared configuration used by both V1 and V2 APIs.
  * **CW_PORT**: CADT port where the API will be available. 31310 by default.
  * **BIND_ADDRESS**: By default, CADT listens on localhost only. To enable remote connections to CADT, change this to `0.0.0.0` to listen on all network interfaces, or to an IP address to listen on a specific network interface.
  * **TRUST_PROXY**: Number of reverse-proxy hops between the internet and CADT. Used to correctly identify real client IP addresses for rate limiting and logging when CADT is deployed behind one or more proxies. Must be a non-negative integer: set to `0` (the default) when CADT is accessed directly with no proxy in front of it, `1` when behind a single proxy such as nginx or Cloudflare, or `2` when behind two proxies such as Cloudflare in front of nginx (a common cloud/k8s deployment). Booleans (`true`/`false`) and non-numeric strings (e.g. `loopback`) are rejected, log a warning at startup, and fall back to `0`; in particular, never set to `true`, which would trust the user-supplied IP in the `X-Forwarded-For` header and defeat rate limiting.
  * **DATALAYER_URL**: URL and port to connect to the [Chia DataLayer RPC](https://docs.chia.net/datalayer-rpc). If Chia is installed locally with default settings, https://localhost:8562 will work.
  * **WALLET_URL**: URL and port to connect to the [Chia Wallet RPC](https://docs.chia.net/wallet-rpc). If Chia is installed on the same machine as CADT with default settings, https://localhost:9256 will work.
  * **USE_SIMULATOR**: Developer setting to populate CADT from a governance file and enable some extra APIs. Should always be "false" under normal usage.
  * **CHIA_NETWORK**: CADT can run on Chia mainnet or any testnet. Set to "mainnet" for production instances or "testnet" if using the main Chia testnet.
  * **USE_DEVELOPMENT_MODE**: Should be false in most use cases. If a developer is writing code for the app, this can be changed to "true," which will bypass the need for a governance node.
  * **DEFAULT_FEE**: [Fee](https://docs.chia.net/mempool/) for each transaction on the Chia blockchain in mojos. The default is 3000 mojos and can be set higher or lower depending on how [busy](https://dashboard.chia.net/d/46EAA05E/mempool-transactions-and-fees?orgId=1) the Chia network is. If a fee is set very low, it may cause a delay in transaction processing.
  * **DEFAULT_COIN_AMOUNT**: Units are mojo. Each DataLayer transaction needs a coin amount, and the default is 300 mojo.
  * **CERTIFICATE_FOLDER_PATH**: If using a custom path for the Chia Blockchain certificates folder, enter the path here to allow CADT to find the certificates and authenticate to the Chia RPC. CADT assumes the folder structure within the directory specified matches the default Chia SSL directory of `$CHIA_ROOT/config/ssl/`.
  * **DATALAYER_FILE_SERVER_URL**: Publicly available URL and port where Chia Datalayer [files are served](#datalayer-http-file-serving), including schema (http:// or https://). If serving DataLayer files from S3, this would be the public URL of the S3 bucket. Port can be omitted if using standard ports for http or https requests.
  * **AUTO_SUBSCRIBE_FILESTORE**: Subscribing to the filestore for any organization is optional. To automatically subscribe and sync the filestore to every organization you subscribe to, set this to `true`.
  * **AUTO_MIRROR_EXTERNAL_STORES**: When set to true (the default), CADT will automatically create mirrors for each store you are subscribed to. Mirroring all subscriptions using the `DATALAYER_FILE_SERVER_URL` will make the entire CADT network more resilient and distributed. Note: `DATALAYER_FILE_SERVER_URL` must also be set to a valid URL or IP address for mirrors to be created. Both settings are required for external store mirroring to function.
  * **ONLY_CADT_SUBSCRIPTIONS**: When `true` (the default), CADT keeps DataLayer subscriptions aligned with the governance **orgList** in both directions. Organizations removed from the orgList are first unsubscribed from DataLayer, then removed from this node after unsubscribe is confirmed and the purge grace period has elapsed — the organization record and **all** of its local data (projects, units, and every related record it created) are deleted from the database. The deletion is unconditional: it does **not** check whether another organization references that data. Organizations on the orgList that are not subscribed are subscribed (including orgs re-added after a prior removal, including orgs previously removed via the API delete flow). The home organization and governance body store are never auto-removed. Reconciliation runs only after a successful governance sync provides a non-empty **orgList**; empty or stale cached governance data does not trigger removals. Set to `false` to disable orglist-driven subscribe/remove reconciliation. While enabled, a manual unsubscribe of an org still listed on the orgList will be reverted on the next sync cycle.
  * **LOG_LEVEL**: Controls verbosity of logging. Common settings are `info` and `debug`. Setting to `silly` will log all queries.
  * **TASKS**: Section for configuring sync intervals.
    * **GOVERNANCE_SYNC_TASK_INTERVAL**: Syncs picklist, orgList, and glossary from the governance node. Default 120 seconds (2 minutes).
    * **ORGANIZATION_META_SYNC_TASK_INTERVAL**: Subscribes to default organizations and refreshes metadata for already-imported organizations. Default 120 seconds (2 minutes).
    * **PICKLIST_SYNC_TASK_INTERVAL**: Syncs picklist from the governance node. Default 120 seconds (2 minutes).
    * **MIRROR_CHECK_TASK_INTERVAL**: Checks if our DataLayer is advertising our `DATALAYER_FILE_SERVER_URL` as a mirror for all subscriptions when `AUTO_MIRROR_EXTERNAL_STORES` is true. Default 900 seconds (15 minutes).
    * **VALIDATE_ORGANIZATION_TABLE_TASK_INTERVAL**: Validates the organization table periodically. Default 1800 seconds (30 minutes).
    * **COIN_MANAGEMENT_TASK_INTERVAL**: Splits wallet coins when usable coin count is low. Default 21600 seconds (6 hours).
  * **REQUEST_CONTENT_LIMITS**: Section for configuring request size limits to prevent denial-of-service attacks. These limits control the maximum array lengths in API requests.
    * **STAGING**:
      * **EDIT_DATA_LEN**: Maximum number of items in staging edit operations. Default 200.
    * **UNITS**:
      * **INCLUDE_COLUMNS_LEN**: Maximum number of columns to include in unit queries. Default 200.
      * **MARKETPLACE_IDENTIFIERS_LEN**: Maximum number of marketplace identifiers in unit queries. Default 200.
    * **PROJECTS**:
      * **INCLUDE_COLUMNS_LEN**: Maximum number of columns to include in project queries. Default 200.
      * **PROJECT_IDS_LEN**: Maximum number of project IDs in project queries. Default 200.
* **V1**: This section contains settings specific to the V1 API.
  * **ENABLE**: Set to `true` to enable the V1 API, or `false` to disable it. Default is `true`.
  * **READ_ONLY**: When hosting an Observer node, set to `true` to prevent any data from being written using the CADT V1 APIs. This makes the application safe to run with public endpoints as it is just displaying publicly available data. When running a governance node, or a participant node, set to `false` to allow data to be written to the CADT APIs. When `false`, additional authentication or access restrictions must be applied to prevent unauthorized alteration of the data.
  * **CADT_API_KEY**: This key is used by the [CADT UI](https://github.com/Chia-Network/cadt-ui) to authenticate with the CADT V1 API endpoints. This allows the API to power the UI only without allowing requests missing the API key in the header to access the API. This can be left blank to allow open access to the API or if access is restricted by other means. The CADT_API_KEY can be set to any value, but we recommend at least a 32-character random string. The CADT_API_KEY can be passed in a request using the `x-api-key` header. See the [RPC documentation](docs/cadt_rpc_api.md) for examples.
  * **IS_GOVERNANCE_BODY**: Set to `true` or `false` to enable/disable governance body mode for the V1 API.
  * **GOVERNANCE**: Section for governance body settings.
    * **GOVERNANCE_BODY_ID**: This determines the governance body your CADT V1 network will be connected to. While there could be multiple governance body IDs, the default of `23f6498e015ebcd7190c97df30c032de8deb5c8934fc1caa928bc310e2b8a57e` is the right ID for most people on mainnet.
  * **MIRROR_DB**: This section is for configuring a MySQL-compatible database that can be used for easy querying for report generation. This is optional and only provides a read-only mirror of the V1 data CADT uses.
    * **DB_USERNAME**: MySQL username.
    * **DB_PASSWORD**: MySQL password.
    * **DB_NAME**: MySQL database name.
    * **DB_HOST**: Hostname of the MySQL database.
* **V2**: This section contains settings specific to the V2 API.
  * **ENABLE**: Set to `true` to enable the V2 API, or `false` to disable it. Default is `true`.
  * **READ_ONLY**: When hosting an Observer node, set to `true` to prevent any data from being written using the CADT V2 APIs. This makes the application safe to run with public endpoints as it is just displaying publicly available data. When running a governance node, or a participant node, set to `false` to allow data to be written to the CADT APIs. When `false`, additional authentication or access restrictions must be applied to prevent unauthorized alteration of the data.
  * **CADT_API_KEY**: This key is used by the [CADT UI](https://github.com/Chia-Network/cadt-ui) to authenticate with the CADT V2 API endpoints. This allows the API to power the UI only without allowing requests missing the API key in the header to access the API. This can be left blank to allow open access to the API or if access is restricted by other means. The CADT_API_KEY can be set to any value, but we recommend at least a 32-character random string. The CADT_API_KEY can be passed in a request using the `x-api-key` header. See the [RPC documentation](docs/cadt_rpc_api_v2.md) for examples.
  * **IS_GOVERNANCE_BODY**: Set to `true` or `false` to enable/disable governance body mode for the V2 API.
  * **GOVERNANCE**: Section for governance body settings.
    * **GOVERNANCE_BODY_ID**: This determines the governance body your CADT V2 network will be connected to. The V2 governance body may be different from the V1 governance body.
  * **MIRROR_DB**: This section is for configuring a MySQL-compatible database that can be used for easy querying for report generation. This is optional and only provides a read-only mirror of the V2 data CADT uses.
    * **DB_USERNAME**: MySQL username.
    * **DB_PASSWORD**: MySQL password.
    * **DB_NAME**: MySQL database name.
    * **DB_HOST**: Hostname of the MySQL database.

Note that the CADT application will need to be restarted after any changes to the config.yaml file.

### Diagnostics

When debugging a local CADT install (wallet not reachable, DataLayer not syncing, network mismatch, low disk space), use the system-wide diagnostics endpoint. It is mounted at the server root, not under `/v1` or `/v2`:

```bash
curl -s -H 'x-api-key: YOUR_CADT_API_KEY' http://localhost:31310/diagnostics | jq .
```

The endpoint returns **403** on read-only observer nodes (`READ_ONLY=true`). It is designed to stay usable while other API routes are blocked by sync checks. If you cannot use the API endpoint, the diagnostics output is written to the CADT log upon startup.

The diagnostics endpoint contains a `status` field in each section, which reports `ok` if everything matches expected healthy values. Look for sections where the `status` value does not say `ok` for potential problem areas.

Lighter-weight health checks are also available: `GET /health`, `GET /v1/health`, `GET /v2/health`, and `GET /v1/health/wallet` or `GET /v2/health/wallet` for wallet-specific status.

See [System endpoints in the V1 RPC guide](docs/cadt_rpc_api.md#system-endpoints) and [System endpoints in the V2 RPC guide](docs/cadt_rpc_api_v2.md#system-endpoints) for request examples and response fields.

### How to use the API

CADT will be transitioning to version 2 of the API while phasing out version 1 of the API.  For v2 documenentation, please see the [CADT v2 RPC Guide](docs/cadt_rpc_api_v2.md).  For v1, please see the [CADT v1 RPC Guide](docs/cadt_rpc_api.md).

### Upgrading a v1 system to v2

V2 of the CADT API is available on versions above 1.7.25.  When a v2 compatible version is first run, the CADT config file will be migrated from the `~/.chia/mainnet/cadt/v1` directory to the `~/.chia/mainnet/cadt` directory.  This new config file will contain parameters for both the v1 and v2 API.  The v1 and v2 endpoints and sync services can be enabled and disabled individually.

Data cannot be migrated automatically from v1 to v2, but a v1 organization [can be upgraded](/docs/cadt_rpc_api_v2.md#upgrade-v1-organization-to-v2).

#### Disk space guard

CADT defensively rejects write requests when the filesystem holding the V1/V2 SQLite databases drops below a low-space threshold, so a full disk cannot corrupt the database mid-transaction. Operators should monitor for this and free space (or expand the volume) before it triggers.

* When free space falls below **1 GiB** (2³⁰ bytes), CADT logs a warning. Writes are still served.
* When free space falls below **512 MiB** (2²⁰ × 512 bytes), CADT rejects `POST`, `PUT`, and `PATCH` requests with HTTP `507 Insufficient Storage` and logs an error. `GET` reads and `DELETE` requests are still served so operators can free space without restarting the service. Note that a very large `DELETE` (e.g., a cascading delete that touches many rows) writes to the SQLite WAL during the transaction; if the disk is critically low even an allowed `DELETE` may run out of space before the next checkpoint, so prefer freeing files outside the database first.
* Log lines are emitted only on **severity transitions** (`ok` → `warn`, `warn` → `block`, recovery to `ok`, etc.) — not on every observation — so monitoring scrapes against `/health` cannot drown out the alert when free space first drops below a threshold.
* Current status is exposed under the `diskSpace` field on the `/health`, `/v1/health`, and `/v2/health` endpoints for monitoring. The field is `null` until the first probe completes, otherwise an object with `severity` (`ok` / `warn` / `block` / `unknown`), `freeBytes` (the lowest free-space figure observed across the V1/V2 data directories, or `null` when every probe failed), and the `blockBytes` / `warnBytes` thresholds. The 507 response body itself only contains `{message, error: "INSUFFICIENT_DISK_SPACE", success: false}` — exact byte counts are reserved for `/health` so anonymous callers (the disk-space gate runs before the `CADT_API_KEY` check) cannot enumerate operational state.

### Datalayer HTTP File Serving

CADT relies on all participants publicly sharing their data over Chia Datalayer, which includes sharing the Chia-generated `.dat` files over HTTP. See the [Quickstart](#quickstart) section for the recommended way to set this up. By default, the `.dat` files are located in `~/.chia/mainnet/data_layer/db/server_files_location_<NETWORK>/` (where `<NETWORK>` is the Chia network, usually either "mainnet" or "testneta") and can be shared over any web-accessible HTTP endpoint, including

* Using Nginx, Apache, Caddy, or any other web server.  A static IP address, or stable DNS record, will be required, which is not offered by default on some hosting providers.  On AWS, assign an Elastic IP to the EC2 instance or use an Application Load Balancer to solve this.  Another challenge is that the default location for the .dat files is in the user's home directory, which the web server software will not have read-access to.  One simple solution is
  * `mv ~/.chia/mainnet/data_layer/db/server_files_location_<NETWORK> /var/www/` - move the datalayer file directory outside of the home directory
  * `chmod -R 744 /var/www/server_files_location_<NETWORK>` - change permissions on all datalayer files to be read by any user
  * `ln -s /var/www/server_files_location_<NETWORK> ~/.chia/mainnet/data_layer/db/server_files_location_<NETWORK>` - create a shortcut from the old location to the new
  * Use [Nginx](https://nginx.org/), [Apache](https://httpd.apache.org/), [Caddy](https://caddyserver.com/), or any web server to serve the files over HTTP.
* Use [S3](https://aws.amazon.com/s3/) or other object store.  Datalayer .dat files can be synced to any cloud file storage solution that can serve them publicly over HTTP.  One recommended solution using S3 is to [use this script and follow the installation and usage instructions in the README](https://github.com/TheLastCicada/Chia-Datalayer-S3-Sync).

Once the .dat files are publicly available, update `DATALAYER_FILE_SERVER_URL` in the [CADT configuration file](#configuration) with the URL or IP address (always include http:// or https://) and the port, then restart CADT.  CADT will begin to create mirrors at this URL for your data and all stores you are subscribed to.

### Pre-release Versions

Experimental code is released with a "release candidate" naming convention and can be found on the [releases](/releases) page with `-rc` in the version number. Not all of the release candidates will be stable and caution should be used.

Release candidates can be installed via `apt` using the [Quickstart](#quickstart) instructions, except replace the CADT apt repository with the following:

```bash
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/chia.gpg] https://repo.chia.net/cadt-test/debian/ stable main" | sudo tee /etc/apt/sources.list.d/cadt-test.list > /dev/null
```

If both the stable and release-candidate repos are added, `apt` can switch between versions installed using by appending `=<version-number>` to the install command:

```bash
apt install cadt=1.7.19
apt install cadt=1.7.21-rc7
```

Without specifying the version number, `apt` will install the latest release candidate if it exists, which might not always be desired.

### Run CADT on a Testnet

Chia has a few test networks called "[testnets](https://docs.chia.net/testnets/)".  Testnets allow anyone to test applications using plentiful and low value TXCH instead of needing to purchace XCH.  We recommend running a testnet version of CADT in order to test integrations, software updates, and experiment in a low-stakes environment.

CADT runs on a testnet called "testnetA" which is different than the main Chia testnet, testnet11.  TestnetA has a CADT governance node and an [observer](https://chia-cadt-demo.chiamanaged.com/).  To configure your Chia and CADT environment to use testnetA, do the following:

*Note - these instructions only work with Chia version 2.4.4 and above*

1. Follow the [instructions here and install chia-tools](https://github.com/chia-network/chia-tools?tab=readme-ov-file#apt-repo-installation).
1. Use chia-tools to switch to testneta in the Chia config.

   ```bash
   chia-tools network switch testneta
   ```

1. Restart Chia.

   ```bash
   sudo systemctl restart chia-wallet@<USERNAME> chia-data-layer@<USERNAME> chia-full-node@<USERNAME>
   ```

1. Stop CADT.

   ```bash
   sudo systemctl stop cadt@<USERNAME>
   ```

1. Update the `GOVERNANCE_BODY_ID` in the `V1` section of `~/.chia/mainnet/cadt/config.yaml` to be `1019153f631bb82e7fc4984dc1f0f2af9e95a7c29df743f7b4dcc2b975857409`.
1. If you already were running CADT on mainnet, delete the CADT database.

   ```bash
   rm ~/.chia/mainnet/cadt/v1/data.sqlite3*
   ```

1. Start CADT.

   ```bash
   sudo systemctl start cadt@<USERNAME>
   ```

### Ports, Networking, and Security

By default, the CADT API will listen on localhost only on port 31310. If running a node with `READ_ONLY` set to `false`, it is highly recommended that CADT is run on a private network or with access limited by IP address. To allow remote connections to CADT, set the `BIND_ADDRESS` (see the [Configuration](#configuration) section below) to the IP to listen on, or `0.0.0.0` to listen on all interfaces. The port for the CADT API can be set with the parameter `CW_PORT`.  The default port is 31310. In many cases, users will need to access the API from their workstations for either the [CADT UI](https://github.com/Chia-Network/cadt-ui) or to integrate with existing tools and scripts. To add authentication to the API, use the `CADT_API_KEY` parameter.  Alternatively, the API can be served behind an authentication proxy to restrict access and the `CADT_API_KEY` can be left blank. If running an observer node with `READ_ONLY` set to `true`, the CADT API will only share data from the public blockchain, and running without authentication is usually safe. If `READ_ONLY` is set to `false`, authentication must be used to prevent unauthorized writes to the blockchain.

### Adding Encryption to the CADT API

The CADT API uses HTTP and is unencrypted. To add encryption, use a reverse proxy like [Nginx](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/) with an SSL certificate. In this scenario, the CADT application can be set to listen only on localhost, and Nginx (on the same server) will proxy incoming requests to port 31310.

## Tools

### update-ip.sh

The [`update-ip.sh`](tools/update-ip.sh) script in the `tools` directory helps manage the `DATALAYER_FILE_SERVER_URL` configuration when your server's IP address changes. This is particularly useful for servers with dynamic IP addresses. Note that this script must be run as root (using sudo).

```bash
sudo ./tools/update-ip.sh --chia-user=<username> [--port=<port>] [--https] [--dry-run]
```

- `--chia-user=<username>`: (Required) The username of the Chia user whose configuration will be updated
- `--dry-run`: (Optional) Run in dry-run mode to see what changes would be made without actually making them
- `--port=<port>`: (Optional) Specify a custom port for the DATALAYER_FILE_SERVER_URL. If not provided, the script will use the port from your Chia config file.
- `--https`: (Optional) Use HTTPS instead of HTTP for the DATALAYER_FILE_SERVER_URL. If not provided, HTTP will be used.

This script does the following:

1. Fetches your current public IP address
2. Updates the `DATALAYER_FILE_SERVER_URL` in your Core Registry CADT config file
3. Deletes all mirrors using `chia-tools data delete-mirrors --all`
4. Restarts the Core Registry CADT service

## Developer Guide

For developers looking to use AI to assist with a CADT integration, please reference the machine-to-machine schema and its human-readable mapping reference:

- [`docs/cadtrust-schema-v2.0.2.json`](docs/cadtrust-schema-v2.0.2.json) — machine-readable schema (field definitions, picklists, insert order, validation rules, v1 → v2 migration notes)
- [`docs/CADTrust_Machine_Readable_Schema_v2.0.2_Schema_Mapping_Reference.pdf`](docs/CADTrust_Machine_Readable_Schema_v2.0.2_Schema_Mapping_Reference.pdf) — schema mapping reference document
- [Data Model Overview in the v2 RPC guide](docs/cadt_rpc_api_v2.md#data-model-overview) — table hierarchy, insert order, and integration rules for AI agents and ETL pipelines

A development environment for CADT assumes a synced Chia wallet running locally. [Node version manager (nvm)](https://github.com/nvm-sh/nvm) is used to switch node environments quickly. The repo contains a `.nvmrc` file that specifies the node version the CADT is expected to use and developers can do `nvm use` to switch to the version in the `.nvmrc`.

### Installation from Source

*Installation from source is only recommended for those contributing code to CADT and is not intended to be used in production.*

You'll need:

- Git
- [nvm](https://github.com/nvm-sh/nvm) - This app uses `nvm` to align node versions across development, CI and production. If you're working on Windows, you should consider [nvm-windows](https://github.com/coreybutler/nvm-windows)
- C/C++ build tools for compiling the SQLite native module (see below)
- A working [Chia installation](https://docs.chia.net/installation/#using-the-cli) running wallet and datalayer (full node recommended)

#### Build Prerequisites

The `sqlite3` npm package is compiled from source during `npm install` to ensure compatibility across platforms. This requires a C/C++ toolchain and Python 3:

**Debian / Ubuntu:**

```bash
sudo apt-get install -y build-essential python3
```

**macOS:**

```bash
xcode-select --install
```

To install from source:

```bash
git clone git@github.com:Chia-Network/cadt.git
cd cadt
nvm install
nvm use
npm install
npm run start
```

### Contributing

All branches should be created from the `develop` branch and not from `main`. All pull requests should be made against the `develop` branch unless it is a new release. The `develop` branch will be merged into the `main` branch to create a release. Automation in the CI will create the [release](https://github.com/Chia-Network/cadt/releases) and attach the installation files to it automatically whenever code is merged to `main`. Additionally, the changelog will automatically be updated in the `main` branch. Therefore, the `main` branch should always be a representation of the latest released code.

This repo uses a [commit convention](https://www.conventionalcommits.org/en/v1.0.0/). A typical commit message might read:

```text
fix: correct home screen layout
```

The first part of this is the commit "type". The most common types are "feat" for new features and "fix" for bugfixes. Using these commit types helps us correctly manage our version numbers and changelogs. Since our release process calculates new version numbers from our commits, getting this right is very important.

- `feat` is for introducing a new feature
- `fix` is for bug fixes
- `docs` for documentation only changes
- `style` is for code formatting only
- `refactor` is for changes to code that should not be detectable by users or testers
- `perf` is for a code change that improves performance
- `test` is for changes that only touch test files or related tooling
- `build` is for changes that only touch our develop/release tools
- `ci` is for changes to the continuous integration files and scripts
- `chore` is for changes that don't modify code, like a version bump
- `revert` is for reverting a previous commit

After the type and scope, there should be a colon (`:`).

The "subject" of the commit follows. It should be a short indication of the change. The commit convention prefers that this is written in the present-imperative tense.

### Versioning

This project mostly adheres to semantic versioning.  The version specified in `package.json` will be used by the ci to create the new release in Github, so it is important to set that correctly.  The major version (version 1.0, 2.0, etc) should only be changed when the data model changes and the API goes from v1 to v2.  Minor version changes (version 1.2 to 1.3, etc.) are for breaking or substantial changes, usually requiring some action on the user's part.

### Commit linting

Each time you commit the message will be checked against these standards in a pre-commit hook. Additionally, all the commits in a PR branch will be linted before it can be merged to master.

To set up the pre-commit hooks on your local, run the following:

```bash
npm install -g @babel/cli husky prettier lint-staged cross-env
npm set-script prepare "husky install"
npm run prepare

# If you are on linux or mac run
chmod ug+x .husky/*
chmod ug+x .git/hooks/*
```

### Build Binaries

After running the ["Installation from Source"](https://github.com/Chia-Network/cadt#installation-from-source) steps above, do the following:

```bash
# transcompile project to es5
npm run build

# Output binaries to dist folder
npm run create-win-x64-dist
npm run create-mac-x64-dist
npm run create-linux-x64-dist
```

#### Connecting to Socket.IO

CADT exposes Socket.IO namespaces at `http://localhost:31310/v1/ws` and `http://localhost:31310/v2/ws`.

After connecting, emit `'/subscribe'` with the feed you want to receive:

* V1 feeds: `projects`, `units`, `staging`
* V2 feeds: `projects-v2`, `units-v2`, `staging-v2`

Subscribed clients receive Socket.IO events such as `change:projects`, `change:units`, `change:projects-v2`, or `change:units-v2` when matching records change.

## Attribution

* [Document Object Model](https://www.w3.org/TR/DOM-Requirements/) by [W3C](https://www.w3.org/) licensed under [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/)
* [caniuselite](https://github.com/browserslist/caniuse-lite) by [Browserlist](https://browsersl.ist/) licensed under [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/)
