# CADT RPC API Guide

This page lists commands and examples from the Climate Warehouse RPC API.

When using this guide, it is important to understand the workflow CADT employs for managing climate data updates via
RPCs.
The CADT paradigm ensures that all updates first go into local "staging", which is private and not shared with
the rest of the world. This staging process serves as an intermediate step where climate data records changes remain
isolated from the data committed to the blockchain datalayer until explicitly committed.

When editing or adding climate data records users should first use POST changes to the appropriate `projects` or `units`
resources. These POST requests populate the local staging table, allowing for updates to be collected and reviewed
in a controlled, private environment. Once reviewed users can then use `staging` RPCs to commit or deleted the staged
record
changes. Commiting the data in staging using the CADT RPC's commits the data to the blockchain, making it publicly
visible.

It is essential to remember that the staging process is distinct from the commit phase. The initial use of `projects`,
`units`, or similar RPCs prepares the data, while `staging` RPCs finalize the transition to the blockchain. This
workflow
ensures a clear separation between temporary updates and permanent, public changes, maintaining both data integrity and
transparency.

Please also see the following related documents:

- [CADT installation/configuration guide](/README.md)
- [Chia Data Layer CLI](https://docs.chia.net/datalayer-cli) reference
- [Chia Data Layer RPC API](https://docs.chia.net/datalayer-rpc) reference

The CADT RPC API is exposed by default on port 31310. This document will give examples to access the RPC API using
`http://localhost:31310/v1`.

If using a `CADT_API_KEY` append `--header 'x-api-key: <your-api-key-here>'` to your `curl` request.

## Commands

- [`organizations`](#organizations)
    - [GET Examples](#get-examples)
        - [List all subscribed organizations](#list-all-subscribed-organizations)
    - [POST Examples](#post-examples)
        - [Create an organization](#create-an-organization)
    - [PUT Examples](#put-examples)
        - [Import a home organization](#import-an-organization-and-subscribe-to-its-stores-on-datalayer)
    - [DELETE Examples](#delete-examples)
        - [Delete a home organization](#reset-home-organization)
    - [Additional organizations resources](#additional-organizations-resources)
- [`projects`](#projects)
    - [GET Examples](#get-examples-1)
        - [Show all subscribed projects](#show-projects-currently-in-the-cadt-database)
        - [Get a single project record by warehouseprojectid](#get-a-single-project-record-by-warehouseprojectid)
        - [List projects by orguid](#list-projects-by-orguid)
        - [Search for projects containing the keyword "forestry"](#search-for-projects-containing-the-keyword-forestry)
        - [Show only projects with one or more associated units containing a marketplace identifier](#show-only-projects-with-one-or-more-associated-units-containing-a-marketplace-identifier)
        - [List all projects and save the results to an xlsx file](#list-all-projects-and-save-the-results-to-an-xlsx-file)
        - [Show only the requested columns](#show-only-the-requested-columns)
    - [POST Examples](#post-examples-1)
        - [Stage a new project with the minimum required fields](#stage-a-new-project-with-the-minimum-required-fields)
        - [Stage a new project from a csv file](#stage-a-new-project-from-a-csv-file)
    - [PUT Examples](#put-examples-1)
        - [Update a pre-existing project using only the required parameters](#update-a-pre-existing-project-using-only-the-required-parameters)
        - [Update a project record with pre-existing issuance and labels](#create-a-new-project-record-with-pre-existing-issuance-and-labels)
        - [Update a pre-existing project from an xlsx file](#update-a-pre-existing-project-from-an-xlsx-file)
    - [DELETE Examples](#delete-examples)
        - [Delete a project](#delete-a-project)
    - [Additional projects resources](#additional-projects-resources)
- [`units`](#units)
    - [GET Examples](#get-examples-2)
        - [List all units from subscribed organizations](#list-all-units-from-subscribed-organizations)
        - [Search for units containing the keyword "certification"](#search-for-units-containing-the-keyword-renewable)
        - [Include project information in returned units](#include-project-information-in-returned-units)
        - [List units by OrgUid](#list-units-by-orguid)
        - [List all units and save the results to an xlsx file](#list-all-units-and-save-the-results-to-an-xlsx-file)
        - [List units using all available query string options](#list-units-using-all-available-query-string-options)
        - [Specify unit columns to include and list all unit records](#specify-unit-columns-to-include-and-list-all-unit-records)
    - [POST Examples](#post-examples-2)
        - [Create a new unit using only the required fields](#create-a-new-unit-using-only-the-required-fields)
        - [Create a new unit record with pre-existing issuance and labels](#create-a-new-unit-record-with-pre-existing-issuance-and-labels)
        - [Split units in four](#split-units-in-four)
    - [PUT Examples](#put-examples-2)
        - [Update a pre-existing unit using only the required parameters](#update-a-pre-existing-unit-using-only-the-required-parameters)
        - [Update a pre-existing unit using an xlsx file](#update-a-pre-existing-unit-using-an-xlsx-file)
    - [DELETE Examples](#delete-examples-1)
        - [Delete a unit](#delete-a-unit)
    - [Additional Units Resources](#additional-units-resources)
- [`staging`](#staging)
    - [GET Examples](#get-examples-5)
        - [List all projects and units in STAGING](#list-all-projects-and-units-in-staging)
        - [List all units in STAGING, with paging](#list-all-units-in-staging-with-paging)
    - [POST Examples](#post-examples-3)
        - [Commit all projects and units in STAGING](#commit-all-projects-and-units-in-staging)
        - [Retry committing a single project, using its uuid](#retry-committing-a-single-project-using-its-uuid)
    - [DELETE Examples](#delete-examples-2)
        - [Delete all projects and units in STAGING](#delete-all-projects-and-units-in-staging)
        - [Delete a specific project in STAGING](#delete-a-specific-project-in-staging)
        - [Delete a specific unit in STAGING](#delete-a-specific-unit-in-staging)
    - [Additional staging resources](#additional-staging-resources)
- [`issuances`](#issuances)
    - [GET Examples](#get-examples-3)
        - [List all issuances from subscribed projects](#list-all-issuances-from-subscribed-projects)
- [`labels`](#labels)
    - [GET Examples](#get-examples-4)
        - [List all labels from subscribed projects](#list-all-labels-from-subscribed-projects)
- [`audit`](#audit)
    - [GET Examples](#get-examples-6)
        - [Show the complete history of an organization](#show-the-complete-history-of-an-organization)\
- [`offer`](#offer)
    - [Get Examples](#get-examples-7)
        - [Generate and download a datalayer offer file](#generate-and-download-a-datalayer-offer-file)
        - [Get the details of the currently uploaded offer file](#get-the-details-of-the-currently-uploaded-offer-file)
    - [Post Examples](#post-examples-4)
        - [Upload an offer file](#upload-an-offer-file)
    - [Delete Examples](#delete-examples-4)
        - [Cancel the currently active offer](#cancel-the-currently-active-offer)
        - [Reject the currently imported transfer offer file](#reject-the-currently-imported-transfer-offer-file)
    - [Additonal offer resources](#additional-offer-resources)
- [`governance`](#governance)
    - [Get Examples](#get-examples-8)
        - [Get picklist data](#get-picklist-data)
        - [Get the UID's of all organizations registered in governance data](#get-the-uids-of-all-organizations-registered-in-governance-data)
    - [Post Examples](#post-examples-6)
        - [Set the governance organization list](#set-the-governance-organization-list)
    - [Additional Governance Resources](#additional-governance-resources)
- [`filestore`](#filestore)
    - [Resources](#resources)

---

## Reference

## `organizations`

Functionality: Use GET, POST, and PUT to list, create, and update organizations

GET Options: None

### GET Examples

#### List all subscribed organizations

Request

```sh
curl --location --request GET 'localhost:31310/v1/organizations' --header 'Content-Type: application/json'
```

Response

```json
{
  "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9": {
    "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
    "orgHash": "0x14d8ea0f809c73c649827837cada5ec4d931153839383008a28c59fd1de86d2e",
    "name": "Org Test",
    "icon": "https://www.chia.net/wp-content/uploads/2023/01/chia-logo-dark.svg",
    "isHome": true,
    "subscribed": true,
    "synced": true,
    "fileStoreSubscribed": "0",
    "registryId": "xfy7oofvb31bg07stafbqxcug7mmmjzxg0gi8r1nwkv63u3pxwy85s5xpgs204bk",
    "registryHash": "0x34c4671f721ff0132b4eb80a8e0d46ffb446ec8f03ed87368adcd29415cdbac4",
    "sync_remaining": 0
  },
  "37651db8203d4c6c71f1ff357804eg6ag99eaa0k15f426aac5c896ga39bddji2": {
    "orgUid": "37651db8203d4c6c71f1ff357804eg6ag99eaa0k15f426aac5c896ga39bddji2",
    "orgHash": "0xb238e414a8df2ff5f1d1a67ca3db35c40bcb021624d5f34f9b539c0fa800272f",
    "name": "Number 2 Org Test",
    "icon": "https://www.chia.net/wp-content/uploads/2023/01/chia-logo-light.svg",
    "isHome": true,
    "subscribed": true,
    "synced": false,
    "fileStoreSubscribed": "0",
    "registryId": "aigcyhuhhe4wxp2owt6j7cezr5dqpluh7g1ybtopkn2cvxz1vjjwnw146xhzuq3i",
    "registryHash": "0x38vhoibwjnchsw0re23dsxnb7cr64dg7v717sfqkfcrs94e8z03munmnzk8jpes9",
    "sync_remaining": 0
  }
}

```

---

POST Options:

| Key  |  Type  |                         Description                         |
|:----:|:------:|:-----------------------------------------------------------:|
| name | String |      (Required) Name of the organization to be created      |
| icon | String | (Required) URL of the icon to be used for this organization |

### POST Examples

#### Create an organization

- Please note that creating and organization takes approximately 30 minutes.
- The request will not resolve until the organization creation is complete
- The request can be closed before it resolves and the status of the organization creation can be tracked via a GET
  request to `organizations` and searching for the PENDING orgUid.

Request

```sh
curl --location -g --request POST 'localhost:31310/v1/organizations/create' \
     --header 'Content-Type: application/json' \
     --data-raw '{
        "name": "Sample Org",
        "icon": "https://www.chia.net/wp-content/uploads/2023/01/chia-logo-dark.svg"
}'
```

Response

```json
{
  "message": "New organization created successfully.",
  "orgUid": "d84ab5fa679726e988b31ecc8ecff0ba8d001e9d65f1529d794fa39d32a5455e",
  "success": true
}
```

---

PUT Options:

|  Key   |  Type   |                                    Description                                     |
|:------:|:-------:|:----------------------------------------------------------------------------------:|
| orgUid | String  |                (Required) OrgUid of the home organization to import                |
| isHome | Boolean | (Optional) Specify true if the specified orgUid should be imported as the home org |

### PUT Examples

#### Import an organization and subscribe to its stores on datalayer

- This is typically used when an organization currently using CADT is installing a new instance and wants to use the
  same
  home organization and the current instance(s).

Request

```sh
curl --location -g --request PUT 'http://localhost:31310/v1/organizations/' \
--header 'Content-Type: application/json' \
--data-raw '{
  "orgUid": "foobar"
}'
```

Response

```json
{
  "success": true,
  "message": "Successfully imported organization. CADT will begin syncing data from datalayer shortly"
}
```

DELETE Options: None

### DELETE Examples

#### Delete organization

Request

```sh
curl --location --request DELETE \
'http://localhost:31310/v1/organizations/c9661d1ce77194c9e82311418aa4d370e25e10961d74d586636354746bc9ad65'
```

Response

```json
{
  "message": "Your home organization was reset, please create a new one.",
  "success": true
}
```

### Additional Organizations Resources

- POST `/organizations/remove-mirror` - given a store ID and coin ID removes the mirror for a given store
- POST `/organizations/sync` - runs the process to sync all subscribed organization metadata with datalayer
- POST `/organizations/create` - create an organization without an icon
- POST `/organizations/edit` - update an organization name and/or icon
- PUT `/organizations/resync` - resync an organization from datalayer
- POST `/organizations/mirror` - add a mirror for a datalayer store via the store ID
- GET `/organizations/metadata` - get an organizations metadata using the OrgUid
- GET `/organizations/status` - the sync status of an organization via the OrgUid

---

## `projects`

Functionality: List subscribed projects, as specified by the appropriate URL option(s)

Query string options:

|        Key         |  Type   | Description                                                                                                                     |
|:------------------:|:-------:|:--------------------------------------------------------------------------------------------------------------------------------|
|   None (default)   |   N/A   | Display all subscribed projects                                                                                                 |
| warehouseProjectId | String  | Only display subscribed projects matching this warehouseProjectId                                                               |
|       orgUid       | String  | Only display subscribed projects matching this orgUid                                                                           |
|       search       | String  | Display all subscribed projects that contain the specified query (case insensitive)                                             |
|      columns       | String  | Limit the result to the specified column. Can be used multiple times to show multiple columns                                   |
|       limit        | Number  | (Conditionally Required) Limit the number of subscribed projects to be displayed (must be used with page, eg `?page=5&limit=2`) |
|        page        | Number  | (Conditionally Required) Only display results from this page number (must be used with limit, eg `?page=5&limit=2`)             |
|        xls         | Boolean | If `true`, save the results to xls (Excel spreadsheet) format                                                                   |

### GET Examples

#### Show projects currently in the CADT database

- This request is the most basic call to /projects and displays result from all organizations. Pagination is required.

```sh
curl --location --request GET 'http://localhost:31310/v1/projects?page=5&limit=10' \
--header 'Content-Type: application/json'
```

Response

```json
{
  "page": 5,
  "pageCount": 18,
  "data": [
    {
      "warehouseProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
      "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
      "currentRegistry": "Climate Action Reserve (CAR)",
      "projectId": "789",
      "originProjectId": "123",
      "registryOfOrigin": "Sweden National Registry",
      "program": null,
      "projectName": "Stop Desertification",
      "projectLink": "desertificationtest.com",
      "projectDeveloper": "Dev 2",
      "sector": "Fugitive emissions – from fuels (solid, oil and gas)",
      "projectType": "Coal Mine Methane",
      "projectTags": null,
      "coveredByNDC": "Outside NDC",
      "ndcInformation": null,
      "projectStatus": "Registered",
      "projectStatusDate": "2022-02-02T00:00:00.000Z",
      "unitMetric": "tCO2e",
      "methodology": "Substitution of CO2 from fossil or mineral origin by CO2 from biogenic residual sources in the production of inorganic compounds --- Version 3.0",
      "validationBody": null,
      "validationDate": null,
      "timeStaged": 1646975765,
      "createdAt": "2022-03-11T05:17:55.427Z",
      "updatedAt": "2022-03-11T05:17:55.427Z",
      "projectLocations": [
        {
          "id": "8182100d-7794-4df7-b3b3-758391d13011",
          "warehouseProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
          "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
          "country": "Latvia",
          "inCountryRegion": null,
          "geographicIdentifier": "Sample Identifier",
          "timeStaged": null,
          "createdAt": "2022-03-11T05:17:55.425Z",
          "updatedAt": "2022-03-11T05:17:55.425Z"
        }
      ],
      "labels": [
        {
          "id": "dcacd68e-1cfb-4f06-9798-efa0aacda42c",
          "warehouseProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
          "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
          "label": "Sample Label",
          "labelType": "Certification",
          "creditingPeriodStartDate": "2014-03-29T00:00:00.000Z",
          "creditingPeriodEndDate": "2022-03-30T00:00:00.000Z",
          "validityPeriodStartDate": "2017-03-08T00:00:00.000Z",
          "validityPeriodEndDate": "2025-03-19T00:00:00.000Z",
          "unitQuantity": 40,
          "labelLink": "http://samplelabel.net",
          "timeStaged": null,
          "createdAt": "2022-03-11T05:17:55.426Z",
          "updatedAt": "2022-03-11T05:17:55.426Z"
        }
      ],
      "issuances": [
        {
          "id": "d9f58b08-af25-461c-88eb-403bb02b135e",
          "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
          "warehouseProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
          "startDate": "2022-01-02T00:00:00.000Z",
          "endDate": "2022-02-11T00:00:00.000Z",
          "verificationApproach": "Sample Approach",
          "verificationReportDate": "2022-03-16T00:00:00.000Z",
          "verificationBody": "Sample Body",
          "timeStaged": null,
          "createdAt": "2022-03-11T05:17:55.426Z",
          "updatedAt": "2022-03-11T05:17:55.426Z"
        }
      ],
      "coBenefits": [
        {
          "id": "73cfbe9c-8cea-4aca-94d8-f1641e686787",
          "warehouseProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
          "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
          "cobenefit": "Sample Benefit",
          "timeStaged": null,
          "createdAt": "2022-03-11T05:17:55.424Z",
          "updatedAt": "2022-03-11T05:17:55.424Z"
        }
      ],
      "relatedProjects": [
        {
          "id": "e880047e-cdf4-45bb-a9df-e706fa427713",
          "warehouseProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
          "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
          "relatedProjectId": "333",
          "relationshipType": "Sample",
          "registry": null,
          "timeStaged": null,
          "createdAt": "2022-03-11T05:17:55.426Z",
          "updatedAt": "2022-03-11T05:17:55.426Z"
        }
      ],
      "projectRatings": [
        {
          "id": "d31c3c75-b944-498d-9557-315f9005f478",
          "warehouseProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
          "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
          "ratingType": "CCQI",
          "ratingRangeHighest": "100",
          "ratingRangeLowest": "0",
          "rating": "97",
          "ratingLink": "testlink.com",
          "timeStaged": null,
          "createdAt": "2022-03-11T05:17:55.427Z",
          "updatedAt": "2022-03-11T05:17:55.427Z"
        }
      ],
      "estimations": [
        {
          "id": "c73fb4e7-3bd0-4449-8a57-6137b7c95a1f",
          "warehouseProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
          "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
          "creditingPeriodStart": "2022-02-04T00:00:00.000Z",
          "creditingPeriodEnd": "2022-03-04T00:00:00.000Z",
          "unitCount": 100,
          "timeStaged": null,
          "createdAt": "2022-03-11T05:17:55.427Z",
          "updatedAt": "2022-03-11T05:17:55.427Z"
        }
      ]
    },
    {
      "warehouseProjectId": "51ca9638-22b0-4e14-ae7a-c09d23b37b58",
      "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
      "currentRegistry": "Gold Standard",
      "projectId": "555",
      "originProjectId": "555",
      "registryOfOrigin": "Gold Standard",
      "program": null,
      "projectName": "Stop Deforestation",
      "projectLink": "http://testurl.com",
      "projectDeveloper": "Example Developer",
      "sector": "Agriculture Forestry and Other Land Use (AFOLU)",
      "projectType": "Soil Enrichment",
      "projectTags": null,
      "coveredByNDC": "Unknown",
      "ndcInformation": null,
      "projectStatus": "Listed",
      "projectStatusDate": "2022-03-02T00:00:00.000Z",
      "unitMetric": "tCO2e",
      "methodology": "Decomposition of fluoroform (HFC-23) waste streams --- Version 6.0.0",
      "validationBody": null,
      "validationDate": null,
      "timeStaged": 1646803417,
      "createdAt": "2022-03-11T05:17:55.422Z",
      "updatedAt": "2022-03-11T05:17:55.422Z",
      "projectLocations": [],
      "labels": [],
      "issuances": [],
      "coBenefits": [],
      "relatedProjects": [],
      "projectRatings": [],
      "estimations": []
    }
  ]
}

```

---

#### Get a single project record by `warehouseProjectId`

- Pagination is not required when providing a warehouseProjectId

Request

```sh
curl --location --request GET 'localhost:31310/v1/projects?warehouseProjectId=51ca9638-22b0-4e14-ae7a-c09d23b37b58' --header 'Content-Type: application/json'
```

Response

```json
{
  "warehouseProjectId": "51ca9638-22b0-4e14-ae7a-c09d23b37b58",
  "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
  "currentRegistry": "Gold Standard",
  "projectId": "555",
  ...
  abbreviated
  project
  record
  (see
  first
  example)
  ...
}
```

---

#### List projects by `orgUid`

- Pagination is required when querying for projects by OrgUid

Request

```sh
curl --location --request GET 'localhost:31310/v1/projects?orgUid=77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9&page=5&limit=12' --header 'Content-Type: application/json'
```

Response

```json
{
  "page": 5,
  "pageCount": 18,
  "data": [
    {
      "warehouseProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
      "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
      "currentRegistry": "Climate Action Reserve (CAR)",
      "projectId": "789",
      ...
      abbreviated
      project
      record
      (see
      first
      example)
      ...
    },
    {
      "warehouseProjectId": "51ca9638-22b0-4e14-ae7a-c09d23b37b58",
      "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
      "currentRegistry": "Gold Standard",
      "projectId": "555",
      ...
      abbreviated
      project
      record
      (see
      first
      example)
      ...
    }
  ]
}



```

---

#### Search for projects containing the keyword "forestry"

- Pagination is required when querying with a text search string

Request

```shell
curl --location --request GET 'localhost:31310/v1/projects?search=forestry&page=5&limit=10' --header 'Content-Type: application/json'
```

Response

```json

{
  "page": 5,
  "pageCount": 18,
  "data": [
    {
      "warehouseProjectId": "51ca9638-22b0-4e14-ae7a-c09d23b37b58",
      "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
      "currentRegistry": "Gold Standard",
      "projectId": "555",
      "originProjectId": "555",
      "registryOfOrigin": "Gold Standard",
      "program": null,
      "projectName": "Stop Deforestation",
      "projectLink": "http://testurl.com",
      "projectDeveloper": "Example Developer",
      "sector": "Agriculture Forestry and Other Land Use (AFOLU)",
      ...
      abbreviated
      project
      record
      (see
      first
      example)
      ...
    },
    {
      "warehouseProjectId": "c400b659-d36e-44f7-a575-b6f1a2ed9662",
      "orgUid": "37651db8203d4c6c71f1ff357804eg6ag99eaa0k15f426aac5c896ga39bddji2",
      "currentRegistry": "Verra",
      "projectId": "123",
      "originProjectId": "321",
      "registryOfOrigin": "CDM",
      "program": null,
      "projectName": "Test Project 123",
      "projectLink": "http://test102url.com",
      "projectDeveloper": "Example Developer",
      "sector": "Agriculture Forestry and Other Land Use (AFOLU)",
      ...
      abbreviated
      project
      record
      (see
      first
      example)
      ...
    }
  ]
}
```

---

#### List all projects and save the results to an xlsx file

- All other projects query params can be used in combination with the `xls` query param

Request

```sh
curl --location --request GET 'localhost:31310/v1/projects?xls=true' --header 'Content-Type: application/json' > projects.xlsx
```

Response:

Download stream to download the XLS file of project records.
Using the above `curl` will save the results to a file in the current directory called `projects.xlsx`.


---

#### Show only projects with one or more associated units containing a marketplace identifier

- Pagination is required when searching for project records by presence of unit marketplace identifiers

Request

```sh
curl --location --request GET 'http://localhost:31310/v1/projects?page=1&limit=5&onlyMarketplaceProjects=true' --header 'Content-Type: application/json'
```

Response

```json
{
  "page": 5,
  "pageCount": 18,
  "data": [
    {
      "warehouseProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
      "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
      "currentRegistry": "Climate Action Reserve (CAR)",
      "projectId": "789",
      "marketplaceIdentifier": "0x35063k71qbg5a8de324e52d6e4c35dd69c48b757477800d48c983ed17aea1b98",
      ...
      abbreviated
      project
      record
      (see
      first
      example)
      ...
    },
    {
      "warehouseProjectId": "51ca9638-22b0-4e14-ae7a-c09d23b37b58",
      "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
      "currentRegistry": "Gold Standard",
      "projectId": "555",
      "marketplaceIdentifier": "0x1930eagkbc83dhh589433475c2faff5f914fa65f5a27c0fee5327a58s24696e9",
      ...
      abbreviated
      project
      record
      (see
      first
      example)
      ...
    }
  ]
}

```

---

#### Show only the requested columns

Request

```shell
curl --location --request GET 'http://localhost:31310/v1/projects?page=1&limit=5&columns=warehouseProjectId&columns=currentRegistry&columns=registryOfOrigin&columns=originProjectId&columns=program&columns=projectName' --header 'Content-Type: application/json'
```

Response

```json
{
  "page": 1,
  "pageCount": 1,
  "data": [
    {
      "warehouseProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
      "currentRegistry": "Climate Action Reserve (CAR)",
      "registryOfOrigin": "Sweden National Registry",
      "originProjectId": "123",
      "program": null,
      "projectName": "Stop Desertification"
    },
    {
      "warehouseProjectId": "51ca9638-22b0-4e14-ae7a-c09d23b37b58",
      "currentRegistry": "Gold Standard",
      "registryOfOrigin": "Gold Standard",
      "originProjectId": "555",
      "program": null,
      "projectName": "Stop Deforestation"
    }
  ]
}
```

---

### POST Examples

#### Stage a new project with the minimum required fields

Request

```sh
curl --location --request POST \
     -F 'projectId=c9d147e2-bc07-4e68-a76d-43424fa8cd4e' \
     -F 'originProjectId=12345-123-123-12345' \
     -F 'registryOfOrigin=UNFCCC' \
     -F 'projectName=POST sample' \
     -F 'projectLink=http://testurl.com' \
     -F 'projectDeveloper=POST developer' \
     -F 'sector=Manufacturing industries' \
     -F 'projectType=Conservation' \
     -F 'coveredByNDC=Inside NDC' \
     -F 'projectStatus=Registered' \
     -F 'projectStatusDate=2022-03-12' \
     -F 'ndcInformation=Shuffletag' \
     -F 'unitMetric=tCO2e' \
     -F 'methodology=Integrated Solar Combined Cycle (ISCC) projects --- Version 1.0.0' \
     'http://localhost:31310/v1/projects'
```

Response

```json
{
  "message": "Project staged successfully",
  "uuid": "9a29f826-ea60-489f-a290-c734e8fd57f1",
  "success": true
}
```

---

#### Stage a new project from a csv file

- For this example, we'll use a file named `createProject.csv` with the required fields of a project record in CSV.

`createProject.csv`

```
warehouseProjectId,orgUid,currentRegistry,projectId,originProjectId,registryOfOrigin,program,projectName,projectLink,projectDeveloper,sector,projectType,projectTags,coveredByNDC,ndcInformation,projectStatus,projectStatusDate,unitMetric,methodology,validationBody,validationDate
f925cb3f-f59a-4ba4-8844-e2a63eb38221,f048f0c4e2ef2d852354a71a0839687301376eeef4358f6204795723ef906bcf,,c9d147e2-bc07-4e68-a76d-43424fa8cd4e,12345-123-123-12345,UNFCCC,,POST sample,http://testurl.com,POST developer,Manufacturing industries,Conservation,,Inside NDC,Shuffletag,Registered,2022-03-12T00:00:00.000Z,tCO2e,Integrated Solar Combined Cycle (ISCC) projects --- Version 1.0.0,,

```

```shell
curl --location --request POST 'http://localhost:31310/v1/projects/batch' --form 'csv=@"./createProject.csv"'
```

Response

```json
{
  "message": "CSV processing complete, your records have been added to the staging table.",
  "success": true
}
```

---

### PUT Examples

#### Update a pre-existing project using only the required parameters

Request

```sh
curl --location -g --request PUT 'http://localhost:31310/v1/projects' \
--header 'Content-Type: application/json' \
--data-raw '{
    "warehouseProjectId": "51ca9638-22b0-4e14-ae7a-c09d23b37b58",
    "projectId": "987",
    "originProjectId": "555",
    "registryOfOrigin": "Verra",
    "projectName": "Stop Deforestation",
    "projectLink": "http://testurl.com",
    "projectDeveloper": "Example Developer",
    "sector": "Mining/Mineral production",
    "projectType": "Afforestation",
    "coveredByNDC": "Inside NDC",
    "ndcInformation": "Shuffletag",
    "projectStatus": "Listed",
    "projectStatusDate": "2022-03-19",
    "unitMetric": "tCO2e",
    "methodology": "Baseline methodology for water pumping efficiency improvements --- Version 2.0"
}'
```

Response

```json
{
  "message": "Project update added to staging",
  "success": true
}
```

---

#### Create a new project record with pre-existing issuance and labels

- Please note that when creating a new record using existing records, the request must include:
    - The data for new child record _**without**_ a `id` and `warehouseProjectId`
        - See the first label in the below example
    - The complete data for the existing child record _**including**_ its `id` and `warehouseProjectId`
        - See the issuance and second label in the below example
- The result of this query will be a staged new project record using an existing issuance and label, in addition to the
  creation of a new label record

Request

```shell
curl --location -g --request PUT 'localhost:31310/v1/projects' \
--header 'Content-Type: application/json' \
--data-raw '{
    "warehouseProjectId": "51ca9638-22b0-4e14-ae7a-c09d23b37b58",
    "projectId": "987",
    "originProjectId": "555",
    "registryOfOrigin": "Verra",
    "projectName": "Stop Deforestation",
    "projectLink": "http://testurl.com",
    "projectDeveloper": "Example Developer",
    "sector": "Mining/Mineral production",
    "projectType": "Afforestation",
    "coveredByNDC": "Inside NDC",
    "ndcInformation": "Shuffletag",
    "projectStatus": "Listed",
    "projectStatusDate": "2022-03-19",
    "unitMetric": "tCO2e",
    "methodology": "Baseline methodology for water pumping efficiency improvements --- Version 2.0"
    "issuance": {
        "id":"d9f58b08-af25-461c-88eb-403bb02b135e",
        "warehouseProjectId":"9b9bb857-c71b-4649-b805-a289db27dc1c",
        "startDate":"2022-01-02T00:00:00.000Z",
        "endDate":"2022-02-11T00:00:00.000Z",
        "verificationApproach":"Sample Approach",
        "verificationReportDate":"2022-03-16T00:00:00.000Z",
        "verificationBody":"Sample Body"
    },
    "labels": [
        {
            "label":"Sample Label",
            "labelType":"Certification",
            "creditingPeriodStartDate":"2014-03-29T00:00:00.000Z",
            "creditingPeriodEndDate":"2022-03-30T00:00:00.000Z",
            "validityPeriodStartDate":"2017-03-08T00:00:00.000Z",
            "validityPeriodEndDate":"2025-03-19T00:00:00.000Z",
            "unitQuantity":40,
            "labelLink":"http://samplelabel.net"
        },
        {
            "id": "dcacd68e-1cfb-4f06-9798-efa0aacda42c",
            "warehouseProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
            "label": "mclaren1",
            "labelType": "Certification",
            "creditingPeriodStartDate": "2022-02-03",
            "creditingPeriodEndDate": "2022-03-04",
            "validityPeriodStartDate": "2022-02-03",
            "validityPeriodEndDate": "2022-03-04",
            "unitQuantity": "10",
            "labelLink": "https://www.chia.net/"
        }
    ]
}'
```

Response

```json
{
  "message": "Project staged successfully",
  "success": true
}
```

---

#### Update a pre-existing project record from a xlsx file

- For this example, we'll use a file named `cw_query.xlsx`, created
  from [this example](#list-all-projects-and-save-the-results-to-an-xlsx-file) and modified with updates

Request

```shell
curl --location -g --request PUT 'http://localhost:31310/v1/projects/xlsx' --form 'xlsx=@"./cw_query.xlsx"'
```

Response

```json
{
  "message": "Updates from xlsx added to staging",
  "success": true
}
```

---

### DELETE Examples

#### Delete a project record

Request

```shell
curl --location -g --request DELETE 'http://localhost:31310/v1/projects' \
--header 'Content-Type: application/json' \
--data-raw '{
    "warehouseProjectId": "693d37f6-318e-4d8b-9e14-3d2328b569be"
  }'
```

Response

```json
{
  "message": "Project deletion staged successfully",
  "success": true
}
```

### Additional Projects Resources

- PUT `projects/transfer` - stage the transfer of a project from another CADT organization to the instance home
  organization

---

## `units`

Functionality: List subscribed units, as specified by the appropriate URL option(s)

Query string options:

|      Key       |              Type               |                                             Description                                             |
|:--------------:|:-------------------------------:|:---------------------------------------------------------------------------------------------------:|
| None (default) |               N/A               |                                    Display all subscribed units                                     |
|     orgUid     |             String              |                         Only display subscribed units matching this orgUid                          |
|     search     |             String              |          Display all subscribed units that contain the specified query (case insensitive)           |
|    columns     |             String              |    Limit the result to the specified column. Can be used multiple times to show multiple columns    |
|     limit      | (Conditionally Required) Number | Limit the number of subscribed units to be displayed (must be used with page, eg `?page=5&limit=2`) |
|      page      | (Conditionally Required) Number |     Only display results from this page number (must be used with limit, eg `?page=5&limit=2`)      |
|      xls       |             Boolean             |                    If `true`, save the results to xls (Excel spreadsheet) format                    |

### GET Examples

#### List all units from subscribed organizations

- This request is the most basic call to /units and displays result from all organizations. Pagination is required.

Request

```shell
curl --location -g --request GET 'localhost:31310/v1/units?page=1&limit=10' --header 'Content-Type: application/json'
```

Response

```json

{
  "page": 1,
  "pageCount": 3134,
  "data": [
    {
      "unitBlockStart": "A345",
      "unitBlockEnd": "B567",
      "unitCount": 222,
      "warehouseUnitId": "89d7a102-a5a6-4f80-bc67-d28eba4952f3",
      "issuanceId": null,
      "projectLocationId": "789",
      "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
      "unitOwner": "Sample Owner",
      "countryJurisdictionOfOwner": "Belize",
      "inCountryJurisdictionOfOwner": null,
      "serialNumberBlock": "A345-B567",
      "serialNumberPattern": "[.*\\D]+([0-9]+)+[-][.*\\D]+([0-9]+)$",
      "vintageYear": 2014,
      "unitType": "Reduction - technical",
      "marketplace": null,
      "marketplaceLink": null,
      "marketplaceIdentifier": null,
      "unitTags": null,
      "unitStatus": "Buffer",
      "unitStatusReason": null,
      "unitRegistryLink": "sampleurl.com",
      "correspondingAdjustmentDeclaration": "Unknown",
      "correspondingAdjustmentStatus": "Pending",
      "timeStaged": 1647141471,
      "createdAt": "2022-03-13T05:29:39.647Z",
      "updatedAt": "2022-03-13T05:29:39.647Z",
      "labels": [],
      "issuance": {
        "id": "1f743827-1208-40a7-a2f4-b5ka688776a1",
        "orgUid": "53e508f320f32f51bc53c336d4d1bab5b7a87f8aaeb73fdbd9a87f57eef74b5b",
        "warehouseProjectId": "3b5b6482-7776-4221-956e-b10a88ea65cf",
        "startDate": "2020-01-01T00:00:00.000Z",
        "endDate": "2020-12-31T00:00:00.000Z",
        "verificationApproach": "Rule-based verification approach",
        "verificationReportDate": "2021-08-18T00:00:00.000Z",
        "verificationBody": "Certification Services",
        "timeStaged": null,
        "createdAt": "2023-11-28T09:27:33.034Z",
        "updatedAt": "2024-08-20T22:19:54.170Z"
      }
    },
    {
      "unitBlockStart": "abc123",
      "unitBlockEnd": "abd124",
      "unitCount": 1,
      "warehouseUnitId": "68fcf0b2-f1b9-4bb4-b91a-e4fe6f07a2d6",
      "issuanceId": null,
      "projectLocationId": "44",
      "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
      "unitOwner": "44",
      "countryJurisdictionOfOwner": "United States of America",
      "inCountryJurisdictionOfOwner": null,
      "serialNumberBlock": "abc123-abd124",
      "serialNumberPattern": "[.*\\D]+([0-9]+)+[-][.*\\D]+([0-9]+)$",
      "vintageYear": 2022,
      "unitType": "Reduction - nature",
      "marketplace": null,
      "marketplaceLink": null,
      "marketplaceIdentifier": null,
      "unitTags": null,
      "unitStatus": "Held",
      "unitStatusReason": null,
      "unitRegistryLink": "http://registry.link",
      "correspondingAdjustmentDeclaration": "Committed",
      "correspondingAdjustmentStatus": "Not Started",
      "timeStaged": 1646806230,
      "createdAt": "2022-03-13T05:29:39.642Z",
      "updatedAt": "2022-03-13T05:29:39.642Z",
      "labels": [],
      "issuance": null
    }
  ]
}

```

---

#### Search for units containing the keyword renewable

- Pagination is required when querying for project records with a text search

Request

```shell
curl --location -g --request GET 'localhost:31310/v1/units?search=renewable&page=1&limit=1'
```

Response

```json
{
  "page": 1,
  "pageCount": 3134,
  "data": [
    {
      "unitBlockStart": "A345",
      "unitBlockEnd": "B567",
      "unitCount": 222,
      "warehouseUnitId": "89d7a102-a5a6-4f80-bc67-d28eba4952f3",
      "issuanceId": null,
      "projectLocationId": "789",
      "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
      "unitOwner": "Sample Owner",
      "countryJurisdictionOfOwner": "Belize",
      "inCountryJurisdictionOfOwner": null,
      "serialNumberBlock": "A345-B567",
      "serialNumberPattern": "[.*\\D]+([0-9]+)+[-][.*\\D]+([0-9]+)$",
      "vintageYear": 2014,
      "unitType": "Reduction - technical",
      "marketplace": null,
      "marketplaceLink": null,
      "marketplaceIdentifier": null,
      "unitTags": "Renewable energy,Energy efficiency",
      "unitStatus": "Buffer",
      "unitStatusReason": null,
      "unitRegistryLink": "sampleurl.com",
      "correspondingAdjustmentDeclaration": "Unknown",
      "correspondingAdjustmentStatus": "Pending",
      "timeStaged": 1647141471,
      "createdAt": "2022-03-13T05:29:39.647Z",
      "updatedAt": "2022-03-13T05:29:39.647Z",
      "labels": [],
      "issuance": {
        "id": "1f743827-1208-40a7-a2f4-b5ka688776a1",
        "orgUid": "53e508f320f32f51bc53c336d4d1bab5b7a87f8aaeb73fdbd9a87f57eef74b5b",
        "warehouseProjectId": "3b5b6482-7776-4221-956e-b10a88ea65cf",
        "startDate": "2020-01-01T00:00:00.000Z",
        "endDate": "2020-12-31T00:00:00.000Z",
        "verificationApproach": "Rule-based verification approach",
        "verificationReportDate": "2021-08-18T00:00:00.000Z",
        "verificationBody": "Certification Services",
        "timeStaged": null,
        "createdAt": "2023-11-28T09:27:33.034Z",
        "updatedAt": "2024-08-20T22:19:54.170Z"
      }
    },
    {
      "unitBlockStart": "abc123",
      "unitBlockEnd": "abd124",
      "unitCount": 1,
      "warehouseUnitId": "68fcf0b2-f1b9-4bb4-b91a-e4fe6f07a2d6",
      "issuanceId": null,
      "projectLocationId": "44",
      "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
      "unitOwner": "44",
      "countryJurisdictionOfOwner": "United States of America",
      "inCountryJurisdictionOfOwner": null,
      "serialNumberBlock": "abc123-abd124",
      "serialNumberPattern": "[.*\\D]+([0-9]+)+[-][.*\\D]+([0-9]+)$",
      "vintageYear": 2022,
      "unitType": "Reduction - nature",
      "marketplace": null,
      "marketplaceLink": null,
      "marketplaceIdentifier": null,
      "unitTags": "Renewable energy,Energy efficiency",
      "unitStatus": "Held",
      "unitStatusReason": null,
      "unitRegistryLink": "http://registry.link",
      "correspondingAdjustmentDeclaration": "Committed",
      "correspondingAdjustmentStatus": "Not Started",
      "timeStaged": 1646806230,
      "createdAt": "2022-03-13T05:29:39.642Z",
      "updatedAt": "2022-03-13T05:29:39.642Z",
      "labels": [],
      "issuance": null
    }
  ]
}
```

#### Include project information in returned units

- Pagination is required when searching project record content in assoc

Request

```shell
curl --location -g --request GET 'localhost:31310/v1/units?includeProjectInfoInSearch=true&search=HydroPower&page=1&limit=1'
```

Response

```json
{
  "page": 1,
  "pageCount": 3134,
  "data": [
    {
      "unitBlockStart": "A345",
      "unitBlockEnd": "B567",
      "unitCount": 222,
      "warehouseUnitId": "89d7a102-a5a6-4f80-bc67-d28eba4952f3",
      "issuanceId": null,
      "projectLocationId": "789",
      "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
      "unitOwner": "Sample Owner",
      "countryJurisdictionOfOwner": "Belize",
      "inCountryJurisdictionOfOwner": null,
      "serialNumberBlock": "A345-B567",
      "serialNumberPattern": "[.*\\D]+([0-9]+)+[-][.*\\D]+([0-9]+)$",
      "vintageYear": 2014,
      "unitType": "Reduction - technical",
      "marketplace": null,
      "marketplaceLink": null,
      "marketplaceIdentifier": null,
      "unitTags": null,
      "unitStatus": "Buffer",
      "unitStatusReason": null,
      "unitRegistryLink": "sampleurl.com",
      "correspondingAdjustmentDeclaration": "Unknown",
      "correspondingAdjustmentStatus": "Pending",
      "timeStaged": 1647141471,
      "createdAt": "2022-03-13T05:29:39.647Z",
      "updatedAt": "2022-03-13T05:29:39.647Z",
      "labels": [],
      "issuance": null,
      "project": {
        "warehouseProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
        "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
        "currentRegistry": "Climate Action Reserve (CAR)",
        "projectId": "789",
        "originProjectId": "123",
        "registryOfOrigin": "Sweden National Registry",
        "program": null,
        "projectName": "Stop Desertification",
        "projectLink": "desertificationtest.com",
        "projectDeveloper": "Dev 2",
        "sector": "Fugitive emissions – from fuels (solid, oil and gas)",
        "projectType": "Coal Mine Methane",
        "projectTags": null,
        "coveredByNDC": "Outside NDC",
        "ndcInformation": null,
        "projectStatus": "Registered",
        "projectStatusDate": "2022-02-02T00:00:00.000Z",
        "unitMetric": "tCO2e",
        "methodology": "Substitution of CO2 from fossil or mineral origin by CO2 from biogenic residual sources in the production of inorganic compounds --- Version 3.0",
        "validationBody": null,
        "validationDate": null,
        "timeStaged": 1646975765,
        "createdAt": "2022-03-11T05:17:55.427Z",
        "updatedAt": "2022-03-11T05:17:55.427Z",
        "projectLocations": [
          {
            "id": "8182100d-7794-4df7-b3b3-758391d13011",
            "warehouseProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
            "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
            "country": "Latvia",
            "inCountryRegion": null,
            "geographicIdentifier": "Sample Identifier",
            "timeStaged": null,
            "createdAt": "2022-03-11T05:17:55.425Z",
            "updatedAt": "2022-03-11T05:17:55.425Z"
          }
        ],
        "labels": [
          {
            "id": "dcacd68e-1cfb-4f06-9798-efa0aacda42c",
            "warehouseProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
            "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
            "label": "Sample Label",
            "labelType": "Certification",
            "creditingPeriodStartDate": "2014-03-29T00:00:00.000Z",
            "creditingPeriodEndDate": "2022-03-30T00:00:00.000Z",
            "validityPeriodStartDate": "2017-03-08T00:00:00.000Z",
            "validityPeriodEndDate": "2025-03-19T00:00:00.000Z",
            "unitQuantity": 40,
            "labelLink": "http://samplelabel.net",
            "timeStaged": null,
            "createdAt": "2022-03-11T05:17:55.426Z",
            "updatedAt": "2022-03-11T05:17:55.426Z"
          }
        ],
        "issuances": [
          {
            "id": "d9f58b08-af25-461c-88eb-403bb02b135e",
            "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
            "warehouseProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
            "startDate": "2022-01-02T00:00:00.000Z",
            "endDate": "2022-02-11T00:00:00.000Z",
            "verificationApproach": "Sample Approach",
            "verificationReportDate": "2022-03-16T00:00:00.000Z",
            "verificationBody": "Sample Body",
            "timeStaged": null,
            "createdAt": "2022-03-11T05:17:55.426Z",
            "updatedAt": "2022-03-11T05:17:55.426Z"
          }
        ],
        "coBenefits": [
          {
            "id": "73cfbe9c-8cea-4aca-94d8-f1641e686787",
            "warehouseProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
            "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
            "cobenefit": "Sample Benefit",
            "timeStaged": null,
            "createdAt": "2022-03-11T05:17:55.424Z",
            "updatedAt": "2022-03-11T05:17:55.424Z"
          }
        ],
        "relatedProjects": [
          {
            "id": "e880047e-cdf4-45bb-a9df-e706fa427713",
            "warehouseProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
            "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
            "relatedProjectId": "333",
            "relationshipType": "Sample",
            "registry": null,
            "timeStaged": null,
            "createdAt": "2022-03-11T05:17:55.426Z",
            "updatedAt": "2022-03-11T05:17:55.426Z"
          }
        ],
        "projectRatings": [
          {
            "id": "d31c3c75-b944-498d-9557-315f9005f478",
            "warehouseProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
            "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
            "ratingType": "CCQI",
            "ratingRangeHighest": "100",
            "ratingRangeLowest": "0",
            "rating": "97",
            "ratingLink": "testlink.com",
            "timeStaged": null,
            "createdAt": "2022-03-11T05:17:55.427Z",
            "updatedAt": "2022-03-11T05:17:55.427Z"
          }
        ],
        "estimations": [
          {
            "id": "c73fb4e7-3bd0-4449-8a57-6137b7c95a1f",
            "warehouseProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
            "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
            "creditingPeriodStart": "2022-02-04T00:00:00.000Z",
            "creditingPeriodEnd": "2022-03-04T00:00:00.000Z",
            "unitCount": 100,
            "timeStaged": null,
            "createdAt": "2022-03-11T05:17:55.427Z",
            "updatedAt": "2022-03-11T05:17:55.427Z"
          }
        ]
      }
    }
  ]
}
```

---

#### List units by `orgUid`

- Pagination is required when requesting unit records by OrgUid

Request

```shell
curl --location -g --request GET \
     'localhost:31310/v1/units?orgUid=77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9&page=1&limit=2' \
     --header 'Content-Type: application/json'
```

Response

```json
{
  "page": 1,
  "pageCount": 7,
  "data": [
    {
      "unitBlockStart": "A345",
      "unitBlockEnd": "B567",
      0
      "unitCount": 222,
      "warehouseUnitId": "89d7a102-a5a6-4f80-bc67-d28eba4952f3",
      ...
      abbreviated
      unit
      record
      (see
      first
      example)
      ...
    },
    {
      "unitBlockStart": "abc123",
      "unitBlockEnd": "abd124",
      "unitCount": 1,
      "warehouseUnitId": "68fcf0b2-f1b9-4bb4-b91a-e4fe6f07a2d6",
      ...
      abbreviated
      unit
      record
      (see
      first
      example)
      ...
    }
  ]
}

```

---

#### List all units and save the results to an xlsx file

- All other unit query params can be used in combination with the `xls` query param

Request

```sh
curl --location --request GET 'localhost:31310/v1/units?xls=true' --header 'Content-Type: application/json' > units.xlsx
```

Response:

Download stream to download the XLS file of unit records.
Using the above `curl` will save the results to a file in the current directory called `units.xlsx`.

---

#### List units using all available query string options

Response

```shell
curl --location -g --request GET 'localhost:31310/v1/units?page=1&limit=10&search=Reduction&warehouseUnitId=89d7a102-a5a6-4f80-bc67-d28eba4952f3&columns=all&orgUid=77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9&xls=false' \
--header 'Content-Type: application/json'
```

Request

```json
{
  "page": 1,
  "pageCount": 7,
  "data": [
    {
      "unitBlockStart": "A345",
      "unitBlockEnd": "B567",
      "unitCount": 222,
      "warehouseUnitId": "89d7a102-a5a6-4f80-bc67-d28eba4952f3",
      ...
      abbreviated
      unit
      record
      (see
      first
      example)
      ...
    },
    {
      "unitBlockStart": "abc123",
      "unitBlockEnd": "abd124",
      "unitCount": 1,
      "warehouseUnitId": "68fcf0b2-f1b9-4bb4-b91a-e4fe6f07a2d6",
      ...
      abbreviated
      unit
      record
      (see
      first
      example)
      ...
    }
  ]
}
```

---

#### Specify unit columns to include and list all unit records

- Pagination is required when specifying columns to return in unit records

Request

```shell
curl --location -g --request GET \
    'localhost:31310/v1/units?page=1&limit=1&columns=countryJurisdictionOfOwner&columns=inCountryJurisdictionOfOwner&columns=serialNumberBlock&columns=unitIdentifier&columns=unitType&columns=intentedBuyerOrgUid&columns=marketplace' \
    --header 'Content-Type: application/json'
```

Response

```json
{
  "page": 1,
  "pageCount": 2,
  "data": [
    {
      "countryJurisdictionOfOwner": "Belize",
      "inCountryJurisdictionOfOwner": null,
      "serialNumberBlock": "A345-B567",
      "unitType": "Reduction - technical",
      "marketplace": null
    }
  ]
}
```

---

### POST Examples

#### Create a new unit using only the required fields

```shell
curl --location -g --request POST 'localhost:31310/v1/units' \
     --header 'Content-Type: application/json' \
     --data-raw '{
       "projectLocationId": "ID_USA",
       "unitOwner": "Chia",
       "countryJurisdictionOfOwner": "Andorra",
       "vintageYear": 1998,
       "unitType": "Removal - technical",
       "unitStatus": "Held",
       "unitBlockStart": "abc123",
       "unitBlockEnd": "bcd456",
       "unitCount": 200,
       "unitRegistryLink": "http://climateWarehouse.com/myRegistry",
       "correspondingAdjustmentDeclaration": "Unknown",
       "correspondingAdjustmentStatus": "Not Started"
}'
```

```json
{
  "message": "Unit staged successfully",
  "uuid": "9a29f826-ea60-489f-a290-c734e8fd57f1",
  "success": true
}
```

---

#### Create a new unit record with pre-existing issuance and labels

- Please note that when creating a new record using existing records, the request must include:
    - The data for new child record _**without**_ a `id` and `warehouseProjectId`
        - See the first label in the below example
    - The complete data for the existing child record _**including**_ its `id` and `warehouseProjectId`
        - See the issuance and second label in the below example
- The result of this query will be a staged new unit record using an existing issuance and label, in addition to the
  creation of a new label record

Request

```shell
curl --location -g --request PUT 'localhost:31310/v1/units' \
--header 'Content-Type: application/json' \
--data-raw '{
    "projectLocationId": "USA-M",
    "unitOwner": "Chia",
    "countryJurisdictionOfOwner": "Venezuela",
    "inCountryJurisdictionOfOwner": "Venezuela",
    "serialNumberBlock": "QWERTY9800-ASDFGH9850",
    "serialNumberPattern": "[.*\\D]+([0-9]+)+[-][.*\\D]+([0-9]+)$",
    "vintageYear": 1998,
    "unitType": "Removal - nature",
    "marketplace": "MP Test",
    "marketplaceLink": "http://climateWarehouse.com/myMarketplace",
    "marketplaceIdentifier": "ADIV223",
    "unitTags": "TEST_TAG",
    "unitStatus": "For Sale",
    "unitStatusReason": "reason",
    "unitRegistryLink": "http://climateWarehouse.com/myRegistry",
    "correspondingAdjustmentDeclaration": "Unknown",
    "correspondingAdjustmentStatus": "Not Started",
    "issuance": {
        "id":"d9f58b08-af25-461c-88eb-403bb02b135e",
        "warehouseProjectId":"9b9bb857-c71b-4649-b805-a289db27dc1c",
        "startDate":"2022-01-02T00:00:00.000Z",
        "endDate":"2022-02-11T00:00:00.000Z",
        "verificationApproach":"Sample Approach",
        "verificationReportDate":"2022-03-16T00:00:00.000Z",
        "verificationBody":"Sample Body"
    },
    "labels": [
        {
            "label":"Sample Label",
            "labelType":"Certification",
            "creditingPeriodStartDate":"2014-03-29T00:00:00.000Z",
            "creditingPeriodEndDate":"2022-03-30T00:00:00.000Z",
            "validityPeriodStartDate":"2017-03-08T00:00:00.000Z",
            "validityPeriodEndDate":"2025-03-19T00:00:00.000Z",
            "unitQuantity":40,
            "labelLink":"http://samplelabel.net"
        },
        {
            "id": "dcacd68e-1cfb-4f06-9798-efa0aacda42c",
            "warehouseProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
            "label": "mclaren1",
            "labelType": "Certification",
            "creditingPeriodStartDate": "2022-02-03",
            "creditingPeriodEndDate": "2022-03-04",
            "validityPeriodStartDate": "2022-02-03",
            "validityPeriodEndDate": "2022-03-04",
            "unitQuantity": "10",
            "labelLink": "https://www.chia.net/"
        }
    ]
}'
```

Response

```json
{
  "message": "Unit staged successfully",
  "success": true
}
```

---

#### Split units in four

Response

```shell
curl --location -g --request POST 'localhost:31310/units/split' \
--header 'Content-Type: application/json' \
--data-raw '{
  "warehouseUnitId": "5c3a952b-108e-4245-9e02-8fd8e3023a13",
  "records": [
    {
      "unitCount": 10,
      "unitBlockStart": "A001",
      "unitBlockEnd": "A010",
      "unitOwner": "New Owner 1",
      "unitStatus": "active",
      "countryJurisdictionOfOwner": "Bhutan",
      "inCountryJurisdictionOfOwner": "Bhutan",
      "marketplace": null,
      "marketplaceIdentifier": null
    },
    {
      "unitCount": 5,
      "unitBlockStart": "B001",
      "unitBlockEnd": "B005",
      "unitStatus": "Held",
      "countryJurisdictionOfOwner": "Canada",
      "inCountryJurisdictionOfOwner": null,
      "marketplace": null,
      "marketplaceIdentifier": null
    },
    {
      "unitCount": 22,
      "unitBlockStart": "C001",
      "unitBlockEnd": "C022",
      "unitOwner": "New Owner 2",
      "unitStatus": "Pending Export",
    },
    {
      "unitCount": 13,
      "unitBlockStart": "D001",
      "unitBlockEnd": "D013",
      "unitOwner": "New Owner 4",
      "unitStatus": "Retired",
      "countryJurisdictionOfOwner": "Germany",
      "inCountryJurisdictionOfOwner": "Austria",
    }
  ]
}'
```

Response

```json
{
  "message": "Unit split successful",
  "success": true
}
```

---

### PUT Examples

#### Update a pre-existing unit using only the required parameters

- Note that a unit record with the provided `warehouseUnitId` must already exist

Request

```shell
curl --location -g --request PUT 'localhost:31310/v1/units' \
--header 'Content-Type: application/json' \
--data-raw '{
    "warehouseUnitId": "9a5def49-7af6-428a-9958-a1e88d74bf58",
    "projectLocationId": "Brand New Location",
    "unitOwner": "New Owner",
    "countryJurisdictionOfOwner": "Vanuatu",
    "serialNumberBlock": "QWERTY9800-ASDFGH9850",
    "serialNumberPattern": "[.*\\D]+([0-9]+)+[-][.*\\D]+([0-9]+)$",
    "vintageYear": 2002,
    "unitType": "Removal - technical",
    "unitStatus": "For Sale",
    "unitRegistryLink": "http://climateWarehouse.com/myRegistry",
    "correspondingAdjustmentDeclaration": "Unknown",
    "correspondingAdjustmentStatus": "Not Started"
}'
```

Response

```json
{
  "message": "Unit update added to staging",
  "success": true
}
```

---

#### Update a pre-existing unit using an xlsx file

- Note that it's possible to construct an xlsx file for this purpose
  using [this example](#list-all-units-and-save-the-results-to-an-xlsx-file)

Request

```shell
curl --location -g --request PUT 'http://localhost:31310/v1/units/xlsx' --form 'xlsx=@"./cw_query.xlsx"'
```

Response

```json
{
  "message": "Updates from xlsx added to staging",
  "success": true
}
```

---

### DELETE Examples

#### Delete a unit

Request

```shell
curl --location -g --request DELETE 'localhost:31310/v1/units' \
     --header 'Content-Type: application/json' \
     --data-raw '{
       "warehouseUnitId": "104b082c-b112-4c39-9249-a52c6c53282b"
      }'
```

Response

```json
{
  "message": "Unit deletion staged successfully",
  "success": true
}
```

---

### Additional Units Resources

* POST `units/batch` - create multiple new unit records at once.
  see [the projects example](#stage-a-new-project-from-a-csv-file)

---

## `staging`

Functionality: List, modify, confirm, and cancel projects and units in the `STAGING` state

Options:

|      Key       |    Type     |                                              Description                                               |
|:--------------:|:-----------:|:------------------------------------------------------------------------------------------------------:|
| None (default) |     N/A     |                     Display all projects and units that are currently in `STAGING`                     |
|      type      |   String    |                                     Must be `projects` or `units`                                      |
|     limit      |   Number    | Limit the number of subscribed projects to be displayed (must be used with page, eg `?page=5&limit=2`) |
|      page      |   Number    |       Only display results from this page number (must be used with limit, eg `?page=5&limit=2`)       |
|     table      |   String    |           Specifies which type of staged changes should be committed; `Projects` or `Units`            | 
|      ids       | String List |                    Query param list of strings containing staging UUID's to commit                     | 
|     author     |   String    |                                    Specify the author of the commit                                    | 
|    comment     |   String    |                                    Specify a comment for the commit                                    |

### GET Examples

#### List all projects and units in `STAGING`

- For this example, there is one project with a `DELETE` action, one project with an `INSERT` action, and one unit with
  an `INSERT` action:

Request

```shell
curl --location --request GET 'localhost:31310/v1/staging' --header 'Content-Type: application/json'
```

Response

```json
[
  {
    "id": 38,
    "uuid": "cbc966cd-f4a9-4f7b-9c57-8186fea8b54c",
    "table": "Projects",
    "action": "DELETE",
    "commited": false,
    "failedCommit": false,
    "createdAt": "2022-03-13T03:08:15.156Z",
    "updatedAt": "2022-03-13T03:08:15.156Z",
    "diff": {
      "original": {
        "warehouseProjectId": "cbc966cd-f4a9-4f7b-9c57-8186fea8b54c",
        "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
        "currentRegistry": "123",
        "projectId": "Abcde-12345",
        "originProjectId": null,
        "registryOfOrigin": "500",
        "program": "",
        "projectName": "Example",
        "projectLink": "https://exampleurl",
        "projectDeveloper": "Example Developer",
        "sector": "Viva",
        "projectType": "",
        "projectTags": null,
        "coveredByNDC": "NO",
        "ndcInformation": "Outside NDC",
        "projectStatus": "Registered",
        "projectStatusDate": "2022-03-09T16:00:00.000Z",
        "unitMetric": "tCO2e",
        "methodology": "Quatz",
        "validationBody": null,
        "validationDate": null,
        "timeStaged": null,
        "createdAt": "2022-03-13T03:04:53.168Z",
        "updatedAt": "2022-03-13T03:04:53.168Z",
        "projectLocations": [],
        "labels": [],
        "issuances": [],
        "coBenefits": [],
        "relatedProjects": [],
        "projectRatings": [],
        "estimations": []
      },
      "change": {}
    }
  },
  {
    "id": 39,
    "uuid": "2120ab85-4622-454c-be29-c97071286df1",
    "table": "Projects",
    "action": "INSERT",
    "commited": false,
    "failedCommit": false,
    "createdAt": "2022-03-13T03:09:10.194Z",
    "updatedAt": "2022-03-13T03:09:10.194Z",
    "diff": {
      "original": {},
      "change": [
        {
          "currentRegistry": "123",
          "projectId": "Abcde-12345",
          "registryOfOrigin": "500",
          "program": "",
          "projectName": "Example",
          "projectLink": "https://exampleurl",
          "projectDeveloper": "Example Developer",
          "sector": "Viva",
          "projectType": "",
          "coveredByNDC": "NO",
          "ndcInformation": "Outside NDC",
          "projectStatus": "Registered",
          "projectStatusDate": "3/10/2022",
          "unitMetric": "tCO2e",
          "methodology": "Quatz",
          "warehouseProjectId": "2120ab85-4622-454c-be29-c97071286df1",
          "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9"
        }
      ]
    }
  },
  {
    "id": 40,
    "uuid": "89d7a102-a5a6-4f80-bc67-d28eba4952f3",
    "table": "Units",
    "action": "INSERT",
    "commited": false,
    "failedCommit": false,
    "createdAt": "2022-03-13T03:17:51.752Z",
    "updatedAt": "2022-03-13T03:17:51.752Z",
    "diff": {
      "original": {},
      "change": [
        {
          "projectLocationId": "789",
          "unitOwner": "Sample Owner",
          "countryJurisdictionOfOwner": "Belize",
          "serialNumberBlock": "A345-B567",
          "serialNumberPattern": "[.*\\D]+([0-9]+)+[-][.*\\D]+([0-9]+)$",
          "vintageYear": 2014,
          "unitRegistryLink": "sampleurl.com",
          "unitType": "Reduction - technical",
          "unitStatus": "Buffer",
          "correspondingAdjustmentDeclaration": "Unknown",
          "correspondingAdjustmentStatus": "Pending",
          "warehouseUnitId": "89d7a102-a5a6-4f80-bc67-d28eba4952f3",
          "timeStaged": 1647141471,
          "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9"
        }
      ]
    }
  }
]
```

---

#### List all units in `STAGING`, with paging

Request

```shell
curl --location --request GET 'localhost:31310/v1/staging?page=1&limit=5&type=units' --header 'Content-Type: application/json'
```

Response

```json
{
  "page": 1,
  "pageCount": 1,
  "data": [
    {
      "id": 40,
      "uuid": "89d7a102-a5a6-4f80-bc67-d28eba4952f3",
      "table": "Units",
      "action": "INSERT",
      "commited": false,
      "failedCommit": false,
      "createdAt": "2022-03-13T03:17:51.752Z",
      "updatedAt": "2022-03-13T03:17:51.752Z",
      "diff": {
        "original": {},
        "change": [
          {
            "projectLocationId": "789",
            "unitOwner": "Sample Owner",
            "countryJurisdictionOfOwner": "Belize",
            "serialNumberBlock": "A345-B567",
            "serialNumberPattern": "[.*\\D]+([0-9]+)+[-][.*\\D]+([0-9]+)$",
            "vintageYear": 2014,
            "unitRegistryLink": "sampleurl.com",
            "unitType": "Reduction - technical",
            "unitStatus": "Buffer",
            "correspondingAdjustmentDeclaration": "Unknown",
            "correspondingAdjustmentStatus": "Pending",
            "warehouseUnitId": "89d7a102-a5a6-4f80-bc67-d28eba4952f3",
            "timeStaged": 1647141471,
            "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9"
          }
        ]
      }
    }
  ]
}
```

---

### POST Examples

#### Commit all projects and units in `STAGING`

Request

```shell
curl --location --request POST 'localhost:31310/v1/staging/commit' --header 'Content-Type: application/json' 
```

Response

```json
{
  "message": "Staging Table committed to full node"
}
```

#### Commit all projects in `STAGING`

Request

```shell
curl --location --request POST 'localhost:31310/v1/staging/commit?table=Projects' --header 'Content-Type: application/json' 
```

Response

```json
{
  "message": "Staging Table committed to full node"
}
```

#### Commit specific `STAGING` records from either the Units or Projects staging table by UUID

Request

```shell
curl --location --request POST 'localhost:31310/v1/staging/commit?ids=9a29f826-ea60-489f-a290-c734e8fd57f1&ids=5b29e846-a2c1-589a-d180-b832e7fd67ef' \
--header 'Content-Type: application/json' 
```

Response

```json
{
  "message": "Staging Table committed to full node",
  "success": true
}
```

---

#### Retry committing a single project, using its `uuid`:

Request

```shell
curl --location -g --request POST 'localhost:31310/v1/staging/retry' \
--header 'Content-Type: application/json' \
--data-raw '{
    "uuid": "86c1cd01-0c07-4f02-9a29-490be967ca6c"
}'
```

Response

```json
{
  "message": "Staging record re-staged.",
  "success": true
}
```

---

### DELETE Examples

#### Delete all projects and units in `STAGING`:

Request

```shell
curl --location -g --request DELETE 'localhost:31310/v1/staging/clean' \
     --header 'Content-Type: application/json'
```

Response

```json
{
  "message": "Staging Data Cleaned",
  "success": true
}
```

---

#### Delete a specific project in `STAGING`:

Request

```shell
curl --location -g --request DELETE 'localhost:31310/v1/staging' \
--header 'Content-Type: application/json' \
--data-raw '{
    "uuid": "1647855c-c1fa-4f5b-ae8e-bd9d544442ea"
}'
```

Response

```json
{
  "message": "Deleted from staging",
  "success": true
}
```

---

#### Delete a specific unit in `STAGING`:

Request

```shell
curl --location -g --request DELETE 'localhost:31310/v1/staging' \
--header 'Content-Type: application/json' \
--data-raw '{
    "uuid": "1936260d-632c-4d63-8cba-0014e7c84c0c"
}'
```

Response

```json
{
  "message": "Deleted from staging",
  "success": true
}
```

### Additional Staging Resources

* GET `staging/hasPendingCommits` - can be used to determine if there are pending commits in staging

---

## `issuances`

Functionality: List all issuances from subscribed projects

Options: None

### GET Examples

#### List all issuances from subscribed projects

Request

```shell
curl --location --request GET 'localhost:31310/v1/issuances' --header 'Content-Type: application/json'
```

Response

```json
[
  {
    "id": "d9f58b08-af25-461c-88eb-403bb02b135e",
    "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
    "warehouseProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
    "startDate": "2022-01-02T00:00:00.000Z",
    "endDate": "2022-02-11T00:00:00.000Z",
    "verificationApproach": "Sample Approach",
    "verificationReportDate": "2022-03-16T00:00:00.000Z",
    "verificationBody": "Sample Body",
    "timeStaged": null,
    "createdAt": "2022-03-12T08:58:43.271Z",
    "updatedAt": "2022-03-12T08:58:43.271Z"
  }
]
```

---

## `labels`

Functionality: List all labels from subscribed projects

Options: None

### GET Examples

#### List all labels from subscribed projects

```shell
curl --location --request GET 'localhost:31310/v1/labels' --header 'Content-Type: application/json'
```

```json
[
  {
    "id": "dcacd68e-1cfb-4f06-9798-efa0aacda42c",
    "warehouseProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
    "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
    "label": "Sample Label",
    "labelType": "Certification",
    "creditingPeriodStartDate": "2014-03-29T00:00:00.000Z",
    "creditingPeriodEndDate": "2022-03-30T00:00:00.000Z",
    "validityPeriodStartDate": "2017-03-08T00:00:00.000Z",
    "validityPeriodEndDate": "2025-03-19T00:00:00.000Z",
    "unitQuantity": 40,
    "labelLink": "http://samplelabel.net",
    "timeStaged": null,
    "createdAt": "2022-03-12T08:58:43.270Z",
    "updatedAt": "2022-03-12T08:58:43.270Z"
  }
]
```

---

## `audit`

Functionality: Show the complete history of an organization

Options:

|  Key   |       Type        |                                              Description                                               |
|:------:|:-----------------:|:------------------------------------------------------------------------------------------------------:|
| orgUid | (Required) String |                            Display subscribed projects matching this orgUid                            |
| order  |      String       |            Sort the audit records by `ASC` or `DESC` order based on confirmation timestamp             |
| limit  | (Required) Number | Limit the number of subscribed projects to be displayed (must be used with page, eg `?page=5&limit=2`) |
|  page  | (Required) Number |       Only display results from this page number (must be used with limit, eg `?page=5&limit=2`)       |

### GET Examples

#### Show the complete history of an organization

- Pagination is required when requesting audit history records

```shell
curl --location --request GET 'localhost:31310/v1/audit?orgUid=9659b237d3316e0c5481148f6fbc6257e94736bf160854e7c6734366e312829a&page=1&limit=10' \
--header 'Content-Type: application/json'
```

```json
{
  "page": 1,
  "pageCount": 5,
  "data": [
    {
      "id": 1340232,
      "orgUid": "9659b237d3316e0c5481148f6fbc6257e94736bf160854e7c6734366e312829a",
      "registryId": "62531b9ad830f1e2654f324bb12572f69a8d298e8019901ba5e603fe947e479e",
      "rootHash": "0xf7774bdf95d72aa865e0e153e36c8c2212a2c5be5e389ed333e37fc259730c1e",
      "type": "INSERT",
      NOTE!
      the
      change
      field
      value
      is
      a
      full
      stringified
      change
      record
      "change": "{\"projectLocationId\":\"ID_USA\",\"unitOwner\":\"Chia\", ... !change record json string example truncated! ... }",
      "table": "unit",
      "onchainConfirmationTimeStamp": "1732131042",
      "author": "",
      "comment": "",
      "createdAt": "2024-11-20T19:31:51.960Z",
      "updatedAt": "2024-11-20T19:31:51.960Z",
      "generation": 4
    },
    {
      "id": 560617,
      "orgUid": "9659b237d3316e0c5481148f6fbc6257e94736bf160854e7c6734366e312829a",
      "registryId": "62531b9ad830f1e2654f324bb12572f69a8d298e8019901ba5e603fe947e479e",
      "rootHash": "0x9caef12440fd98bf7edc8820fbc4633ce513df7da4ee70d7af0d68a7b7427361",
      "type": "INSERT",
      NOTE!
      the
      change
      field
      value
      is
      a
      full
      stringified
      change
      record
      "change": "{\"id\":\"c92cf2f0-77c9-4695-b61c-0647a5505f79\", ... !change record json string example truncated! ... }",
      "table": "label_units",
      "onchainConfirmationTimeStamp": "1727796408",
      "author": "",
      "comment": "",
      "createdAt": "2024-10-01T15:28:32.435Z",
      "updatedAt": "2024-10-01T15:28:32.435Z",
      "generation": 3
    },
    {
      "id": 560618,
      "orgUid": "9659b237d3316e0c5481148f6fbc6257e94736bf160854e7c6734366e312829a",
      "registryId": "62531b9ad830f1e2654f324bb12572f69a8d298e8019901ba5e603fe947e479e",
      "rootHash": "0x9caef12440fd98bf7edc8820fbc4633ce513df7da4ee70d7af0d68a7b7427361",
      "type": "INSERT",
      NOTE!
      the
      change
      field
      value
      is
      a
      full
      stringified
      change
      record
      "change": "{\"id\":\"3a4e6897-985e-48d2-b90b-6ddcaf9cc32e\", ... !change record json string example truncated! ... }",
      "table": "labels",
      "onchainConfirmationTimeStamp": "1727796408",
      "author": "",
      "comment": "",
      "createdAt": "2024-10-01T15:28:32.437Z",
      "updatedAt": "2024-10-01T15:28:32.437Z",
      "generation": 3
    },
    {
      "id": 560619,
      "orgUid": "9659b237d3316e0c5481148f6fbc6257e94736bf160854e7c6734366e312829a",
      "registryId": "62531b9ad830f1e2654f324bb12572f69a8d298e8019901ba5e603fe947e479e",
      "rootHash": "0x9caef12440fd98bf7edc8820fbc4633ce513df7da4ee70d7af0d68a7b7427361",
      "type": "INSERT",
      NOTE!
      the
      change
      field
      value
      is
      a
      full
      stringified
      change
      record
      "change": "{\"id\":\"699ba1c8-118e-4eeb-9b57-657226c5bab5\", ... !change record json string example truncated! ... }",
      "table": "issuances",
      "onchainConfirmationTimeStamp": "1727796408",
      "author": "",
      "comment": "",
      "createdAt": "2024-10-01T15:28:32.439Z",
      "updatedAt": "2024-10-01T15:28:32.439Z",
      "generation": 3
    },
    {
      "id": 560620,
      "orgUid": "9659b237d3316e0c5481148f6fbc6257e94736bf160854e7c6734366e312829a",
      "registryId": "62531b9ad830f1e2654f324bb12572f69a8d298e8019901ba5e603fe947e479e",
      "rootHash": "0x9caef12440fd98bf7edc8820fbc4633ce513df7da4ee70d7af0d68a7b7427361",
      "type": "INSERT",
      NOTE!
      the
      change
      field
      value
      is
      a
      full
      stringified
      change
      record
      "change": "{\"warehouseUnitId\":\"5c3a952b-108e-4245-9e02-8fd8e3023a13\", ... !change record json string example truncated! ... }",
      "table": "unit",
      "onchainConfirmationTimeStamp": "1727796408",
      "author": "",
      "comment": "",
      "createdAt": "2024-10-01T15:28:32.523Z",
      "updatedAt": "2024-10-01T15:28:32.523Z",
      "generation": 3
    }
  ]
}
```

---

## `offer`

Functionality: generate, view, import, accept, datalayer offers for data transfers to other organizations

#### A Note On CADT Offers

- Terms:
    - *Offer Maker*: the party requesting that data be transferred from a 3rd party organization into their own
      organization registry
    - *Offer Taker*: the party accepting an offer to transfer ownership of a climate project record form their
      organization registry into
      the offer maker's organization registry
- Transfer Workflow Overview:
    - the offer maker stages the transfer of a project from another registry into their own
    - the offer maker creates an offer file which details the ownership transfer of the project record from its current
      registry into the offer makers registry
    - the offer taker uploads the offer file into CADT and reviews the records changes that have been purposed
    - the offer taker accepts the offer to transfer ownership of the project record and the project record is removed
      from their organization registry and added to the offer makers organization registry

Options:

|      Key       |      Type       |                                            Description                                            |
|:--------------:|:---------------:|:-------------------------------------------------------------------------------------------------:|
| None (default) |       N/A       | Generate and download a datalayer offer file for a transfer in staging or cancel the active offer |
|      file      | File Form Field |         A datalayer offer file detailing a transfer of date out of the uploading registry         |

### GET Examples

#### Generate and download a datalayer offer file

- Used by the offer maker
- For additional information please see [A Note On CADT Offers](#a-note-on-cadt-offers)

Request

```shell
curl --location --request GET 'localhost:31310/v1/offer/' --header 'Content-Type: application/json' > project-offer.txt
```

Response

Download stream to download the project transfer offer file.
Using the above `curl` will save the results to a file in the current directory called `project-offer.txt`.

#### Get the details of the currently uploaded offer file

- Only fetches purposed changes, makes no changes
- Used by the offer taker
- For additional information please see [A Note On CADT Offers](#a-note-on-cadt-offers)

Request

```shell
curl --location --request GET 'localhost:31310/v1/offer/accept' --header 'Content-Type: application/json' > project-offer.txt
```

Response

```json
TODO
```

### POST Examples

#### Upload an offer file

- Upload and parse an offer file named `offer-file.txt` in the current directory
- Used by the offer maker
- For additional information please see [A Note On CADT Offers](#a-note-on-cadt-offers)

```shell
curl --location --request POST 'localhost:31310/accept/import' --header 'Content-Type: multipart/form-data' \
--form 'file=./offer-file.txt'
```

Response

```json
TODO
```

### DELETE Examples

#### Cancel the currently active offer

- Used by the offer maker
- For additional information please see [A Note On CADT Offers](#a-note-on-cadt-offers)

Request

```shell
curl --location --request DELETE 'localhost:31310/v1/offer/accept/cancel' --header 'Content-Type: application/json'
```

Response

```json
{
  "message": "Active offer has been canceled",
  "success": true
}
```

#### Reject the currently imported transfer offer file

- Used by the offer taker
- For additional information please see [A Note On CADT Offers](#a-note-on-cadt-offers)

Request

```shell
curl --location --request DELETE 'localhost:31310/v1/offer/accept/cancel' --header 'Content-Type: application/json'
```

Response

```json
{
  "message": "Offer Cancelled",
  "success": true
}
```

### Additional offer resources

* POST `offer/accept/commit` - (offer maker) accept and commit the currently uploaded offer file

## `governance`

- Functionality for most users: read and sync governance values
- Functionality for climate project development: create and manage governance data

### GET Examples

#### Get picklist data

Request

```shell
curl --location --request GET 'localhost:31310/v1/governance/meta/pickList' --header 'Content-Type: application/json'
```

Response

```json
{
  "registries": [
    "American Carbon Registry (ACR)",
    "Article 6.4 Mechanism Registry",
    "Biocarbon Registry S.A.S",
    "Carbon Assets Trading System (CATS)",
    ...
    abbreviated
    picklist
    ...
    "Switzerland National Registry",
    "UNFCCC",
    "Verra"
  ],
  "projectSector": [
    "Accommodation and food service activities",
    "Activities of extraterritorial organizations and bodies",
    "Activities of households as employers; undifferentiated goods- and services-producing activities of households for own use",
    ...
    abbreviated
    picklist
    ...
    "Wholesale and retail trade; repair of motor vehicles and motorcycles",
    "Not elsewhere classified"
  ],
  "projectType": [
    "Afforestation",
    "Avoided Conversion",
    ...
    abbreviated
    picklist
    ...
    "Reforestation",
    "Soil Enrichment",
    "Technical Removal"
  ],
  "coveredByNDC": [
    "Inside NDC",
    "Outside NDC",
    "Unknown"
  ],
  "projectStatusValues": [
    "Listed",
    "Validated",
    "Registered",
    "Approved",
    "Authorized",
    "Completed",
    "Inactive",
    "Withdrawn",
    "Rejected",
    "De-registered"
  ],
  "unitMetric": [
    "tCO2e"
  ],
  "methodology": [
    "ACR - Truck Stop Electrification",
    "ACR - Advanced Refrigeration Systems",
    "ACR - Certified Reclaimed HFC Refrigerants, Propellants, and Fire Suppressants",
    "ACR - Destruction of Ozone Depleting Substances and High-GWP Foam",
    ...
    abbreviated
    picklist
    ...
    "VCS - VM0043",
    "VCS - VMR000",
    "VCS - VMR006"
  ],
  "validationBody": [
    "350 Solutions",
    "4K Earth Science Private Limited",
    ...
    abbreviated
    picklist
    ...
    "Versa Expertos en Certificación",
    "VKU Certification Private Limited"
  ],
  "countries": [
    "Afghanistan",
    "Albania",
    "Algeria",
    ...
    abbreviated
    picklist
    ...
    "Zimbabwe",
    "Not Specified"
  ],
  "ratingType": [
    "CDP",
    "CCQI"
  ],
  "unitType": [
    "Avoidance",
    "Reduction - nature",
    "Reduction - technical",
    "Removal - nature",
    "Removal - technical",
    "Not Determined"
  ],
  "unitStatus": [
    "Held",
    "Retired",
    "Cancelled",
    "Expired",
    "Inactive",
    "Buffer",
    "Exported",
    "Rejected",
    "Pending Export"
  ],
  "correspondingAdjustmentDeclaration": [
    "Committed",
    "Not Required",
    "Unknown"
  ],
  "correspondingAdjustmentStatus": [
    "Not Applicable",
    "Not Started",
    "Pending",
    "Completed"
  ],
  "labelType": [
    "Endorsement",
    "Letter of Qualification",
    "Certification"
  ],
  "verificationBody": [
    "350 Solutions",
    "4K Earth Science Private Limited",
    "AENOR International S.A.U.",
    ...
    abbreviated
    picklist
    ...
    "Verifit",
    "Versa Expertos en Certificación",
    "VKU Certification Private Limited"
  ],
  "projectTags": [
    " "
  ],
  "unitTags": [
    " "
  ],
  "coBenefits": [
    "SDG 1 - No poverty",
    "SDG 2 - Zero hunger",
    "SDG 3 - Good health and well-being",
    ...
    abbreviated
    picklist
    ...
    "SDG 16 - Peace and justice strong institutions",
    "SDG 17 - Partnerships for the goals"
  ]
}
```

#### Get the UID's of all organizations registered in governance data

Request

```shell
curl --location --request GET 'localhost:31310/v1/governance/meta/orgList' --header 'Content-Type: application/json'
```

Response

```json
[
  {
    "orgUid": "a9d374baa8ced8b7a4add2a23f35f430fd7a3c99d1480d762e0b40572db4b024"
  },
  {
    "orgUid": "fa47700cb693529602c3eab47a5d681ffe0145dabeee6c69cabdd7869537b917"
  },
  {
    "orgUid": "6cde6a6e4e997952ca01500d830904a084267e2390008d2ae5ca46ed549373ef"
  },
  {
    "orgUid": "5fe508f320f32f51cc53c337d4d1bab5b7a87f8aaeb53fdbdaa87f57eef74b5b"
  },
  {
    "orgUid": "e3a5854f359a6dece0bd822a0f79342be4552da0d6ab21b89085599f3ca0fa45"
  },
  {
    "orgUid": "b3d4e71d806e86ff1f8712b6854d65e2c178e873ee22b2f7d0da937dacbaa985"
  },
  {
    "orgUid": "aca536f31e0d9e9b25c311fa452763282e7ee21d2be684483a293923ca9ab012"
  }
]
```

### POST Examples

#### Set the governance organization list

Request

```shell
curl --location --request POST 'localhost:31310/v1/governance/meta/glossary' --header 'Content-Type: application/json' \
--data-raw '[
  {
    "orgUid": "a9d374baa8ced8b7a4add2a23f35f430fd7a3c99d1480d762e0b40572db4b024"
  },
  {
    "orgUid": "fa47700cb693529602c3eab47a5d681ffe0145dabeee6c69cabdd7869537b917"
  },
  {
    "orgUid": "6cde6a6e4e997952ca01500d830904a084267e2390008d2ae5ca46ed549373ef"
  },
  {
    "orgUid": "5fe508f320f32f51cc53c337d4d1bab5b7a87f8aaeb53fdbdaa87f57eef74b5b"
  },
  {
    "orgUid": "e3a5854f359a6dece0bd822a0f79342be4552da0d6ab21b89085599f3ca0fa45"
  },
  {
    "orgUid": "b3d4e71d806e86ff1f8712b6854d65e2c178e873ee22b2f7d0da937dacbaa985"
  },
  {
    "orgUid": "aca536f31e0d9e9b25c311fa452763282e7ee21d2be684483a293923ca9ab012"
  }
]'
```

Response

```json
{
  "message": "Committed this new organization list to the datalayer",
  "success": true
}
```

### POST Examples

### Additional Governance Resources

* GET `/governance/exists` - determine if the instance is a governance body
* GET `/governance` - get all governance data. picklist orgList, pickList, and glossary data stringified in the
  metaValue attribute
* GET `/governance/sync` - sync governance data from other governance bodies
* GET `/governance/meta/picklist` - get governance picklist data
* GET `/governance/meta/glossary` - get governance glossary data
* POST `/governance` - create a governance body on the current node
* POST `/governance/meta/picklist` - set the governance picklist data returned by GET `/governance/meta/picklist`
* POST `/governance/meta/glossary` - set the governance glossary data returned by GET `/governance/meta/glossary`

## `filestore`

### Resources

* GET `filestore/get_file` - get a file from the file store by fileId
* GET `filestore/get_file_list` - get a list of files in the file store
* POST `filestore/add_file` - commit a file to the file store
* POST `filestore/subscribe` - subscribe to a file store
* POST `filestore/unsubscribe` - subscribe to a file store
* DELETE `filestore/delete_file` - delete a file from the file store by fileId