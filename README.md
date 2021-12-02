# Carbon Asset Token Retirement Explorer

A React App that displays a list of retired Carbon Tokens

## Quickstart

### Installation

```
git clone git@github.com:Chia-Network/climate-warehouse.git
cd climate-warehouse
nvm install 16.0.0
nvm use 16.0.0
npm install -g husky
npm run start
```

### Prerequisites

You'll need:

- Git
- [nvm](https://github.com/nvm-sh/nvm)

  This app uses `nvm` to align node versions across development, CI and production. If you're working on Windows you should consider [nvm-windows](https://github.com/coreybutler/nvm-windows)

## Contributing

Upon your first commit, you will automatically be added to the package.json file as a contributor.

## Commiting

This repo uses a commit convention. A typical commit message might read:

```
    fix: correct home screen layout
```

The first part of this is the commit "type". The most common types are "feat" for new features, and "fix" for bugfixes. Using these commit types helps us correctly manage our version numbers and changelogs. Since our release process calculates new version numbers from our commits it is very important to get this right.

- `feat` is for introducing a new feature
- `fix` is for bug fixes
- `docs` for documentation only changes
- `style` is for code formatting only
- `refactor` is for changes to code which should not be detectable by users or testers
- `test` is for changes which only touch test files or related tooling
- `build` is for changes which only touch our develop/release tools

After the type and scope there should be a colon.

The "subject" of the commit follows. It should be a short indication of the change. The commit convention prefers that this is written in the present-imperative tense.

### Commit linting

Each time you commit the message will be checked against these standards in a pre-commit hook. Additionally all the commits in a PR branch will be linted before it can be merged to master.

### Sequelize Generator

#### Creating Model and Migration Script

Use the following command to create a model and a migration script

npx sequelize-cli model:generate --name User --attributes firstName:string,lastName:string,email:string

#### Running Migrations

After you have generated the migration scripts you will need to sync it with the db. Use the following command

npx sequelize-cli db:migrate

#### Undoing Migration

If you messed up and you want to rollback some of your migration changes. Use the following command

npx sequelize-cli db:migrate:undo

#### Making changes to Migrations without rolling back

If you want to alter, drop or add a column or add a foriegn key or anything with the table. Use the following command to create a barebone migration script

npx sequelize-cli migration:generate --name <enter-type-of-change-here>

##### Recommendations

Models are not currently being added to our folder structure because sequelize can handle it. So for now. simply copy and paste the model into the appropriate folder
