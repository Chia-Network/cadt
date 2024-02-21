# Climate Action Data Trust 

**Please review the [CAD Trust Terms and Conditions](docs/CAD_Trust_Registry_Terms_and_Conditions.pdf) and [CAD Trust User Terms and Conditions](docs/CAD_Trust_User_Terms_and_Conditions.pdf).**

​This project provides the Climate Action Data Trust (CADT) API that integrates with the [Chia Blockchain](https://github.com/Chia-Network/chia-blockchain). For a user interface, see the [CADT UI project](https://github.com/Chia-Network/climate-warehouse-ui), which will connect to the CADT API.

This project was formerly known as the Climate Warehouse, and you may see this term used interchangeably with CADT. 

*Pagination is now strongly recommended on the units, projects, and issuances [API endpoints](docs/cadt_rpc_api.md) and will be mandatory in the future. Please adjust your API calls accordingly.*

## User Guide

The CADT application is designed to run 24/7, much like any other API.  While it is possible to run it on-demand only when API requests need to be made, this guide assumes a permanently running solution.  

The simplest way to run the CADT application is to use the same machine the Chia Full Node, Wallet, Datalayer, and Datalayer HTTP services reside on. CADT communicates with the Chia services over an RPC interface.  The RPC interface uses certificates to authenticate, which will work automatically when the CADT application is run as the same user on the same machine as the Chia services.  To run CADT on a separate machine from Chia, a public certificate from the Chia node must be used to authenticate (not yet documented).

For Chia installation instructions, please see the [Chia docs site](https://docs.chia.net/installation/).  For most CADT setups, we recommend the installing the headless `chia-blockchain-cli` package via the `apt` repo and using [systemd](https://docs.chia.net/installation/#systemd) to start/stop and automatically start Chia at boot.

### How to use the API

Please see the [CADT RPC API Guide](docs/cadt_rpc_api.md).

## Installation

[Releases are tagged in Github](https://github.com/Chia-Network/climate-warehouse/tags), and binaries are built for Windows, macOS, and Linux. ARM binaries are available for Debian versions of Linux only. 

### System Requirements

CADT and Chia system usage will depend on many factors, including how busy the blockchain is, how much data is being mirrored by DataLayer, and how much data CADT is ingesting and processing.  The current minimum requirements for running CADT and Chia together on a system are:

* 4 CPU cores
* 8 GB RAM
* 300 GB disk space

ARM and x86 systems are supported.  While Windows, MacOS, and all versions of Linux are supported, Ubuntu Linux is the recommended operating system as is used most in testing and our internal hosting. 

### Linux

A binary file that can run on all Linux distributions on x86 hardware can be found for each tagged release named `cadt-linux-x64-<version>.zip`.  This zip file will extract to the `cadt-linux-64` directory by default, where the `cadt` file can be executed to run the API.  

#### Debian-based Linux Distros (Ubuntu, Mint, etc)

The CADT API can be installed with `apt`.  Both ARM and x86 versions can be installed this way. 

1. Start by updating apt and allowing repository download over HTTPS:

```
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg
```

2.  Add Chia's official GPG Key (if you have installed Chia with `apt`, you'll have this key already and will get a message about overwriting the existing key, which is safe to do):

```
curl -sL https://repo.chia.net/FD39E6D3.pubkey.asc | sudo gpg --dearmor -o /usr/share/keyrings/chia.gpg
```

3. Use the following command to set up the repository.

```
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/chia.gpg] https://repo.chia.net/cadt/debian/ stable main" | sudo tee /etc/apt/sources.list.d/cadt.list > /dev/null
```

4.  Install CADT

```
sudo apt-get update
sudo apt-get install cadt
```

5.  Start CADT with systemd

```
sudo systemctl start cadt@<USERNAME>
```
For `<USERNAME>`, enter the user that Chia runs as (the user with the `.chia` directory in their home directory).  For example, if the `ubuntu` is where Chia runs, start CADT with `systemctl start cadt@ubuntu`.

6.  Set CADT to run at boot

```
sudo systemctl enable cadt@<USERNAME>
```

### Installation from Source

You'll need:
​
- Git
- [nvm](https://github.com/nvm-sh/nvm) - This app uses `nvm` to align node versions across development, CI and production. If you're working on Windows, you should consider [nvm-windows](https://github.com/coreybutler/nvm-windows)

To install from source:

```
git clone git@github.com:Chia-Network/cadt.git
cd cadt
nvm install 18.16
nvm use 18.16
npm run start
```

### Ports, Networking, and Security

By default, the CADT API will listen on localhost only on port 31310. If running a node with `READ_ONLY` set to `false`, it is highly recommended that CADT is run on a private network or with access limited by IP address. To allow remote connections to CADT, set the `BIND_ADDRESS` (see the [Configuration](#configuration) section below) to the IP to listen on, or `0.0.0.0` to listen on all interfaces. The port for the CADT API can be set with the parameter `CW_PORT`.  The default port is 31310. In many cases, users will need to access the API from their workstations for either the [CADT UI](https://github.com/Chia-Network/climate-warehouse-ui) or to integrate with existing tools and scripts. To add authentication to the API, use the `CADT_API_KEY` parameter.  Alternatively, the API can be served behind an authentication proxy to restrict access and the `CADT_API_KEY` can be left blank. If running an observer node with `READ_ONLY` set to `true`, the CADT API will only share data from the public blockchain, and running without authentication is usually safe. If `READ_ONLY` is set to `false`, authentication must be used to prevent unauthorized writes to the blockchain. 

### Adding Encryption to the CADT API

The CADT API uses HTTP and is unencrypted. To add encryption, use a reverse proxy like [Nginx](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/) with an SSL certificate. In this scenario, the CADT application can be set to listen only on localhost, and Nginx (on the same server) will proxy incoming requests to port 31310.

### Configuration

In the `CHIA_ROOT` directory (usually `~/.chia/mainnet` on Linux), CADT will add a directory called `cadt/v1` when the application is first run (in fact, this directory could be deleted at any time and CADT will recreate it next time it is started).  The main CADT configuration file is called `config.yaml` and can be found in this directory.  The options in this file are as follows (the full list of available options can be seen in the [config template](src/utils/defaultConfig.json)):

* **MIRROR_DB**: This section is for configuring the MySQL-compatible database that can be used for easy querying for report generation. This is optional and only provides a read-only mirror of the data CADT uses. 
  *  **DB_USERNAME**:  MySQL username
  *  **DB_PASSWORD**: MySQL password
  *  **DB_NAME**: MySQL database name
  *  **DB_HOST**: Hostname of the MySQL database
* **APP**:  This section is for configuring the CADT application.
  * **CW_PORT**: CADT port where the API will be available. 31310 by default.
  * **BIND_ADDRESS**: By default, CADT listens on localhost only. To enable remote connections to CADT, change this to `0.0.0.0` to listen on all network interfaces, or to an IP address to listen on a specific network interface. 
  * **DATALAYER_URL**: URL and port to connect to the [Chia DataLayer RPC](https://docs.chia.net/datalayer-rpc). If Chia is installed locally with default settings, https://localhost:8562 will work. 
  * **WALLET_URL**: URL and port to connect to the [Chia Wallet RPC](https://docs.chia.net/wallet-rpc). If Chia is installed on the same machine as CADT with default settings, https://localhost:9256 will work.
  * **USE_SIMULATOR**: Developer setting to populate CADT from a governance file and enable some extra APIs. Should always be "false" under normal usage. 
  * **READ_ONLY**: When hosting an Observer node, set it to "true" to prevent any data from being written using the CADT APIs. This makes the application safe to run with public endpoints as it is just displaying publicly available data.  When running a governance node, or a participant node, set to "false" to allow data to be written to the CADT APIs. When "false", additional authentication or access restrictions must be applied to prevent unauthorized alteration of the data.  
  * **CADT_API_KEY**: This key is used by the [CADT UI](https://github.com/Chia-Network/climate-warehouse-ui) to authenticate with the CADT API endpoints. This allows the API to power the UI only without allowing requests missing the API key in the header to access the API.  This can be left blank to allow open access to the API or if access is restricted by other means. The CADT_API_KEY can be set to any value, but we recommend at least a 32-character random string. The CADT_API_KEY can be passed in a request using the `x-api-key` header. See the [RPC documentation](docs/climate_warehouse_rpc_api.md) for examples. 
  * **CHIA_NETWORK**:  CADT can run on Chia mainnet or any testnet. Set to "mainnet" for production instances or "testnet" if using the main Chia testnet. 
  * **USE_DEVELOPMENT_MODE**:  Should be false in most use cases.  If a developer is writing code for the app, this can be changed to "true," which will bypass the need for a governance node.
  * **IS_GOVERNANCE_BODY**: "True" or "false" toggle to enable/disable mode for this instance being a governing body.
  * **DEFAULT_FEE**: [Fee](https://docs.chia.net/mempool/) for each transaction on the Chia blockchain in mojos. The default is 300000000 mojos (0.0003 XCH) and can be set higher or lower depending on how [busy](https://dashboard.chia.net/d/46EAA05E/mempool-transactions-and-fees?orgId=1) the Chia network is.  If a fee is set very low, it may cause a delay in transaction processing.  
  * **DEFAULT_COIN_AMOUNT**: Units are mojo. Each DataLayer transaction needs a coin amount, and the default is 300000000 mojo.  
  * **CERTIFICATE_FOLDER_PATH**: If using a custom path for the Chia Blockchain certificates folder, enter the path here to allow CADT to find the certificates and authenticate to the Chia RPC.  CADT assumes the folder structure within the directory specified matches the default Chia SSL directory of `$CHIA_ROOT/config/ssl/`.
  * **DATALAYER_FILE_SERVER_URL**: Publicly available Chia DataLayer HTTP URL and port, including schema (http:// or https://).  If serving DataLayer files from S3, this would be the public URL of the S3 bucket. Port can be omitted if using standard ports for http or https requests. 
  * **AUTO_SUBSCRIBE_FILESTORE**: Subscribing to the filestore for any organization is optional. To automatically subscribe and sync the filestore to every organization you subscribe to, set this to `true`.
  * **TASKS**: Section for configuring sync intervals
    * **AUDIT_SYNC_TASK_INTERVAL**:  Default 30
    * **DATAMODEL_SYNC_TASK_INTERVAL**:  Default 60
    * **GOVERNANCE_SYNC_TASK_INTERVAL**:  Default 86400
    * **ORGANIZATION_META_SYNC_TASK_INTERVAL**:  Default 86400
    * **PICKLIST_SYNC_TASK_INTERVAL**:  Default 30
* **GOVERNANCE**: Section on settings for the Governance body to connect to.
  * **GOVERNANCE_BODY_ID**: This determines the governance body your CADT network will be connected to.  While there could be multiple governance body IDs, the default of `23f6498e015ebcd7190c97df30c032de8deb5c8934fc1caa928bc310e2b8a57e` is the right ID for most people. 

​
Note that the CADT application will need to be restarted after any changes to the config.yaml file. 

## Developer Guide

A development environment for CADT assumes a synced Chia wallet running locally. [Node version manager (nvm)](https://github.com/nvm-sh/nvm) is used to switch node environments quickly. The repo contains a `.nvmrc` file that specifies the node version the CADT is expected to use and developers can do `nvm use` to switch to the version in the `.nvmrc`.  

### Contributing

All branches should be created from the `develop` branch and not from `main`. All pull requests should be made against the `develop` branch unless it is a new release. The `develop` branch will be merged into the `main` branch to create a release. Automation in the CI will create the [release](https://github.com/Chia-Network/cadt/releases) and attach the installation files to it automatically whenever code is merged to `main`. Additionally, the changelog will automatically be updated in the `main` branch. Therefore, the `main` branch should always be a representation of the latest released code.  

​This repo uses a [commit convention](https://www.conventionalcommits.org/en/v1.0.0/). A typical commit message might read:
​
```
    fix: correct home screen layout
```
​
The first part of this is the commit "type". The most common types are "feat" for new features and "fix" for bugfixes. Using these commit types helps us correctly manage our version numbers and changelogs. Since our release process calculates new version numbers from our commits, getting this right is very important.
​

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
  ​
  After the type and scope, there should be a colon (`:`).
  ​
  The "subject" of the commit follows. It should be a short indication of the change. The commit convention prefers that this is written in the present-imperative tense.

### Versioning

This project mostly adheres to semantic versioning.  The version specified in `package.json` will be used by the ci to create the new release in Github, so it is important to set that correctly.  The major version (version 1.0, 2.0, etc) should only be changed when the data model changes and the API goes from v1 to v2.  Minor version changes (version 1.2 to 1.3, etc.) are for breaking or substantial changes, usually requiring some action on the user's part.    
  ​

### Commit linting

​
Each time you commit the message will be checked against these standards in a pre-commit hook. Additionally, all the commits in a PR branch will be linted before it can be merged to master.

To set up the pre-commit hooks on your local, run the following:
​
```
npm install -g @babel/cli husky prettier lint-staged cross-env
npm set-script prepare "husky install"
npm run prepare
​
// If you are on linux or mac run
chmod ug+x .husky/*
chmod ug+x .git/hooks/*
```

### Build Binaries

After running the ["Installation from Source"](https://github.com/Chia-Network/cadt#installation-from-source) steps above, do the following: 

```
// transcompile project to es5
npm run build
​
// Output binaries to dist folder
npm run create-win-x64-dist
npm run create-mac-x64-dist
npm run create-linux-x64-dist
```

### Sequelize Generator
​
#### Creating Model and Migration Script

​
Use the following command to create a model and a migration script
​
npx sequelize-cli model:generate --name User --attributes firstName:string,lastName:string,email:string
​

#### Running Migrations

​
Migrations run automatically when you run the software. There is no manual tool that needs to be used.
​

#### Making changes to Migrations without rolling back

​
If you want to alter, drop, or add a column or add a foreign key or anything with the table. Use the following command to create a barebones migration script
​
npx sequelize-cli migration:generate --name <enter-type-of-change-here>
​

#### Running Full Text Search Queries

​
To run an FTS query on a supported table, you can use the `MATCH` operator. A virtual column `rank` is also available for sorting purposes.
​
Example:
​

```
SELECT rank, * FROM projects_fts WHERE projects_fts MATCH "PartialMatch*" ORDER BY rank
​
The '*' in the match is needed for wildcard
```

​
More info: https://www.sqlite.org/fts5.html
​

#### Connecting to the WebSocket


1. Open a WebSocket connection to http://localhost:31310/v1/ws
   1. Once subscribed, emit either emit ...['subscribe', 'units'] or ['subscribe', 'projects']. You can emit both on the same connection
2. You will receive frames that look like ...[change:units, {orgUid: '123'}], letting you know that there has been an update to a record
   Coll
