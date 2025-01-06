# Core Registry CADT

![Tested Up to Chia Version](https://raw.githubusercontent.com/Chia-Network/core-registry-api/main/testedChiaVersion.svg)

​This project is based on the [Climate Action Data Trust (CADT)](https://github.com/Chia-Network/cadt) application that provides the Climate Action Data Trust (CADT) API that integrates with the [Chia Blockchain](https://github.com/Chia-Network/chia-blockchain).  This project extends the CADT functionality for better integration with the Core Registry suite of climate tokenization tools.  In most ways, it will be compatible with the upstream CADT project.  For a user interface, see the [CADT UI project](https://github.com/Chia-Network/climate-warehouse-ui) which will connect to the Core Registry CADT API.

This project was formerly known as the Climate Warehouse and you may see this term used interchangeably with CADT. 

*Note that breaking changes are introduced in version 1.3.0 and those with older installs are encourage to uninstall and reinstall the CADT software.  Please see the [release notes](https://github.com/Chia-Network/climate-warehouse/releases/tag/1.2.29) for more details.*

## User Guide

The Core Registry CADT application is designed to run 24/7, much like any other API.  While it is possible to run it on-demand only when API requests need to be made, this guide assumes a permanently running solution.  

The simplest way to run the Core Registry CADT application is to use the same machine the Chia Full Node, Wallet, Datalayer, and Datalayer-HTTP services reside on. Core Registry CADT communicates with the Chia services over an RPC interface.  The RPC interface uses certificates to authenticate, which will work automatically when the Core Registry CADT application is run as the same user on the same machine as the Chia services.  To run Core Registry CADT on a separate machine from Chia, a public certificate from the Chia node must be used to authenticate (not yet documented).

Basic Chia installation instructions are provided below, but further installation options, please see the [Chia docs site](https://docs.chia.net/installation/).  For most Core Registry CADT setups, we recommend the installing the headless `chia-blockchain-cli` package via the `apt` repo and using [systemd](https://docs.chia.net/installation/#systemd).

After the initial installation, it will take anywhere from a few days (most likely for a cloud-hosted server) to a few weeks (possible on lower-powered systems or servers with slow connections) to sync the Chia full node.  During this time, Core Registry CADT can start syncing, but any writes to Core Registry CADT are likely to fail.  For best results, we recommend waiting for the Chia full node to finish syncing before using Core Registry CADT.  Check the status of the full node sync with `chia show -s`.  

*Those familiar with bittorrent and have a fast connection can speed up the full node syncing by [downloading the database](https://www.chia.net/downloads/#database-checkpoint) and copying it into place manually*

### How to use the API

Please see the [Core Registry CADT RPC API Guide](docs/cadt_rpc_api.md).

## Installation

[Releases are tagged in Github](https://github.com/Chia-Network/Core-Registry-CADT/tags) and binaries are built for Windows, MacOS, and Linux.  ARM binaries are available for Debian versions of Linux only. 

### Linux

A binary file that can run on all Linux distributions on x86 hardware can be found for each tagged release with the name `core-registry-cadt-linux-x64-<version>.zip`.  This zip file will extract to the `core-registry-cadt-linux-64` directory by default, where the `core-registry-cadt` file can be executed to run the API.  

### System Requirements

CADT and Chia system usage will depend on many factors, including how busy the blockchain is, how much data is being mirrored by DataLayer, and how much data CADT is ingesting and processing.  The current minimum requirements for running CADT and Chia together on a system are:

* 4 CPU cores
* 8 GB RAM
* 300 GB disk space

ARM and x86 systems are supported.  While Windows, MacOS, and all versions of Linux are supported, Ubuntu Linux is the recommended operating system as it is used most in testing and our internal hosting. 

#### Debian-based Linux Distros (Ubuntu, Mint, etc)

The Core Registry CADT API can be installed with `apt`.  Both ARM and x86 versions can be installed this way. 

1. Start by updating apt and allowing repository download over HTTPS:

```
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg
```

2.  Add Chia's official GPG Key (if you have installed Chia with `apt`, you'll have this key already and will get a message about overwriting the existing key, which is safe to do):

```
curl -sL https://repo.chia.net/FD39E6D3.pubkey.asc | sudo gpg --dearmor -o /usr/share/keyrings/chia.gpg
```

3. Use the following command to setup the Core-Registry-CADT repository.

```
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/chia.gpg] https://repo.chia.net/climate-tokenization/debian/ stable main" | sudo tee /etc/apt/sources.list.d/climate-tokenization.list > /dev/null

```

4. Add the Chia repository (via the [official Chia installation instructions](https://docs.chia.net/installation/#using-the-cli))

```
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/chia.gpg] https://repo.chia.net/debian/ stable main" | sudo tee /etc/apt/sources.list.d/chia.list > /dev/null
```

5.  Install Chia Blockchain and Core-Registry-CADT

```
sudo apt-get update
sudo apt-get install chia-blockchain-cli core-registry-cadt
```

6.  Start Chia Wallet and Datalayer with [systemd](https://docs.chia.net/installation/#systemd)

```
sudo systemctl start chia-wallet@<USERNAME> chia-data-layer@<USERNAME> chia-full-node@<USERNAME>
```

For `<USERNAME>`, enter the user that Chia runs as (the user with the `.chia` directory in their home directory).  For example, if the `ubuntu` is where Chia runs, start Chia with `systemctl start chia-wallet@ubuntu`.

Optional:  If using Chia's built-in HTTP server to share datalayer files, start the `chia-data-layer-http` service with

```
sudo systemctl start chia-data-layer-http@<USERNAME>
```

7.  Start CADT with systemd

```
sudo systemctl start core-registry-cadt@<USERNAME>
```
For `<USERNAME>`, enter the user that Chia runs as (the user with the `.chia` directory in their home directory).  For example, if the `ubuntu` is where Chia runs, start CADT with `systemctl start core-registry-cadt@ubuntu`.

8.  Set Chia and Core-Registry-CADT to run at boot

```
sudo systemctl enable chia-wallet@<USERNAME> chia-data-layer@<USERNAME> chia-full-node@<USERNAME> core-registry-cadt@<USERNAME>
```

If using the built-in HTTP server for datalayer, start it at boot with

```
sudo systemctl enable chia-data-layer-http@<USERNAME>
```

9.  View CADT logs to validate

```
journalctl -u cadt@<USERNAME> -f
(ctrl+c to exit)
```

### Pre-release Versions

Experimental code is released with a "release candidate" naming convention and can be found on the [releases](/releases) page with `-rc` in the version number. Not all of the release candidates will be stable and caution should be used.  

Release candidates can be installed via `apt` using the instructions (above)[#debian-based-linux-distros-ubuntu-mint-etc] except replace step 3 with the following:

```
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/chia.gpg] https://repo.chia.net/climate-tokenization-test/debian/ stable main" | sudo tee /etc/apt/sources.list.d/climate-tokenization-test.list > /dev/null
```

If both the stable and release-candidate repos are added, `apt` can switch between versions installed using by appending `=<version-number>` to the install command:

```
apt install climate-tokenization-engine=1.3.22
apt install climate-tokenization-engine=1.3.23-rc7
apt install climate-tokenization-engine=1.2.1
```

Without specifying the version number, `apt` will install the latest release candidate if it exists, which might not always be desired. 

### Installation from Source

You'll need:
​
- Git
- [nvm](https://github.com/nvm-sh/nvm) - This app uses `nvm` to align node versions across development, CI and production. If you're working on Windows you should consider [nvm-windows](https://github.com/coreybutler/nvm-windows)

To install from source:

```
git clone git@github.com:Chia-Network/core-registry-cadt.git
cd core-registry-cadt
nvm install
nvm use
npm install
npm run start
```

### Datalayer HTTP File Serving

CADT relies on all participants publicly sharing their data over Chia Datalayer, which includes sharing the Chia-generated `.dat` files over HTTP.  The files are located in `~/.chia/mainnet/data_layer/db/server_files_location_<NETWORK>/` (where `<NETWORK>` is the Chia network, usually either "mainnet" or "testneta") and can be shared over any web-accessible HTTP endpoint, including

* Using the built-in datalayer-http service (see [Installation](#installation) instructions below).  Datalayer-http runs on port 8575 by default which may need to be opened in your firewall configuration or forwarded by your router.  Additionally, a static IP address, or stable DNS record, will be required, which is not offered by default on some hosting providers.  On AWS, assign an Elastic IP to the EC2 instance or use an Application Load Balancer to solve this.  

* Using Nginx, Apache, Caddy, or any other web server.  This also requires a static IP address, or dynamically assigned DNS record.  Another challenge is that the default location for the .dat files is in the user's home directory, which the web server software will not have read-access to.  One simple solution is 
  * `mv ~/.chia/mainnet/data_layer/db/server_files_location_<NETWORK> /var/www/` - move the datalayer file directory outside of the home directory
  * `chmod -R 744 /var/www/server_files_location_<NETWORK>` - change permissions on all datalayer files to be read by any user
  * `ln -s /var/www/server_files_location_<NETWORK> ~/.chia/mainnet/data_layer/db/server_files_location_<NETWORK>` - create a shortcut from the old location to the new
  * Use [Nginx](https://nginx.org/), [Apache](https://httpd.apache.org/), [Caddy](https://caddyserver.com/), or any web server to serve the files over HTTP.  Here is a sample Nginx config:

  ```
  server {
    listen 80;

    root /var/www/server_files_location_<NETWORK>;

    server_name datalayer.example.com;

    index index.html;

    expires 30d;
    add_header Pragma "public";
    add_header Cache-Control "public";
    
  }
  ```

* Use [S3](https://aws.amazon.com/s3/) or other object store.  Datalayer .dat files can be synced to any cloud file storage solution that can serve them publicly over HTTP.  One recommended solution using S3 is to [use this script and follow the installation and usage instructions in the README](https://github.com/TheLastCicada/Chia-Datalayer-S3-Sync).   

Once the .dat files are publicly available, update `DATALAYER_FILE_SERVER_URL` in the [CADT configuration file](#configuration) with the URL or IP address (always include http:// or https://) and the port, then restart CADT.  CADT will begin to create mirrors at this URL for your data and all stores you are subscribed to.  

### Run CADT on a Testnet

Chia has a few test networks called "[testnets](https://docs.chia.net/testnets/)".  Testnets allow anyone to test applications using plentiful and low value TXCH instead of needing to purchace XCH.  We recommend running a testnet version of CADT in order to test integrations, software updates, and experiment in a low-stakes environment.    

CADT runs on a testnet called "testnetA" which is different than the main Chia testnet, testnet11.  TestnetA has a CADT governance node and an [observer](https://chia-cadt-demo.chiamanaged.com/).  To configure your Chia and CADT environment to use testnetA, do the following:

*Note - these instructions only work with Chia version 2.4.4 and above*

 1. Follow the [instructions here and install chia-tools](https://github.com/chia-network/chia-tools?tab=readme-ov-file#apt-repo-installation).
 
 2.  Use chia-tools to switch to testneta in the Chia config 
 
      `chia-tools network switch testneta`

 3.  Restart Chia 
 
     `sudo systemctl restart chia-wallet@<USERNAME> chia-data-layer@<USERNAME> chia-full-node@<USERNAME>`

 4.  Stop CADT

     `sudo systemctl stop cadt@<USERNAME>`

 4.  Update the `GOVERNANCE_BODY_ID` in `~/.chia/mainnet/cadt/v1/config.yaml` to be `1019153f631bb82e7fc4984dc1f0f2af9e95a7c29df743f7b4dcc2b975857409`

 5.  If you already were running CADT on mainnet, delete the CADT database

     `rm ~/.chia/mainnet/cadt/v1/data.sqlite3*`

 6.  Start CADT
     
     `sudo systemctl start cadt@<USERNAME>`

### Ports, Networking, and Security

By default, the CADT API will listen on localhost only on port 31310. If running a node with `READ_ONLY` set to `false`, it is highly recommended that CADT is run on a private network or with access limited by IP address. To allow remote connections to CADT, set the `BIND_ADDRESS` (see the [Configuration](#configuration) section below) to the IP to listen on, or `0.0.0.0` to listen on all interfaces. The port for the CADT API can be set with the parameter `CW_PORT`.  The default port is 31310. In many cases, users will need to access the API from their workstations for either the [Core Registry CADT UI](https://github.com/Chia-Network/core-registry-cadt-ui) or to integrate with existing tools and scripts. To add authentication to the API, use the `CADT_API_KEY` parameter.  Alternatively, the API can be served behind an authentication proxy to restrict access and the `CADT_API_KEY` can be left blank. If running an observer node with `READ_ONLY` set to `true`, the CADT API will only share data from the public blockchain, and running without authentication is usually safe. If `READ_ONLY` is set to `false`, authentication must be used to prevent unauthorized writes to the blockchain. 

### Adding Encryption to the CADT API

The CADT API uses HTTP and is unencrypted.  To add encryption, use a reverse proxy like [Nginx](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/) with an SSL certificate.  In this scenario, the CADT application can be set to listen only on localhost and Nginx (on the same server) would proxy incoming requests to port 31310.

### Configuration

This projects uses the unified Core Registry config file, located at `CHIA_ROOT/core-registry/config.yaml` (where `CHIA_ROOT` is configurable but set to `~/.chia/mainnet` on Linux by default).  Each application installed will have a top-level YAML element of the project name with application-specific config options below.  There is also a `GENERAL` configuration section and `CHIA` section whose config options apply to all applications.  This config file will get created at application startup if it doesn't exist.  Each application will add it's own section to this config file upon first startup.  Options for the `LOG_LEVEL` are [documented here](https://github.com/Chia-Network/core-registry-logger).  

The configuration options of Core Registry CADT closely match the options of the CADT application, [which are well documented](https://github.com/Chia-Network/cadt?tab=readme-ov-file#configuration).  Be careful to follow the YAML formatting of the generated [config file](https://github.com/Chia-Network/Core-Registry-CADT/blob/develop/src/utils/defaultConfig.js) for Core Registry CADT. 

Note that the Core Registry CADT application will need to be restarted after any changes to the config.yaml file. 

## Developer Guide

A development environment for CADT assumes a synced Chia wallet running locally.  [Node version manager (nvm)](https://github.com/nvm-sh/nvm) is used to quickly switch node environments.  The repo contains a `.nvmrc` file that specifies the node version the CADT is expected to use and developers can do `nvm use` to switch to the version in the `.nvmrc`.  

### Contributing

All branches should be created from the `develop` branch and not from `main`.  All pull requests should be made against the `develop` branch, unless it is a new release.  The `develop` branch will be merged into the `main` branch to create a release.  Automation in the CI will create the [release](https://github.com/Chia-Network/Core-Registry-CADT/releases) and attach the installation files to it automatically whenever code is merged to `main`.  Additionally, the changelog will automatically be updated in the `main` branch.  Therefore, the `main` branch should always be a representation of the latest released code.  

​This repo uses a [commit convention](https://www.conventionalcommits.org/en/v1.0.0/). A typical commit message might read:
​
```
    fix: correct home screen layout
```
​
The first part of this is the commit "type". The most common types are "feat" for new features, and "fix" for bugfixes. Using these commit types helps us correctly manage our version numbers and changelogs. Since our release process calculates new version numbers from our commits it is very important to get this right.
​

- `feat` is for introducing a new feature
- `fix` is for bug fixes
- `docs` for documentation only changes
- `style` is for code formatting only
- `refactor` is for changes to code which should not be detectable by users or testers
- `perf` is for a code change that improves performance
- `test` is for changes which only touch test files or related tooling
- `build` is for changes which only touch our develop/release tools
- `ci` is for changes to the continuous integration files and scripts
- `chore` is for changes that don't modify code, like a version bump
- `revert` is for reverting a previous commit
  ​
  After the type and scope there should be a colon.
  ​
  The "subject" of the commit follows. It should be a short indication of the change. The commit convention prefers that this is written in the present-imperative tense.

### Versioning

This project mostly adheres to semantic versioning.  The version specified in `package.json` will be used by the ci to create the new release in Github so it is important to set that correctly.  The major version (version 1.0, 2.0, etc) should only be changed when the data model changes and the API goes from v1 to v2.  Minor version changes (version 1.2 to 1.3, etc) are for breaking or substantial changes, usually requiring some action on the user's part.    
  ​

### Commit linting

​
Each time you commit the message will be checked against these standards in a pre-commit hook. Additionally all the commits in a PR branch will be linted before it can be merged to master.

To setup the pre-commit hooks on your local, run the following:
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

After running the ["Installation from Source"](https://github.com/Chia-Network/Core-Registry-CADT#installation-from-source) steps above, do the following: 

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
If you want to alter, drop or add a column or add a foriegn key or anything with the table. Use the following command to create a barebone migration script
​
npx sequelize-cli migration:generate --name <enter-type-of-change-here>
​

#### Running Full Text Search Queries

​
To run a FTS query on a supported table, you can use the `MATCH` operator. A virtual column `rank` is also available for sorting purposes.
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
