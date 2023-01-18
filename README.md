# Climate Warehouse

​This project provides the Climate Warehouse API that integrates with the [Chia Blockchain](https://github.com/Chia-Network/chia-blockchain).  For a user interface, see the [Climate Warehouse UI project](https://github.com/Chia-Network/climate-warehouse-ui) which will connect to the Climate Warehouse API.

## User Guide

The Climate Warehouse application is designed to run 24/7, much like any other API.  While it is possible to run it on-demand only when API requests need to be made, this guide assumes a permanently running solution.  

The simplest way to run the Climate Warehouse application is to use the same machine the Chia Wallet, Datalayer, and Datalayer HTTP services.  Climate Warehouse communicates with the Chia services over an RPC interface.  The RPC interface uses certificates to authenticate, which will work automatically when the Climate Warehouse application is run as the same user on the same machine as the Chia services.  To run Climate Warehouse on a separate machine from Chia, a public certificate from the Chia node most be used to authenticate (not yet documented).

## Installation

[Releases are tagged in Github](https://github.com/Chia-Network/climate-warehouse/tags) and binaries are built for Windows, MacOS, and Linux.  ARM binaries are available for Debian versions of Linux only. 

### Linux

A binary file that can run on all Linux distributions on x86 hardware can be found for each tagged release with the name `linux-x64-<version>.zip`.  This zip file will extract to the `linux-64` directory by default, where the `climate-warehouse` file can be executed to run the API.  

#### Debian-based Linux Distros (Ubuntu, Mint, etc)

The Climate Warehouse API can be installed with `apt`.  Both ARM and x86 versions can be installed this way. 

1. Start by updating apt and allowing repository download over HTTPS:

```
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg
```

2.  Add Chia's official GPG Key:

```
curl -sL https://repo.chia.net/FD39E6D3.pubkey.asc | sudo gpg --dearmor -o /usr/share/keyrings/chia.gpg
```

3. Use the following command to setup the repository.

```
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/chia.gpg] https://repo.chia.net/climate-warehouse/debian/ stable main" | sudo tee /etc/apt/sources.list.d/climate-warehouse.list > /dev/null
```

4.  Install Climate Warehouse

```
sudo apt-get update
sudo apt-get install climate-warehouse
```


#### Systemd Init Script


If running Climate Warehouse full-time on a machine, Systemd is a convenient way to manage the state of the application and ensure it starts at boot.  A [template for creating a Systemd file for Climate Warehouse can be found in the open source Chia Ansible roles](https://github.com/Chia-Network/ansible-roles/blob/main/cadt/templates/cadt.service.j2).  Copy this template to `/etc/systemd/system/cadt.service` (or `climate-warehouse.service` if you prefer) and follow the comments in the file to configure it for your use-case.  Once configured, do `sudo systemctl daemon-reload` for systemd to see the new file (do the `daemon-reload` command every time a change is made to the `.service` file).  Doing `sudo systemctl start cadt` will start Climate Warehouse and `sudo systemctl enable cadt` will set it to start at boot.  To view the logs, do `sudo journalctl -u cadt` (add the `-f` flag to monitor the log real-time).


### Installation from Source


#### Prerequisites

​
You'll need:
​

- Git
- [nvm](https://github.com/nvm-sh/nvm) - This app uses `nvm` to align node versions across development, CI and production. If you're working on Windows you should consider [nvm-windows](https://github.com/coreybutler/nvm-windows)

To install from source:

```
git clone git@github.com:Chia-Network/climate-warehouse.git
cd climate-warehouse
nvm install 16.0.0
nvm use 16.0.0
npm install -g @babel/cli husky prettier lint-staged cross-env
npm set-script prepare "husky install"
npm run prepare
​
// If you are on linux or mac run
chmod ug+x .husky/*
chmod ug+x .git/hooks/*
​
npm run start
```

### Build Binaries


```
// transcompile project to es5
npm run build
​
// Output binaries to dist folder
npm run create-win-x64-dist
npm run create-mac-x64-dist
npm run create-linux-x64-dist
```
​
## Developer Guide
​
### Commiting

​This repo uses a commit convention. A typical commit message might read:
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
- `test` is for changes which only touch test files or related tooling
- `build` is for changes which only touch our develop/release tools
  ​
  After the type and scope there should be a colon.
  ​
  The "subject" of the commit follows. It should be a short indication of the change. The commit convention prefers that this is written in the present-imperative tense.
  ​

### Commit linting

​
Each time you commit the message will be checked against these standards in a pre-commit hook. Additionally all the commits in a PR branch will be linted before it can be merged to master.
​

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
