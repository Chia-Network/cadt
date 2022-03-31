---
sidebar_position: 4
---
# 12.4 Climate Warehouse (Beta) RPC API

This page lists commands and examples from the Climate Warehouse Beta RPC API.

Please also see the following related documents:
  * [Climate Warehouse](/docs/15resources/data_layer_install_guide "Climate Warehouse install guide") installation/configuration guide
  * [Chia Data Layer CLI](/docs/13cli/data "Section 13.2: Data Layer (Beta) CLI") reference
  * [Chia Data Layer RPC API](/docs/12rpcs/data_layer_rpc_api "Section 12.3: Data Layer Beta RPC API") reference

The Climate Warehosue RPC API is exposed by default on port 31310. This document will give examples to access the RPC API using `http://localhost:31310/v1`.

## Commands

* [`organizations`](#organizations)
  * [GET Examples](#get-examples)
    * [List all subscribed organizations](#list-all-subscribed-organizations)
  * [POST Examples](#post-examples)
    * [Create an organization](#create-an-organization)
  * [PUT Examples](#put-examples)
    * [Subscribe to an organization](#subscribe-to-an-organization)
* [`projects`](#projects)
  * [GET Examples](#get-examples-1)
    * [Show all subscribed projects](#show-all-subscribed-projects)
    * [List projects by warehouseprojectid](#list-projects-by-warehouseprojectid)
    * [List projects by orguid](#list-projects-by-orguid)
    * [Search for projects containing the keyword "forestry"](#search-for-projects-containing-the-keyword-forestry)
    * [List all projects, with paging](#list-all-projects-with-paging)
    * [List projects by orguid, with paging](#list-projects-by-orguid-with-paging)
    * [Search for projects containing the keyword "gold", with paging](#search-for-projects-containing-the-keyword-gold-with-paging)
    * [List all projects and save the results to an xlsx file](#list-all-projects-and-save-the-results-to-an-xlsx-file)
    * [Show only the requested columns](#show-only-the-requested-columns)
  * [POST Examples](#post-examples-1)
    * [Stage a new project with the minimum required fields](#stage-a-new-project-with-the-minimum-required-fields)
    * [Stage a new project from a csv file](#stage-a-new-project-from-a-csv-file)
  * [PUT Examples](#put-examples-1)
    * [Update a pre-existing project using only the required parameters](#update-a-pre-existing-project-using-only-the-required-parameters)
    * [Update a pre-existing project from an xlsx file](#update-a-pre-existing-project-from-an-xlsx-file)
  * [DELETE Examples](#delete-examples)
    * [Delete a project](#delete-a-project)
* [`units`](#units)
  * [GET Examples](#get-examples-2)
    * [List all subscribed units](#list-all-subscribed-units)
    * [Search for units containing the keyword "certification"](#search-for-units-containing-the-keyword-certification)
    * [List units by orguid](#list-units-by-orguid)
    * [Show all units, with paging](#show-all-units-with-paging)
    * [List units by orguid, with paging](#list-units-by-orguid-with-paging)
    * [List all units and save the results to an xlsx file](#list-all-units-and-save-the-results-to-an-xlsx-file)
    * [List units using all available query string options](#list-units-using-all-available-query-string-options)
    * [Show only specified columns from all units, with paging](#show-only-specified-columns-from-all-units-with-paging)
  * [POST Examples](#post-examples-2)
    * [Create a new unit using only the required fields](#create-a-new-unit-using-only-the-required-fields)
    * [Create a new unit with pre-existing issuance and labels](#create-a-new-unit-with-pre-existing-issuance-and-labels)
    * [Split units in four](#split-units-in-four)
  * [PUT Examples](#put-examples-2)
    * [Update a pre-existing unit using only the required parameters](#update-a-pre-existing-unit-using-only-the-required-parameters)
    * [Update a pre-existing unit using an xlsx file](#update-a-pre-existing-unit-using-an-xlsx-file)
  * [DELETE Examples](#delete-examples-1)
    * [Delete a unit](#delete-a-unit)
* [`issuances`](#issuances)
  * [GET Examples](#get-examples-3)
    * [List all issuances from subscribed projects](#list-all-issuances-from-subscribed-projects)
* [`labels`](#labels)
  * [GET Examples](#get-examples-4)
    * [List all labels from subscribed projects](#list-all-labels-from-subscribed-projects)
* [`staging`](#staging)
  * [GET Examples](#get-examples-5)
    * [List all projects and units in STAGING](#list-all-projects-and-units-in-staging)
    * [List all units in STAGING, with paging](#list-all-units-in-staging-with-paging)
  * [POST Examples](#post-examples-3)
    * [Commit all projects and units in STAGING](#commit-all-projects-and-units-in-staging)
    * [Retry committing a single project, using its uuid](#retry-committing-a-single-project-using-its-uuid)
  * [DELETE Examples](#delete-examples-2)
    * [Delete all projects and units in STAGING](#delete-all-projects-and-units-in-staging)
    * [Delete a specific project in STAGING](#delete-a-specific-project-in-staging)
    * [Delete a specific unit in STAGING](#delete-a-specific-unit-in-staging)
* [`audit`](#audit)
  * [GET Examples](#get-examples-6)
    * [Show the complete history of an organization](#show-the-complete-history-of-an-organization)

---

## Reference

## `organizations`

Functionality: Use GET, POST, and PUT to list, create, and update organizations

GET Options: None

### GET Examples

#### List all subscribed organizations

```json
// Request
curl --location --request GET 'localhost:31310/v1/organizations' --header 'Content-Type: application/json'

// Response
{
    "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9":{
        "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
        "name":"Org Test",
        "icon":"https://climate-warehouse.s3.us-west-2.amazonaws.com/public/orgs/me.svg",
        "isHome":true,
        "subscribed":true
    }
}
```
-----

POST Options:

| Key   | Type   | Description |
|:-----:|:------:|:------------|
| name  | String | (Required) Name of the organization to be created |
| icon  | String | (Required) URL of the icon to be used for this organization |

### POST Examples

#### Create an organization

```json
// Request
curl --location -g --request POST 'localhost:31310/v1/organizations/' \
     --header 'Content-Type: application/json' \
     --data-raw '{
        "name": "Sample Org",
        "icon": "https://climate-warehouse.s3.us-west-2.amazonaws.com/public/orgs/me.svg"
}'

// Response
{
  "message":"New organization created successfully.",
  "orgId":"d84ab5fa679726e988b31ecc8ecff0ba8d001e9d65f1529d794fa39d32a5455e"
}
```
-----

PUT Options: None

### PUT Examples

#### Subscribe to an organization

```json
// Request
curl --location -g --request PUT 'localhost:31310/v1/organizations/'

// Response
{"message":"Importing and subscribing organization this can take a few mins."}
```
-----

## `projects`

Functionality: List subscribed projects, as specified by the appropriate URL option(s)

Query string options:

| Key                | Type    | Description |
|:------------------:|:-------:|:------------|
| None (default)     | N/A     | Display all subscribed projects |
| warehouseProjectId | String  | Only display subscribed projects matching this warehouseProjectId |
| orgUid             | String  | Only display subscribed projects matching this orgUid |
| search             | String  | Display all subscribed projects that contain the specified query (case insensitive) |
| columns            | String  | Limit the result to the specified column. Can be used multiple times to show multiple columns
| limit              | Number  | Limit the number of subscribed projects to be displayed (must be used with page, eg `?page=5&limit=2`) |
| page               | Number  | Only display results from this page number (must be used with limit, eg `?page=5&limit=2`) |
| xls                | Boolean | If `true`, save the results to xls (Excel spreadsheet) format |

### GET Examples

#### Show all subscribed projects

* In this example, no query string is used. This is the default, which lists all projects

```json
// Request
curl --location --request GET 'localhost:31310/v1/projects' --header 'Content-Type: application/json'

// Response
[{
    "warehouseProjectId":"9b9bb857-c71b-4649-b805-a289db27dc1c",
    "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
    "currentRegistry":"Climate Action Reserve (CAR)",
    "projectId":"789",
    "originProjectId":"123",
    "registryOfOrigin":"Sweden National Registry",
    "program":null,
    "projectName":"Stop Desertification",
    "projectLink":"desertificationtest.com",
    "projectDeveloper":"Dev 2",
    "sector":"Fugitive emissions – from fuels (solid, oil and gas)",
    "projectType":"Coal Mine Methane",
    "projectTags":null,
    "coveredByNDC":"Outside NDC",
    "ndcInformation":null,
    "projectStatus":"Registered",
    "projectStatusDate":"2022-02-02T00:00:00.000Z",
    "unitMetric":"tCO2e",
    "methodology":"Substitution of CO2 from fossil or mineral origin by CO2 from biogenic residual sources in the production of inorganic compounds --- Version 3.0",
    "validationBody":null,
    "validationDate":null,
    "timeStaged":1646975765,
    "createdAt":"2022-03-11T05:17:55.427Z",
    "updatedAt":"2022-03-11T05:17:55.427Z",
    "projectLocations":[{
        "id":"8182100d-7794-4df7-b3b3-758391d13011",
        "warehouseProjectId":"9b9bb857-c71b-4649-b805-a289db27dc1c",
        "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
        "country":"Latvia",
        "inCountryRegion":null,
        "geographicIdentifier":"Sample Identifier",
        "timeStaged":null,
        "createdAt":"2022-03-11T05:17:55.425Z",
        "updatedAt":"2022-03-11T05:17:55.425Z"
    }],
    "labels":[{
        "id":"dcacd68e-1cfb-4f06-9798-efa0aacda42c",
        "warehouseProjectId":"9b9bb857-c71b-4649-b805-a289db27dc1c",
        "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
        "label":"Sample Label",
        "labelType":"Certification",
        "creditingPeriodStartDate":"2014-03-29T00:00:00.000Z",
        "creditingPeriodEndDate":"2022-03-30T00:00:00.000Z",
        "validityPeriodStartDate":"2017-03-08T00:00:00.000Z",
        "validityPeriodEndDate":"2025-03-19T00:00:00.000Z",
        "unitQuantity":40,
        "labelLink":"http://samplelabel.net",
        "timeStaged":null,
        "createdAt":"2022-03-11T05:17:55.426Z",
        "updatedAt":"2022-03-11T05:17:55.426Z"
    }],
    "issuances":[{
        "id":"d9f58b08-af25-461c-88eb-403bb02b135e",
        "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
        "warehouseProjectId":"9b9bb857-c71b-4649-b805-a289db27dc1c",
        "startDate":"2022-01-02T00:00:00.000Z",
        "endDate":"2022-02-11T00:00:00.000Z",
        "verificationApproach":"Sample Approach",
        "verificationReportDate":"2022-03-16T00:00:00.000Z",
        "verificationBody":"Sample Body",
        "timeStaged":null,
        "createdAt":"2022-03-11T05:17:55.426Z",
        "updatedAt":"2022-03-11T05:17:55.426Z"
    }],
    "coBenefits":[{
        "id":"73cfbe9c-8cea-4aca-94d8-f1641e686787",
        "warehouseProjectId":"9b9bb857-c71b-4649-b805-a289db27dc1c",
        "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
        "cobenefit":"Sample Benefit",
        "timeStaged":null,
        "createdAt":"2022-03-11T05:17:55.424Z",
        "updatedAt":"2022-03-11T05:17:55.424Z"
    }],
    "relatedProjects":[{
        "id":"e880047e-cdf4-45bb-a9df-e706fa427713",
        "warehouseProjectId":"9b9bb857-c71b-4649-b805-a289db27dc1c",
        "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
        "relatedProjectId":"333",
        "relationshipType":"Sample",
        "registry":null,
        "timeStaged":null,
        "createdAt":"2022-03-11T05:17:55.426Z",
        "updatedAt":"2022-03-11T05:17:55.426Z"
    }],
    "projectRatings":[{
        "id":"d31c3c75-b944-498d-9557-315f9005f478",
        "warehouseProjectId":"9b9bb857-c71b-4649-b805-a289db27dc1c",
        "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
        "ratingType":"CCQI",
        "ratingRangeHighest":"100",
        "ratingRangeLowest":"0",
        "rating":"97",
        "ratingLink":"testlink.com",
        "timeStaged":null,
        "createdAt":"2022-03-11T05:17:55.427Z",
        "updatedAt":"2022-03-11T05:17:55.427Z"
    }],
    "estimations":[{
        "id":"c73fb4e7-3bd0-4449-8a57-6137b7c95a1f",
        "warehouseProjectId":"9b9bb857-c71b-4649-b805-a289db27dc1c",
        "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
        "creditingPeriodStart":"2022-02-04T00:00:00.000Z",
        "creditingPeriodEnd":"2022-03-04T00:00:00.000Z",
        "unitCount":100,
        "timeStaged":null,
        "createdAt":"2022-03-11T05:17:55.427Z",
        "updatedAt":"2022-03-11T05:17:55.427Z"
    }]
    
},{
    "warehouseProjectId":"51ca9638-22b0-4e14-ae7a-c09d23b37b58",
    "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
    "currentRegistry":"Gold Standard",
    "projectId":"555",
    "originProjectId":"555",
    "registryOfOrigin":"Gold Standard",
    "program":null,
    "projectName":"Stop Deforestation",
    "projectLink":"http://testurl.com",
    "projectDeveloper":"Example Developer",
    "sector":"Agriculture Forestry and Other Land Use (AFOLU)",
    "projectType":"Soil Enrichment",
    "projectTags":null,
    "coveredByNDC":"Unknown",
    "ndcInformation":null,
    "projectStatus":"Listed",
    "projectStatusDate":"2022-03-02T00:00:00.000Z",
    "unitMetric":"tCO2e",
    "methodology":"Decomposition of fluoroform (HFC-23) waste streams --- Version 6.0.0",
    "validationBody":null,
    "validationDate":null,
    "timeStaged":1646803417,
    "createdAt":"2022-03-11T05:17:55.422Z",
    "updatedAt":"2022-03-11T05:17:55.422Z",
    "projectLocations":[],
    "labels":[],
    "issuances":[],
    "coBenefits":[],
    "relatedProjects":[],
    "projectRatings":[],
    "estimations":[]
}]
```
-----

#### List projects by `warehouseProjectId`

```json
// Request
curl --location --request GET 'localhost:31310/v1/projects?warehouseProjectId=51ca9638-22b0-4e14-ae7a-c09d23b37b58' --header 'Content-Type: application/json'

// Response
{
    "warehouseProjectId":"51ca9638-22b0-4e14-ae7a-c09d23b37b58",
    "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
    "currentRegistry":"Gold Standard",
    "projectId":"555",
    ...
    abbreviated (output is same as above)
    ...
}
```
-----

#### List projects by `orgUid`

```json
// Request
curl --location --request GET 'localhost:31310/v1/projects?orgUid=77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9' --header 'Content-Type: application/json'

// Response
[{
    "warehouseProjectId":"9b9bb857-c71b-4649-b805-a289db27dc1c",
    "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
    "currentRegistry":"Climate Action Reserve (CAR)",
    "projectId":"789",
    ...
    abbreviated (output is same as above)
    ...
},{
    "warehouseProjectId":"51ca9638-22b0-4e14-ae7a-c09d23b37b58",
    "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
    "currentRegistry":"Gold Standard",
    "projectId":"555",
    ...
    abbreviated (output is same as above)
    ...
}]

```
-----

#### Search for projects containing the keyword "forestry"

```json
// Request
curl --location --request GET 'localhost:31310/v1/projects?search=forestry' --header 'Content-Type: application/json'

// Response
[{
    "warehouseProjectId":"51ca9638-22b0-4e14-ae7a-c09d23b37b58",
    "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
    "currentRegistry":"Gold Standard",
    "projectId":"555",
    "originProjectId":"555",
    "registryOfOrigin":"Gold Standard",
    "program":null,
    "projectName":"Stop Deforestation",
    "projectLink":"http://testurl.com",
    "projectDeveloper":"Example Developer",
    "sector":"Agriculture Forestry and Other Land Use (AFOLU)",
    ...
    abbreviated (output is same as above)
    ...
}
```
-----

#### List all projects, with paging

```json
// Request
curl --location --request GET 'localhost:31310/v1/projects?page=2&limit=1' --header 'Content-Type: application/json'

// Response
{
    "page":2,
    "pageCount":2,
    "data":[{
        "warehouseProjectId":"51ca9638-22b0-4e14-ae7a-c09d23b37b58",
        "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
        "currentRegistry":"Gold Standard",
        "projectId":"555",
        ...
        abbreviated (output is same as above)
        ...
    }]
}
```
-----

#### List projects by `orgUid`, with paging

```json
// Request
curl --location --request GET 'localhost:31310/v1/projects?page=2&limit=1&orgUid=77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9' --header 'Content-Type: application/json'

// Response
{
    "page":2,
    "pageCount":2,
    "data":[{
        "warehouseProjectId":"51ca9638-22b0-4e14-ae7a-c09d23b37b58",
        "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
        "currentRegistry":"Gold Standard",
        "projectId":"555",
        ...
        abbreviated (output is same as above)
        ...
    }]
}
```
-----

#### Search for projects containing the keyword "gold", with paging

```json
// Request
curl --location --request GET 'localhost:31310/v1/projects?page=1&limit=1&search=gold' --header 'Content-Type: application/json'

// Response

{
  "page":1,
  "pageCount":1,
  "data":[{
    "warehouseProjectId":"51ca9638-22b0-4e14-ae7a-c09d23b37b58",
    "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
    "currentRegistry":"Gold Standard",
    "projectId":"555",
    ...
    abbreviated (output is same as above)
    ...
  }]
}
```
-----

#### List all projects and save the results to an xlsx file

```json
// Request
curl --location --request GET 'localhost:31310/v1/projects?xls=true' --header 'Content-Type: application/json' > cw_query.xlsx

// Response
The results are saved to a file in the current directory called `cw_query.xlsx`.
```
-----

#### Show only the requested columns

```json
// Request
curl --location --request GET 'http://localhost:31310/v1/projects?page=1&limit=5&columns=warehouseProjectId&columns=currentRegistry&columns=registryOfOrigin&columns=originProjectId&columns=program&columns=projectName' --header 'Content-Type: application/json'

// Response
{
  "page":1,
  "pageCount":1,
  "data":[{
    "warehouseProjectId":"9b9bb857-c71b-4649-b805-a289db27dc1c",
    "currentRegistry":"Climate Action Reserve (CAR)",
    "registryOfOrigin":"Sweden National Registry",
    "originProjectId":"123",
    "program":null,
    "projectName":"Stop Desertification"
  },{
    "warehouseProjectId":"51ca9638-22b0-4e14-ae7a-c09d23b37b58",
    "currentRegistry":"Gold Standard",
    "registryOfOrigin":"Gold Standard",
    "originProjectId":"555",
    "program":null,
    "projectName":"Stop Deforestation"
  }]
}
```
-----

### POST Examples

#### Stage a new project with the minimum required fields

```json
// Request
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

// Response
{"message":"Project staged successfully"}
```
-----

#### Stage a new project from a csv file

* For this example, we'll use a file named `createProject.csv`, created from [this example](#list-all-projects-and-save-the-results-to-an-xlsx-file "List all projects and save the results to an xlsx file") and converted to csv format
* The contents of the csv file used in this example are as follows:

```
warehouseProjectId,orgUid,currentRegistry,projectId,originProjectId,registryOfOrigin,program,projectName,projectLink,projectDeveloper,sector,projectType,projectTags,coveredByNDC,ndcInformation,projectStatus,projectStatusDate,unitMetric,methodology,validationBody,validationDate
f925cb3f-f59a-4ba4-8844-e2a63eb38221,f048f0c4e2ef2d852354a71a0839687301376eeef4358f6204795723ef906bcf,,c9d147e2-bc07-4e68-a76d-43424fa8cd4e,12345-123-123-12345,UNFCCC,,POST sample,http://testurl.com,POST developer,Manufacturing industries,Conservation,,Inside NDC,Shuffletag,Registered,2022-03-12T00:00:00.000Z,tCO2e,Integrated Solar Combined Cycle (ISCC) projects --- Version 1.0.0,,

```

```json
// Request
curl --location --request POST 'http://localhost:31310/v1/projects/batch' --form 'csv=@"./createProject.csv"'

// Response
{"message":"CSV processing complete, your records have been added to the staging table."}
```
-----

### PUT Examples

#### Update a pre-existing project using only the required parameters

```json
// Request
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

// Response
{"message":"Project update added to staging"}
```
-----

#### Update a pre-existing project from an xlsx file

* For this example, we'll use a file named `cw_query.xlsx`, created from [this example](#list-all-projects-and-save-the-results-to-an-xlsx-file "List all projects and save the results to an xlsx file") and modified with updates

```json
// Request
curl --location -g --request PUT 'http://localhost:31310/v1/projects/xlsx' --form 'xlsx=@"./cw_query.xlsx"'

// Response
{"message":"Updates from xlsx added to staging"}
```
-----

### DELETE Examples

#### Delete a project

```json
// Request
curl --location -g --request DELETE 'http://localhost:31310/v1/projects' \
--header 'Content-Type: application/json' \
--data-raw '{
    "warehouseProjectId": "693d37f6-318e-4d8b-9e14-3d2328b569be"
  }'

// Response
{"message":"Project deleted successfully"}
```
-----

## `units`

Functionality: List subscribed units, as specified by the appropriate URL option(s)

Query string options:

| Key                | Type    | Description |
|:------------------:|:-------:|:------------|
| None (default)     | N/A     | Display all subscribed units |
| orgUid             | String  | Only display subscribed units matching this orgUid |
| search             | String  | Display all subscribed units that contain the specified query (case insensitive) |
| columns            | String  | Limit the result to the specified column. Can be used multiple times to show multiple columns
| limit              | Number  | Limit the number of subscribed units to be displayed (must be used with page, eg `?page=5&limit=2`) |
| page               | Number  | Only display results from this page number (must be used with limit, eg `?page=5&limit=2`) |
| xls                | Boolean | If `true`, save the results to xls (Excel spreadsheet) format |


### GET Examples

#### List all subscribed units

```json
// Request
curl --location -g --request GET 'localhost:31310/v1/units' --header 'Content-Type: application/json'

// Response
[{
  "unitBlockStart":"A345",
  "unitBlockEnd":"B567",
  "unitCount":222,
  "warehouseUnitId":"89d7a102-a5a6-4f80-bc67-d28eba4952f3",
  "issuanceId":null,
  "projectLocationId":"789",
  "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
  "unitOwner":"Sample Owner",
  "countryJurisdictionOfOwner":"Belize",
  "inCountryJurisdictionOfOwner":null,
  "serialNumberBlock":"A345-B567",
  "serialNumberPattern":"[.*\\D]+([0-9]+)+[-][.*\\D]+([0-9]+)$",
  "vintageYear":2014,
  "unitType":"Reduction - technical",
  "marketplace":null,
  "marketplaceLink":null,
  "marketplaceIdentifier":null,
  "unitTags":null,
  "unitStatus":"Buffer",
  "unitStatusReason":null,
  "unitRegistryLink":"sampleurl.com",
  "correspondingAdjustmentDeclaration":"Unknown",
  "correspondingAdjustmentStatus":"Pending",
  "timeStaged":1647141471,
  "createdAt":"2022-03-13T05:29:39.647Z",
  "updatedAt":"2022-03-13T05:29:39.647Z",
  "labels":[],
  "issuance":null
},{
  "unitBlockStart":"abc123",
  "unitBlockEnd":"abd124",
  "unitCount":1,
  "warehouseUnitId":"68fcf0b2-f1b9-4bb4-b91a-e4fe6f07a2d6",
  "issuanceId":null,
  "projectLocationId":"44",
  "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
  "unitOwner":"44",
  "countryJurisdictionOfOwner":"United States of America",
  "inCountryJurisdictionOfOwner":null,
  "serialNumberBlock":"abc123-abd124",
  "serialNumberPattern":"[.*\\D]+([0-9]+)+[-][.*\\D]+([0-9]+)$",
  "vintageYear":2022,
  "unitType":"Reduction - nature",
  "marketplace":null,
  "marketplaceLink":null,
  "marketplaceIdentifier":null,
  "unitTags":null,
  "unitStatus":"Held",
  "unitStatusReason":null,
  "unitRegistryLink":"http://registry.link",
  "correspondingAdjustmentDeclaration":"Committed",
  "correspondingAdjustmentStatus":"Not Started",
  "timeStaged":1646806230,
  "createdAt":"2022-03-13T05:29:39.642Z",
  "updatedAt":"2022-03-13T05:29:39.642Z",
  "labels":[],
  "issuance":null
}]
```
-----

#### Search for units containing the keyword "certification"
[todo: This isn't implemented yet.
See [CW issue 232](https://github.com/Chia-Network/climate-warehouse/issues/232) for more info]

```json
// Request
curl --location -g --request GET 'localhost:31310/v1/units?search=Certification'

// Response

```
-----

#### List units by `orgUid`

```json
// Request
curl --location -g --request GET \
     'localhost:31310/v1/units?orgUid=77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9' \
     --header 'Content-Type: application/json'

// Response
[{
  "unitBlockStart":"A345",
  "unitBlockEnd":"B567",
  "unitCount":222,
  "warehouseUnitId":"89d7a102-a5a6-4f80-bc67-d28eba4952f3",
  ...
  abbreviated (output is same as above)
  ...
},{
  "unitBlockStart":"abc123",
  "unitBlockEnd":"abd124",
  "unitCount":1,
  "warehouseUnitId":"68fcf0b2-f1b9-4bb4-b91a-e4fe6f07a2d6",
  ...
  abbreviated (output is same as above)
  ...
}]

```
-----

#### Show all units, with paging

```json
// Request
curl --location -g --request GET \
     'localhost:31310/v1/units?page=2&limit=1' \
     --header 'Content-Type: application/json'

// Response
{
  "page":2,
  "pageCount":2,
  "data":[{
    "unitBlockStart":"abc123",
    "unitBlockEnd":"abd124",
    "unitCount":1,
    "warehouseUnitId":"68fcf0b2-f1b9-4bb4-b91a-e4fe6f07a2d6",
    "issuanceId":null,
    "projectLocationId":"44",
    "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
    "unitOwner":"44",
    "countryJurisdictionOfOwner":"United States of America",
    "inCountryJurisdictionOfOwner":null,
    "serialNumberBlock":"abc123-abd124",
    "serialNumberPattern":"[.*\\D]+([0-9]+)+[-][.*\\D]+([0-9]+)$",
    "vintageYear":2022,
    "unitType":"Reduction - nature",
    "marketplace":null,
    "marketplaceLink":null,
    "marketplaceIdentifier":null,
    "unitTags":null,
    "unitStatus":"Held",
    "unitStatusReason":null,
    "unitRegistryLink":"http://registry.link",
    "correspondingAdjustmentDeclaration":"Committed",
    "correspondingAdjustmentStatus":"Not Started",
    "timeStaged":1646806230,
    "createdAt":"2022-03-13T05:29:39.642Z",
    "updatedAt":"2022-03-13T05:29:39.642Z",
    "labels":[],
    "issuance":null
  }
]}
```
-----

#### List units by `orgUid`, with paging

```json
// Request
curl --location -g --request GET \
     'localhost:31310/v1/units?page=1&limit=1&orgUid=77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9' \
     --header 'Content-Type: application/json'

// Response
{
  "page":1,
  "pageCount":2,
  "data":[{
    "unitBlockStart":"A345",
    "unitBlockEnd":"B567",
    "unitCount":222,
    "warehouseUnitId":"89d7a102-a5a6-4f80-bc67-d28eba4952f3",
    "issuanceId":null,
    "projectLocationId":"789",
    "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
    "unitOwner":"Sample Owner",
    "countryJurisdictionOfOwner":"Belize",
    "inCountryJurisdictionOfOwner":null,
    "serialNumberBlock":"A345-B567",
    "serialNumberPattern":"[.*\\D]+([0-9]+)+[-][.*\\D]+([0-9]+)$",
    "vintageYear":2014,
    "unitType":"Reduction - technical",
    "marketplace":null,
    "marketplaceLink":null,
    "marketplaceIdentifier":null,
    "unitTags":null,
    "unitStatus":"Buffer",
    "unitStatusReason":null,
    "unitRegistryLink":"sampleurl.com",
    "correspondingAdjustmentDeclaration":"Unknown",
    "correspondingAdjustmentStatus":"Pending",
    "timeStaged":1647141471,
    "createdAt":"2022-03-13T05:29:39.647Z",
    "updatedAt":"2022-03-13T05:29:39.647Z",
    "labels":[],
    "issuance":null
  }]
}
```
-----

#### List all units and save the results to an xlsx file

```json
// Request
curl --location --request GET 'localhost:31310/v1/units?xls=true' --header 'Content-Type: application/json' > cw_units.xlsx

// Response
The results are saved to a file in the current directory called `cw_query.xlsx`.
```
-----

#### List units using all available query string options

```json
// Request
curl --location -g --request GET 'localhost:31310/v1/units?page=1&limit=10&search=Reduction&warehouseUnitId=89d7a102-a5a6-4f80-bc67-d28eba4952f3&columns=all&orgUid=77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9&xls=false' \
--header 'Content-Type: application/json'

// Response
{
  "unitBlockStart":"A345",
  "unitBlockEnd":"B567",
  "unitCount":222,
  "warehouseUnitId":"89d7a102-a5a6-4f80-bc67-d28eba4952f3",
  "issuanceId":null,
  "projectLocationId":"789",
  "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
  "unitOwner":"Sample Owner",
  "countryJurisdictionOfOwner":"Belize",
  "inCountryJurisdictionOfOwner":null,
  "serialNumberBlock":"A345-B567",
  "serialNumberPattern":"[.*\\D]+([0-9]+)+[-][.*\\D]+([0-9]+)$",
  "vintageYear":2014,
  "unitType":"Reduction - technical",
  "marketplace":null,
  "marketplaceLink":null,
  "marketplaceIdentifier":null,
  "unitTags":null,
  "unitStatus":"Buffer",
  "unitStatusReason":null,
  "unitRegistryLink":"sampleurl.com",
  "correspondingAdjustmentDeclaration":"Unknown",
  "correspondingAdjustmentStatus":"Pending",
  "timeStaged":1647141471,
  "createdAt":"2022-03-13T05:29:39.647Z",
  "updatedAt":"2022-03-13T05:29:39.647Z",
  "labels":[],
  "issuance":null
}
```
-----

#### Show only specified columns from all units, with paging

```json
// Request
curl --location -g --request GET \
    'localhost:31310/v1/units?page=1&limit=1&columns=countryJurisdictionOfOwner&columns=inCountryJurisdictionOfOwner&columns=serialNumberBlock&columns=unitIdentifier&columns=unitType&columns=intentedBuyerOrgUid&columns=marketplace' \
    --header 'Content-Type: application/json'

// Response
{
  "page":1,
  "pageCount":2,
  "data":[{
    "countryJurisdictionOfOwner":"Belize",
    "inCountryJurisdictionOfOwner":null,
    "serialNumberBlock":"A345-B567",
    "unitType":"Reduction - technical",
    "marketplace":null
  }]
}
```
-----

### POST Examples

#### Create a new unit using only the required fields

```json
// Request
curl --location -g --request POST 'localhost:31310/v1/units' \
     --header 'Content-Type: application/json' \
     --data-raw '{
       "projectLocationId": "ID_USA",
       "unitOwner": "Chia",
       "countryJurisdictionOfOwner": "Andorra",
       "serialNumberBlock": "QWERTY9800-ASDFGH9850",
       "serialNumberPattern": "[.*\\D]+([0-9]+)+[-][.*\\D]+([0-9]+)$",
       "vintageYear": 1998,
       "unitType": "Removal - technical",
       "unitStatus": "For Sale",
       "unitRegistryLink": "http://climateWarehouse.com/myRegistry",
       "correspondingAdjustmentDeclaration": "Unknown",
       "correspondingAdjustmentStatus": "Not Started"
}'

// Response
{"message":"Unit staged successfully"}
```
-----
    
#### Create a new unit, with pre-existing issuance and labels

This unit will have two labels, one pre-existing (using the "id" and "warehouseProjectId" fields), and one new.
The issuance is pre-existing.

```json

// Request
curl --location -g --request POST 'localhost:31310/v1/units' \
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

// Response
{"message":"Unit staged successfully"}
```
-----

#### Split units in four
[todo: This command isn't working yet. See [CW issue 387](https://github.com/Chia-Network/climate-warehouse/issues/387) for more info.]

```json
// Request
curl --location -g --request POST 'localhost:31310/units/split' \
--header 'Content-Type: application/json' \
--data-raw '{
    "warehouseUnitId": "9a5def49-7af6-428a-9958-a1e88d74bf58",
    "records": [
        {
            "unitCount": 10,
            "unitOwner": "New Owner 1"
        },
        {
            "unitCount": 5,
            "unitOwner": "New Owner 2"
        },
        {
            "unitCount": 22,
            "unitOwner": "New Owner 3"
        },
        {
            "unitCount": 13,
            "unitOwner": "New Owner 4"
        }
    ]
}'

// Response
```
-----

### PUT Examples

#### Update a pre-existing unit using only the required parameters

* Note that `warehouseUnitId` must already exist

```json
// Request
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

// Response
{"message":"Unit update added to staging"}

```
-----

#### Update a pre-existing unit using an xlsx file

* Note that it's possible to construct an xlsx file for this purpose using [this example](#list-all-units-and-save-the-results-to-an-xlsx-file "List all units and save the results to an xlsx file")

```json
// Request
curl --location -g --request PUT 'localhost:31310/v1/units/xlsx' \
--form 'xlsx=@"cw_units.xlsx"'

// Response
{"message":"Updates from xlsx added to staging"}

```
-----

### DELETE Examples

#### Delete a unit

```json
// Request
curl --location -g --request DELETE 'localhost:31310/v1/units' \
     --header 'Content-Type: application/json' \
     --data-raw '{
       "warehouseUnitId": "104b082c-b112-4c39-9249-a52c6c53282b"
}'

// Response
{"message":"Unit deleted successfully"}
```
-----

## `issuances`

Functionality: List all issuances from subscribed projects

Options: None

### GET Examples

#### List all issuances from subscribed projects

```json
// Request
curl --location --request GET 'localhost:31310/v1/issuances' --header 'Content-Type: application/json'

// Response
[{
  "id":"d9f58b08-af25-461c-88eb-403bb02b135e",
  "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
  "warehouseProjectId":"9b9bb857-c71b-4649-b805-a289db27dc1c",
  "startDate":"2022-01-02T00:00:00.000Z",
  "endDate":"2022-02-11T00:00:00.000Z",
  "verificationApproach":"Sample Approach",
  "verificationReportDate":"2022-03-16T00:00:00.000Z",
  "verificationBody":"Sample Body",
  "timeStaged":null,
  "createdAt":"2022-03-12T08:58:43.271Z",
  "updatedAt":"2022-03-12T08:58:43.271Z"
}]
```
-----

## `labels`

Functionality: List all labels from subscribed projects

Options: None

### GET Examples

#### List all labels from subscribed projects

```json
// Request
curl --location --request GET 'localhost:31310/v1/labels' --header 'Content-Type: application/json'

// Response
[{
  "id":"dcacd68e-1cfb-4f06-9798-efa0aacda42c",
  "warehouseProjectId":"9b9bb857-c71b-4649-b805-a289db27dc1c",
  "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
  "label":"Sample Label",
  "labelType":"Certification",
  "creditingPeriodStartDate":"2014-03-29T00:00:00.000Z",
  "creditingPeriodEndDate":"2022-03-30T00:00:00.000Z",
  "validityPeriodStartDate":"2017-03-08T00:00:00.000Z",
  "validityPeriodEndDate":"2025-03-19T00:00:00.000Z",
  "unitQuantity":40,
  "labelLink":"http://samplelabel.net",
  "timeStaged":null,
  "createdAt":"2022-03-12T08:58:43.270Z",
  "updatedAt":"2022-03-12T08:58:43.270Z"
}]
```
-----

## `staging`

Functionality: List, modify, confirm, and cancel projects and units in the `STAGING` state

Options:

| Key                | Type   | Description |
|:------------------:|:------:|:------------|
| None (default)     | N/A    | Display all projects and units that are currently in `STAGING` |
| type               | String | Must be `projects` or `units` |
| limit              | Number | Limit the number of subscribed projects to be displayed (must be used with page, eg `?page=5&limit=2`) |
| page               | Number | Only display results from this page number (must be used with limit, eg `?page=5&limit=2`) |

### GET Examples

#### List all projects and units in `STAGING`

* For this example, there is one project with a `DELETE` action, one project with an `INSERT` action, and one unit with an `INSERT` action:

```json
// Request
curl --location --request GET 'localhost:31310/v1/staging' --header 'Content-Type: application/json'

// Response
[{
  "id":38,
  "uuid":"cbc966cd-f4a9-4f7b-9c57-8186fea8b54c",
  "table":"Projects",
  "action":"DELETE",
  "commited":false,
  "failedCommit":false,
  "createdAt":"2022-03-13T03:08:15.156Z",
  "updatedAt":"2022-03-13T03:08:15.156Z",
  "diff":{
    "original":{
      "warehouseProjectId":"cbc966cd-f4a9-4f7b-9c57-8186fea8b54c",
      "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
      "currentRegistry":"123",
      "projectId":"Abcde-12345",
      "originProjectId":null,
      "registryOfOrigin":"500",
      "program":"",
      "projectName":"Example",
      "projectLink":"https://exampleurl",
      "projectDeveloper":"Example Developer",
      "sector":"Viva",
      "projectType":"",
      "projectTags":null,
      "coveredByNDC":"NO",
      "ndcInformation":"Outside NDC",
      "projectStatus":"Registered",
      "projectStatusDate":"2022-03-09T16:00:00.000Z",
      "unitMetric":"tCO2e",
      "methodology":"Quatz",
      "validationBody":null,
      "validationDate":null,
      "timeStaged":null,
      "createdAt":"2022-03-13T03:04:53.168Z",
      "updatedAt":"2022-03-13T03:04:53.168Z",
      "projectLocations":[],
      "labels":[],
      "issuances":[],
      "coBenefits":[],
      "relatedProjects":[],
      "projectRatings":[],
      "estimations":[]
    },
    "change":{}
  }
},{
  "id":39,
  "uuid":"2120ab85-4622-454c-be29-c97071286df1",
  "table":"Projects",
  "action":"INSERT",
  "commited":false,
  "failedCommit":false,
  "createdAt":"2022-03-13T03:09:10.194Z",
  "updatedAt":"2022-03-13T03:09:10.194Z",
  "diff":{
    "original":{},
    "change":[{
      "currentRegistry":"123",
      "projectId":"Abcde-12345",
      "registryOfOrigin":"500",
      "program":"",
      "projectName":"Example",
      "projectLink":"https://exampleurl",
      "projectDeveloper":"Example Developer",
      "sector":"Viva",
      "projectType":"",
      "coveredByNDC":"NO",
      "ndcInformation":"Outside NDC",
      "projectStatus":"Registered",
      "projectStatusDate":"3/10/2022",
      "unitMetric":"tCO2e",
      "methodology":"Quatz",
      "warehouseProjectId":"2120ab85-4622-454c-be29-c97071286df1",
      "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9"
    }]
  }
},{
  "id":40,
  "uuid":"89d7a102-a5a6-4f80-bc67-d28eba4952f3",
  "table":"Units",
  "action":"INSERT",
  "commited":false,
  "failedCommit":false,
  "createdAt":"2022-03-13T03:17:51.752Z",
  "updatedAt":"2022-03-13T03:17:51.752Z",
  "diff":{
    "original":{},
    "change":[{
      "projectLocationId":"789",
      "unitOwner":"Sample Owner",
      "countryJurisdictionOfOwner":"Belize",
      "serialNumberBlock":"A345-B567",
      "serialNumberPattern":"[.*\\D]+([0-9]+)+[-][.*\\D]+([0-9]+)$",
      "vintageYear":2014,
      "unitRegistryLink":"sampleurl.com",
      "unitType":"Reduction - technical",
      "unitStatus":"Buffer",
      "correspondingAdjustmentDeclaration":"Unknown",
      "correspondingAdjustmentStatus":"Pending",
      "warehouseUnitId":"89d7a102-a5a6-4f80-bc67-d28eba4952f3",
      "timeStaged":1647141471,
      "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9"
    }]
  }
}]
```
-----

#### List all units in `STAGING`, with paging
[todo: This call doesn't work yet. see [CW issue 389](https://github.com/Chia-Network/climate-warehouse/issues/389) for more info.]

```json
// Request
curl --location --request GET 'localhost:31310/v1/staging?page=1&limit=5&type=units' \
     --header 'Content-Type: application/json'

// Response
```
-----

### POST Examples

#### Commit all projects and units in `STAGING`

* Note that it is not possible to commit projects or units individually. 
If you need to commit a single project or unit, 
then stage and commit it before staging anything new.
```json
// Request
curl --location --request POST \
    --header 'Content-Type: application/json' \
     'localhost:31310/v1/staging/commit'

// Response
{"message":"Staging Table committed to full node"}
```
-----

#### Retry committing a single project, using its `uuid`:

```json
// Request
curl --location -g --request POST 'localhost:31310/v1/staging/retry' \
--header 'Content-Type: application/json' \
--data-raw '{
    "uuid": "86c1cd01-0c07-4f02-9a29-490be967ca6c"
}'

// Response
{"message":"Staging record re-staged."}
```
-----

### DELETE Examples

#### Delete all projects and units in `STAGING`:

```json
// Request
curl --location -g --request DELETE 'localhost:31310/v1/staging/clean' \
     --header 'Content-Type: application/json'
// Response
{"message":"Staging Data Cleaned"}
```
-----

#### Delete a specific project in `STAGING`:

```json
// Request
curl --location -g --request DELETE 'localhost:31310/v1/staging' \
--header 'Content-Type: application/json' \
--data-raw '{
    "uuid": "1647855c-c1fa-4f5b-ae8e-bd9d544442ea"
}'
// Response
{"message":"Deleted from stage"}
```
-----

#### Delete a specific unit in `STAGING`:

```json
// Request
curl --location -g --request DELETE 'localhost:31310/v1/staging' \
--header 'Content-Type: application/json' \
--data-raw '{
    "uuid": "1936260d-632c-4d63-8cba-0014e7c84c0c"
}'
// Response
{"message":"Deleted from stage"}
```
-----

## `audit`

Functionality: Show the complete history of an organization

Options:

| Key                | Type   | Description |
|:------------------:|:------:|:------------|
| orgUid             | String | (Required) Display subscribed projects matching this orgUid |

### GET Examples

#### Show the complete history of an organization

```json
// Request
curl --location --request GET 'localhost:31310/v1/audit?orgUid=77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9' --header 'Content-Type: application/json'

// Response
[{
  "id":2,
  "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
  "registryId":"9508ff7a1851ead7702b28f37f36145a0b389e374e2b82504b6ceb977ea41ada",
  "rootHash":"0x0000000000000000000000000000000000000000000000000000000000000000",
  "type":"CREATE REGISTRY",
  "change":null,
  "table":null,
  "onchainConfirmationTimeStamp":0,
  "createdAt":"2022-03-09T05:22:53.217Z",
  "updatedAt":"2022-03-09T05:22:53.217Z"
},{
  "id":3,
  "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
  "registryId":"9508ff7a1851ead7702b28f37f36145a0b389e374e2b82504b6ceb977ea41ada",
  "rootHash":"0x4e25dd858553085c246546085f7d79140c2f78db8fc3ff8e34e73c849f3844df",
  "type":"INSERT",
  "change":"{
    \"currentRegistry\":\"Gold Standard\",
    \"registryOfOrigin\":\"Gold Standard\",
    \"originProjectId\":\"555\",
    \"projectId\":\"555\",
    \"projectName\":\"Stop Deforestation\",
    \"projectLink\":\"http://testurl.com\",
    \"projectDeveloper\":\"Example Developer\",
    \"sector\":\"Agriculture Forestry and Other Land Use (AFOLU)\",
    \"projectType\":\"Soil Enrichment\",
    \"coveredByNDC\":\"Unknown\",
    \"projectStatus\":\"Listed\",
    \"unitMetric\":\"tCO2e\",
    \"methodology\":\"Decomposition of fluoroform (HFC-23) waste streams --- Version 6.0.0\",
    \"projectStatusDate\":\"2022-03-02T00:00:00.000Z\",
    \"warehouseProjectId\":\"51ca9638-22b0-4e14-ae7a-c09d23b37b58\",
    \"timeStaged\":1646803417,
    \"orgUid\":\"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9\"
  }",
  "table":"project",
  "onchainConfirmationTimeStamp":1646803574,
  "createdAt":"2022-03-09T05:27:23.266Z",
  "updatedAt":"2022-03-09T05:27:23.266Z"
},{"id":4,
  ...
  abbreviated (output continues in order of ID)
  ...
}
```
-----