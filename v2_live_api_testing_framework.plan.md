---
name: ""
overview: ""
todos: []
---

# Live API Testing Framework for V2

## Overview

Create a completely separate test suite (`tests/v2/live-api/`) that tests the real API running on localhost. These tests will:

- Read port from production config file (`~/.chia/mainnet/cadt/config.yaml`)
- Make HTTP requests to `http://localhost:{port}`
- Accumulate data across tests (like real usage)
- Test POST, PUT, DELETE, and GET operations
- Test with large datasets
- Clean up all created data at the end using DELETE endpoints

## Test Structure and Execution

**CRITICAL**: Tests are organized into three separate suites that can run independently or together:

### Test Suites

1. **Organization Creation** (`test:v2:live:organization:create`):
   - File: `tests/v2/live-api/organization/organization-create.spec.js`
   - Creates V2 organization → saves UID to state file
   - Creates V1 organization → saves UID to state file
   - Upgrades V1 to V2 → saves upgraded V2 UID to state file
   - State file location: `tests/v2/.organization-state.json` (root of v2 tests directory)
   - Timeout: 120 minutes (multiple 30-minute operations)

2. **Data Tests** (`test:v2:live:data`):
   - Files: `tests/v2/live-api/data/*-validation.spec.js` (methodology-validation.spec.js, etc.)
   - Tests CRUD operations on resources (methodology, project, etc.)
   - Assumes organizations already exist (from create step)
   - Timeout: 10 minutes per test file

3. **Organization Deletion** (`test:v2:live:organization:delete`):
   - File: `tests/v2/live-api/organization/organization-delete.spec.js`
   - Reads organization UIDs from state file
   - Deletes all created organizations
   - Clears state file after deletion
   - Timeout: 10 minutes

4.  **Utilities**
   - Files: `tests/v2/live-api/utilities`
   - These utilities can have individual commands in package.json, like `test:v2:delete-test-data`
   - Should not be included in any test suites

## Background

In `tests/old-live-api`, there's some old tests that we have abandoned.  This can be used for reference if needed, but we are creating a whole new test suite and we do not want to recreate what we have here.  Follow the directions of this plan, not the example in `tests/old-live-api`, however, some of the code in this directory may be useful for re-use or reference.

## What to build

We are building a test suite that makes real API calls to a running CADT API.  The test suite assumes the API is already running, it does not run the API itself.

## Architecture Decisions

Based on clarifying questions, the following architectural decisions have been made:

- **State file location**: `tests/v2/.organization-state.json` (root of v2 tests directory, not in live-api subdirectory)
- **Test data storage**: Single shared file `tests/v2/live-api/data/test-data-generators.js` containing all fake test data generators
- **Helper files structure**:
  - `tests/v2/live-api/helpers/live-api-helpers.js` - Contains functions for:
    - Reading production config and creating supertest request instance
    - Getting home organization ID
    - Checking if database is empty
    - Committing staged records
    - Waiting for organization sync
    - Validating data appears in database after sync
    - Clearing staging table
  - `tests/v2/live-api/helpers/api-request-helpers.js` - Contains functions for:
    - Making POST/PUT/DELETE requests to endpoints
    - Handling responses and extracting IDs (with special handling for project-methodology and unit-label)
    - Logging request URIs to stdout
- **Extended vs Short mode**: Separate orchestration files (`tests/v2/live-api/data-extended.js` and `tests/v2/live-api/data-short.js`) that import and call individual test files
- **Validation failure handling**: Batch clear all staging records at the end of the validation phase (step 3), not immediately after each failure
- **Endpoint list**: Extract list of data endpoints from `docs/cadt_rpc_api_v2.md` documentation

### Data tests

First, build tests that test all of the data endpoints.  These tests assume a home organization exists.

When making write requests (POST, PUT, DELETE) to any endpoint, the test should output the command that is being made to stdout.  Don't include the data, just the URI / path that is being requested

Here's the steps we want to test in the order we want to test them.

1.  Test that ensures a home organization owned by us (GET request to `v2/organizations` endpoint, with `is_home` = `true`) exists.  Fail tests and exit here if one doesn't exist.

2.  Check all endpoints that the database is empty.  If it is not empty, fail and exit tests here with a clear error message.

3.  At this stage, test write requests (PUT, POST) we expect to fail.  For example, we shouldn't be able to write a POST or PUT to any endpoint with the "created at" or "updated at" fields as those are auto-generated.  We also should be able to specify an ID like the cadTrustLabelId or cadTrustLabelId in the initial POST request as those are auto generated.  Look at each endpoint and find the things we validate and test if the endpoint works with something that doesn't match our validation.  Test that responses not in the picklist don't work (use a random string to be sure it isn't in the picklist), test that it fails if you don't include the required fields.  Test strings that are too long, test "not null" requirements.  **Validation failure handling**: If any of these validation tests fail, batch clear all staging records at the end of the validation phase (not immediately after each failure).  Clearing the staging table is documented in `docs/cadt_rpc_api_v2.md`.

