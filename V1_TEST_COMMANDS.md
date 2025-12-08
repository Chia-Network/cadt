# V1 Test Commands for Phase 15.2a Verification

## Recommended Commands with Output Capture

### Project Tests (uses transformFullXslsToChangeList)

```bash
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/integration/project.spec.js --reporter spec --exit --timeout 300000 2>&1 | tee project-test-output.log
```

### Unit Tests (uses transformFullXslsToChangeList)

```bash
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/integration/unit.spec.js --reporter spec --exit --timeout 300000 2>&1 | tee unit-test-output.log
```

### Run Both Tests Sequentially

```bash
# Run project tests
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/integration/project.spec.js --reporter spec --exit --timeout 300000 2>&1 | tee project-test-output.log

# Run unit tests
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/integration/unit.spec.js --reporter spec --exit --timeout 300000 2>&1 | tee unit-test-output.log
```

### Alternative: Separate stdout and stderr Files

If you want separate files for stdout and stderr:

```bash
# Project tests with separate files
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/integration/project.spec.js --reporter spec --exit --timeout 300000 > >(tee project-test-stdout.log) 2> >(tee project-test-stderr.log >&2)

# Unit tests with separate files
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/integration/unit.spec.js --reporter spec --exit --timeout 300000 > >(tee unit-test-stdout.log) 2> >(tee unit-test-stderr.log >&2)
```

### Combined Output File (Recommended)

Single file with both stdout and stderr combined:

```bash
# Project tests - combined output
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/integration/project.spec.js --reporter spec --exit --timeout 300000 2>&1 | tee project-test-combined.log

# Unit tests - combined output
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/integration/unit.spec.js --reporter spec --exit --timeout 300000 2>&1 | tee unit-test-combined.log
```

## Notes

- `2>&1` redirects stderr to stdout before piping to `tee`
- `tee` writes to the file AND displays output on screen
- Files will be created in the current directory
- Use `--append` flag with `tee` if you want to append instead of overwrite: `tee -a filename.log`

