# Climate Warehouse

​
Climate Warehouse API
​

## Quickstart

​

### Installation

​

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

​

### Build Binaries

​

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

### Prerequisites

​
You'll need:
​

- Git
- [nvm](https://github.com/nvm-sh/nvm)
  ​
  This app uses `nvm` to align node versions across development, CI and production. If you're working on Windows you should consider [nvm-windows](https://github.com/coreybutler/nvm-windows)
  ​

## Commiting

​
This repo uses a commit convention. A typical commit message might read:
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

##### Running Full Text Search Queries

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

##### Connecting to the WebSocket

1. Open a WebSocket connection to http://localhost:31310/v1/ws
   1. Once subscribed, emit either emit ...['subscribe', 'units'] or ['subscribe', 'projects']. You can emit both on the same connection
2. You will receive frames that look like ...[change:units, {orgUid: '123'}], letting you know that there has been an update to a record
   Coll