4.  Test doing a POST request to add data to every data endpoint (excluding organizations).  **Endpoint list**: Extract the list of data endpoints from `docs/cadt_rpc_api_v2.md` (methodology, program, project, unit, issuance, verification, validation, rating, co-benefit, estimation, stakeholder, stakeholder-projects, project-methodology, unit-label, location, label, and all AEF endpoints).  **Test data storage**: Generate fake example data for each endpoint and store it in a single shared file `tests/v2/live-api/data/test-data-generators.js` for reuse across tests.  We should do 3 POST requests for each endpoint.  One with typical data, similar to what the example in `docs/cadt_rpc_api_v2.md` shows, one with only the minimal fields, and one with all fields with lots of data in each field. For the typical data, add 10 typical records.  **API request helper**: Create a single shared helper file `tests/v2/live-api/helpers/api-request-helpers.js` with functions for making API requests.  This file should accept the endpoint and JSON data to submit.  When we submit a POST request, the response from the API will tell us a UUID that we should save to use when we make PUT or DELETE requests in the future.  Saving these IDs will let us keep track of what we've created.  These are fields in the response JSON such as `cadTrustValidationId` and `cadTrustMethodologyId`.  The endpoints for `project-methodology` and `unit-label` don't return an ID, so these 2 will need special handling - pass a flag to the API request helper to indicate not to expect a returned ID.  Pay attention to what order we do the POST requests in as some API endpoints require the ID from other endpoints to work.

These POST requests should create a record in the staging table.  Before calling success on the POST request, do a GET request to the staging table and look for the record in the staging table with the correct data.

5.  **Staging commit helper**: Create a shared helper function in `tests/v2/live-api/helpers/live-api-helpers.js` to handle committing the staging table (`POST` request to `/v2/staging/commit`).  When we commit the stage table, don't provide IDs, just commit everything in the table.  **Extended vs Short test modes**: We need 2 test commands - `npm run test:v2:live:data:extended` and `test:v2:live:data:short`.  **Orchestration files**: Create separate orchestration files that call the individual test files:
   - `tests/v2/live-api/data-extended.js` - For extended mode: calls commit function after every endpoint POST request and waits for validation before moving to the next endpoint
   - `tests/v2/live-api/data-short.js` - For short mode: does all POST requests first, then does 1 single commit of all POST data
   These orchestrators should import and call the individual test files in the correct order.

6.  **Validation helper**: Create shared validation functions in `tests/v2/live-api/helpers/live-api-helpers.js` to handle validation.  This checks if the data has made it through the write (POST, PUT, or DELETE), then the staging commit, write to datalayer, and then finally make it through the sync and into the correct table in the database.  This sync process can take up to 10 minutes from when the staging table is committed.  Time out if it takes longer.  So after the staging table is committed, start looking for the specific data we wrote to show up in the database tables with GET requests.  Once the data syncs, the staging table should be truncated and all records in staging should be cleared.  Probably best to query the staging table after the commit happens, and if there's still records (any records) in the staging table, then wait 10 seconds and try again.  When a GET to the staging endpoint returns no records, then make GET requests to all the endpoints we updated and validate that the data we added (or changed if we're testing PUTs) is correctly returned.

7.  After the POST requests are validated as correct, do a single PUT request to each API endpoint changing one of the records we created in the POST commands.  Follow the same extended and short test format, orchestrating via the files `tests/v2/live-api/data-short.js` and `tests/v2/live-api/data-extended.js`.  For the short tests, do a single commit to staging after all PUT requests are staged.  For extended tests, do a commit after each PUT request is made and wait for validation.  Do a validation step after committing to staging, using the same validation helper functions as described in step 6 above.

8.  While we have data in the database, we need to run GET request tests against the endpoints testing all the different ways we return data.  Run tests to make sure things like pagination work (with various options on page and limit), searches work, and any other GET features you find in the `docs/cadt_rpc_api_v2.md` that we can test.

9.  Following the same process as with PUT and POST described in steps 4 to 6 for the DELETE test.  The DELETE requests should delete all data we have created in the database (organizations table and endpoint excluded) leaving empty data tables.  It should follow the same process of staging and validation using the shared helpers as already discussed.

10.  If all tests have validated, then the test were successful.  If one did not validate, please output error information and clearly indicate which test did not pass.

These tests aren't meant to work in isolation - they are meant to test the API calls a real user would do, so each test should use IDs reported by the tests from before it, the same way a real user would use the APIs.  Don't create records just to be a prerequisite for other API requests - use the records from previous tests.  Put the records in the right order so prerequisites are created by previous requests in previous endpoint tests.

