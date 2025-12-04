# [DRAFT] CADT RPC API V2 Guide



This page lists commands and examples from the Climate Warehouse RPC API V2.

When using this guide, it is important to understand the workflow CADT employs for managing climate data updates via RPCs.
The CADT paradigm ensures that all updates first go into local "staging", which is private and not shared with
the rest of the world. This staging process serves as an intermediate step where climate data records changes remain
isolated from the data committed to the blockchain datalayer until explicitly committed.

When editing or adding climate data records users should first use POST changes to the appropriate data model
resources (e.g., `project`, `unit`, `methodology`, etc.). These POST requests populate the local staging table, allowing
for updates to be collected and reviewed in a controlled, private environment. Once reviewed users can then use `staging`
RPCs to commit or delete the staged record changes. Committing the data in staging using the CADT RPC's commits the data
to the blockchain, making it publicly visible.

It is essential to remember that the staging process is distinct from the commit phase. The initial use of data model
RPCs prepares the data, while `staging` RPCs finalize the transition to the blockchain. This workflow ensures a clear
separation between temporary updates and permanent, public changes, maintaining both data integrity and transparency.

**V2 Features:**
- V2 operations are isolated from V1 - V2 data does not affect V1 data and vice versa
- V1 and V2 can run simultaneously
- V2 supports upgrading existing V1 organizations to V2. This will not migrate the data, but simply create a new store for V2 alongside the existing V1 store.

Please also see the following related documents:

- [CADT installation/configuration guide](/README.md)
- [CADT RPC API V1 Guide](/docs/cadt_rpc_api.md)
- [Chia Data Layer CLI](https://docs.chia.net/datalayer-cli) reference
- [Chia Data Layer RPC API](https://docs.chia.net/datalayer-rpc) reference

The CADT RPC API V2 is exposed by default on port 31310. This document will give examples to access the RPC API using `http://localhost:31310/v2`.

If using a `CADT_API_KEY` append `--header 'x-api-key: <your-api-key-here>'` to your `curl` request.

## Commands

- [`organizations`](#organizations)
  - [GET Examples](#organizations-get-examples)
    - [List all organizations](#list-all-organizations)
    - [Get organization status](#get-organization-status)
    - [Get organization metadata](#get-organization-metadata)
  - [POST Examples](#organizations-post-examples)
    - [Create a V2 organization](#create-a-v2-organization)
    - [Upgrade V1 organization to V2](#upgrade-v1-organization-to-v2)
    - [Add organization metadata](#add-organization-metadata)
    - [Sync organization metadata](#sync-organization-metadata)
    - [Add mirror for a store](#add-mirror-for-a-store)
    - [Remove mirror for a store](#remove-mirror-for-a-store)
  - [PUT Examples](#organizations-put-examples)
    - [Edit home organization](#edit-home-organization)
    - [Import organization from datalayer](#import-organization-from-datalayer)
    - [Subscribe to organization](#subscribe-to-organization)
    - [Unsubscribe from organization](#unsubscribe-from-organization)
    - [Resync organization](#resync-organization)
  - [DELETE Examples](#organizations-delete-examples)
    - [Delete organization](#delete-organization)
  - [Additional organizations resources](#additional-organizations-resources)
- [`staging`](#staging)
  - [GET Examples](#staging-get-examples)
    - [List all staged records](#list-all-staged-records)
    - [Check for pending commits](#check-for-pending-commits)
  - [POST Examples](#staging-post-examples)
    - [Commit staged records](#commit-staged-records)
    - [Retry failed commit](#retry-failed-commit)
  - [PUT Examples](#staging-put-examples)
    - [Edit staged record](#edit-staged-record)
  - [DELETE Examples](#staging-delete-examples)
    - [Delete staged record](#delete-staged-record)
    - [Clean all staged records](#clean-all-staged-records)
  - [Additional staging resources](#additional-staging-resources)
- [`governance`](#governance)
  - [GET Examples](#governance-get-examples)
    - [Get all governance data](#get-all-governance-data)
    - [Check if governance body exists](#check-if-governance-body-exists)
    - [Sync governance data](#sync-governance-data)
    - [Get picklist data](#get-picklist-data)
    - [Get the UID's of all organizations registered in governance data](#get-the-uids-of-all-organizations-registered-in-governance-data)
    - [Get glossary data](#get-glossary-data)
  - [POST Examples](#governance-post-examples)
    - [Create governance body](#create-governance-body)
    - [Set organization list](#set-organization-list)
    - [Set picklist data](#set-picklist-data)
    - [Set glossary data](#set-glossary-data)
    - [Subscribe to governance body](#subscribe-to-governance-body)
  - [Additional Governance Resources](#additional-governance-resources)
- [`methodology`](#methodology)
  - [GET Examples](#methodology-get-examples)
    - [List all methodologies](#list-all-methodologies)
    - [Get single methodology](#get-single-methodology)
  - [POST Examples](#methodology-post-examples)
    - [Create methodology](#create-methodology)
  - [PUT Examples](#methodology-put-examples)
    - [Update methodology](#update-methodology)
  - [DELETE Examples](#methodology-delete-examples)
    - [Delete methodology](#delete-methodology)
- [`program`](#program)
  - [GET Examples](#program-get-examples)
    - [List all programs](#list-all-programs)
    - [Get single program](#get-single-program)
  - [POST Examples](#program-post-examples)
    - [Create program](#create-program)
  - [PUT Examples](#program-put-examples)
    - [Update program](#update-program)
  - [DELETE Examples](#program-delete-examples)
    - [Delete program](#delete-program)
- [`project`](#project)
  - [GET Examples](#project-get-examples)
    - [List all projects](#list-all-projects)
    - [Get single project](#get-single-project)
    - [List projects with advanced query features](#list-projects-with-advanced-query-features)
    - [Export projects to Excel](#export-projects-to-excel)
  - [POST Examples](#project-post-examples)
    - [Create project](#create-project)
    - [Batch upload projects from CSV](#batch-upload-projects-from-csv)
  - [PUT Examples](#project-put-examples)
    - [Update project](#update-project)
    - [Transfer project between organizations](#transfer-project-between-organizations)
    - [Update projects from XLSX file](#update-projects-from-xlsx-file)
  - [DELETE Examples](#project-delete-examples)
    - [Delete project](#delete-project)
  - [Additional projects resources](#additional-projects-resources)
- [`validation`](#validation)
  - [GET Examples](#validation-get-examples)
    - [List all validations](#list-all-validations)
    - [Get single validation](#get-single-validation)
  - [POST Examples](#validation-post-examples)
    - [Create validation](#create-validation)
  - [PUT Examples](#validation-put-examples)
    - [Update validation](#update-validation)
  - [DELETE Examples](#validation-delete-examples)
    - [Delete validation](#delete-validation)
- [`verification`](#verification)
  - [GET Examples](#verification-get-examples)
    - [List all verifications](#list-all-verifications)
    - [Get single verification](#get-single-verification)
  - [POST Examples](#verification-post-examples)
    - [Create verification](#create-verification)
  - [PUT Examples](#verification-put-examples)
    - [Update verification](#update-verification)
  - [DELETE Examples](#verification-delete-examples)
    - [Delete verification](#delete-verification)
- [`issuance`](#issuance)
  - [GET Examples](#issuance-get-examples)
    - [List all issuances](#list-all-issuances)
    - [Get single issuance](#get-single-issuance)
  - [POST Examples](#issuance-post-examples)
    - [Create issuance](#create-issuance)
  - [PUT Examples](#issuance-put-examples)
    - [Update issuance](#update-issuance)
  - [DELETE Examples](#issuance-delete-examples)
    - [Delete issuance](#delete-issuance)
- [`unit`](#unit)
  - [GET Examples](#unit-get-examples)
    - [List all units](#list-all-units)
    - [Get single unit](#get-single-unit)
    - [List units with advanced query features](#list-units-with-advanced-query-features)
    - [Export units to Excel](#export-units-to-excel)
  - [POST Examples](#unit-post-examples)
    - [Create unit](#create-unit)
    - [Split unit into multiple units](#split-unit-into-multiple-units)
    - [Batch upload units from CSV](#batch-upload-units-from-csv)
  - [PUT Examples](#unit-put-examples)
    - [Update unit](#update-unit)
    - [Update units from XLSX file](#update-units-from-xlsx-file)
  - [DELETE Examples](#unit-delete-examples)
    - [Delete unit](#delete-unit)
  - [Additional Units Resources](#additional-units-resources)
- [`location`](#location)
  - [GET Examples](#location-get-examples)
    - [List all locations](#list-all-locations)
    - [Get single location](#get-single-location)
  - [POST Examples](#location-post-examples)
    - [Create location](#create-location)
  - [PUT Examples](#location-put-examples)
    - [Update location](#update-location)
  - [DELETE Examples](#location-delete-examples)
    - [Delete location](#delete-location)
- [`estimation`](#estimation)
  - [GET Examples](#estimation-get-examples)
    - [List all estimations](#list-all-estimations)
    - [Get single estimation](#get-single-estimation)
  - [POST Examples](#estimation-post-examples)
    - [Create estimation](#create-estimation)
  - [PUT Examples](#estimation-put-examples)
    - [Update estimation](#update-estimation)
  - [DELETE Examples](#estimation-delete-examples)
    - [Delete estimation](#delete-estimation)
- [`rating`](#rating)
  - [GET Examples](#rating-get-examples)
    - [List all ratings](#list-all-ratings)
    - [Get single rating](#get-single-rating)
  - [POST Examples](#rating-post-examples)
    - [Create rating](#create-rating)
  - [PUT Examples](#rating-put-examples)
    - [Update rating](#update-rating)
  - [DELETE Examples](#rating-delete-examples)
    - [Delete rating](#delete-rating)
- [`co-benefit`](#co-benefit)
  - [GET Examples](#co-benefit-get-examples)
    - [List all co-benefits](#list-all-co-benefits)
    - [Get single co-benefit](#get-single-co-benefit)
  - [POST Examples](#co-benefit-post-examples)
    - [Create co-benefit](#create-co-benefit)
  - [PUT Examples](#co-benefit-put-examples)
    - [Update co-benefit](#update-co-benefit)
  - [DELETE Examples](#co-benefit-delete-examples)
    - [Delete co-benefit](#delete-co-benefit)
- [`project-methodology`](#project-methodology)
  - [GET Examples](#project-methodology-get-examples)
    - [List all project-methodology relationships](#list-all-project-methodology-relationships)
    - [Get single project-methodology relationship](#get-single-project-methodology-relationship)
  - [POST Examples](#project-methodology-post-examples)
    - [Create project-methodology relationship](#create-project-methodology-relationship)
  - [PUT Examples](#project-methodology-put-examples)
    - [Update project-methodology relationship](#update-project-methodology-relationship)
  - [DELETE Examples](#project-methodology-delete-examples)
    - [Delete project-methodology relationship](#delete-project-methodology-relationship)
- [`stakeholder`](#stakeholder)
  - [GET Examples](#stakeholder-get-examples)
    - [List all stakeholders](#list-all-stakeholders)
    - [Get single stakeholder](#get-single-stakeholder)
  - [POST Examples](#stakeholder-post-examples)
    - [Create stakeholder](#create-stakeholder)
  - [PUT Examples](#stakeholder-put-examples)
    - [Update stakeholder](#update-stakeholder)
  - [DELETE Examples](#stakeholder-delete-examples)
    - [Delete stakeholder](#delete-stakeholder)
- [`stakeholder-projects`](#stakeholder-projects)
  - [GET Examples](#stakeholder-projects-get-examples)
    - [List all stakeholder-project relationships](#list-all-stakeholder-project-relationships)
    - [Get single stakeholder-project relationship](#get-single-stakeholder-project-relationship)
  - [POST Examples](#stakeholder-projects-post-examples)
    - [Create stakeholder-project relationship](#create-stakeholder-project-relationship)
  - [PUT Examples](#stakeholder-projects-put-examples)
    - [Update stakeholder-project relationship](#update-stakeholder-project-relationship)
  - [DELETE Examples](#stakeholder-projects-delete-examples)
    - [Delete stakeholder-project relationship](#delete-stakeholder-project-relationship)
- [`label`](#label)
  - [GET Examples](#label-get-examples)
    - [List all labels](#list-all-labels)
    - [Get single label](#get-single-label)
  - [POST Examples](#label-post-examples)
    - [Create label](#create-label)
  - [PUT Examples](#label-put-examples)
    - [Update label](#update-label)
  - [DELETE Examples](#label-delete-examples)
    - [Delete label](#delete-label)
- [`unit-label`](#unit-label)
  - [GET Examples](#unit-label-get-examples)
    - [List all unit-label relationships](#list-all-unit-label-relationships)
    - [Get single unit-label relationship](#get-single-unit-label-relationship)
  - [POST Examples](#unit-label-post-examples)
    - [Create unit-label relationship](#create-unit-label-relationship)
  - [PUT Examples](#unit-label-put-examples)
    - [Update unit-label relationship](#update-unit-label-relationship)
  - [DELETE Examples](#unit-label-delete-examples)
    - [Delete unit-label relationship](#delete-unit-label-relationship)
- [`aef-t1-submission`](#aef-t1-submission)
  - [GET Examples](#aef-t1-submission-get-examples)
    - [List all AEF-T1-Submissions](#list-all-aef-t1-submissions)
    - [Get single AEF-T1-Submission](#get-single-aef-t1-submission)
  - [POST Examples](#aef-t1-submission-post-examples)
    - [Create AEF-T1-Submission](#create-aef-t1-submission)
  - [PUT Examples](#aef-t1-submission-put-examples)
    - [Update AEF-T1-Submission](#update-aef-t1-submission)
  - [DELETE Examples](#aef-t1-submission-delete-examples)
    - [Delete AEF-T1-Submission](#delete-aef-t1-submission)
- [`aef-t5-authorized-entities`](#aef-t5-authorized-entities)
  - [GET Examples](#aef-t5-authorized-entities-get-examples)
    - [List all AEF-T5-Authorized-Entities](#list-all-aef-t5-authorized-entities)
    - [Get single AEF-T5-Authorized-Entities](#get-single-aef-t5-authorized-entities)
  - [POST Examples](#aef-t5-authorized-entities-post-examples)
    - [Create AEF-T5-Authorized-Entities](#create-aef-t5-authorized-entities)
  - [PUT Examples](#aef-t5-authorized-entities-put-examples)
    - [Update AEF-T5-Authorized-Entities](#update-aef-t5-authorized-entities)
  - [DELETE Examples](#aef-t5-authorized-entities-delete-examples)
    - [Delete AEF-T5-Authorized-Entities](#delete-aef-t5-authorized-entities)
- [`aef-t2-authorizations`](#aef-t2-authorizations)
  - [GET Examples](#aef-t2-authorizations-get-examples)
    - [List all AEF-T2-Authorizations](#list-all-aef-t2-authorizations)
    - [Get single AEF-T2-Authorizations](#get-single-aef-t2-authorizations)
  - [POST Examples](#aef-t2-authorizations-post-examples)
    - [Create AEF-T2-Authorizations](#create-aef-t2-authorizations)
  - [PUT Examples](#aef-t2-authorizations-put-examples)
    - [Update AEF-T2-Authorizations](#update-aef-t2-authorizations)
  - [DELETE Examples](#aef-t2-authorizations-delete-examples)
    - [Delete AEF-T2-Authorizations](#delete-aef-t2-authorizations)
- [`aef-t3-actions`](#aef-t3-actions)
  - [GET Examples](#aef-t3-actions-get-examples)
    - [List all AEF-T3-Actions](#list-all-aef-t3-actions)
    - [Get single AEF-T3-Actions](#get-single-aef-t3-actions)
  - [POST Examples](#aef-t3-actions-post-examples)
    - [Create AEF-T3-Actions](#create-aef-t3-actions)
  - [PUT Examples](#aef-t3-actions-put-examples)
    - [Update AEF-T3-Actions](#update-aef-t3-actions)
  - [DELETE Examples](#aef-t3-actions-delete-examples)
    - [Delete AEF-T3-Actions](#delete-aef-t3-actions)
- [`aef-t4-holdings`](#aef-t4-holdings)
  - [GET Examples](#aef-t4-holdings-get-examples)
    - [List all AEF-T4-Holdings](#list-all-aef-t4-holdings)
    - [Get single AEF-T4-Holdings](#get-single-aef-t4-holdings)
  - [POST Examples](#aef-t4-holdings-post-examples)
    - [Create AEF-T4-Holdings](#create-aef-t4-holdings)
  - [PUT Examples](#aef-t4-holdings-put-examples)
    - [Update AEF-T4-Holdings](#update-aef-t4-holdings)
  - [DELETE Examples](#aef-t4-holdings-delete-examples)
    - [Delete AEF-T4-Holdings](#delete-aef-t4-holdings)
- [`audit`](#audit)
  - [GET Examples](#audit-get-examples)
    - [Show the complete history of an organization](#show-the-complete-history-of-an-organization)
    - [Find conflicts in organization data](#find-conflicts-in-organization-data)
  - [POST Examples](#audit-post-examples)
    - [Reset organization to specific generation](#reset-organization-to-specific-generation)
    - [Reset organization to specific date](#reset-organization-to-specific-date)
- [`offer`](#offer)
  - [GET Examples](#offer-get-examples)
    - [Generate and download a datalayer offer file](#generate-and-download-a-datalayer-offer-file)
    - [Get the details of the currently uploaded offer file](#get-the-details-of-the-currently-uploaded-offer-file)
  - [POST Examples](#offer-post-examples)
    - [Upload an offer file](#upload-an-offer-file)
    - [Commit imported offer](#commit-imported-offer)
  - [DELETE Examples](#offer-delete-examples)
    - [Cancel the currently active offer](#cancel-the-currently-active-offer)
    - [Reject the currently imported transfer offer file](#reject-the-currently-imported-transfer-offer-file)
  - [Additional offer resources](#additional-offer-resources)
- [`filestore`](#filestore)
  - [GET Examples](#filestore-get-examples)
    - [Get file from filestore](#get-file-from-filestore)
    - [Get file list from filestore](#get-file-list-from-filestore)
  - [POST Examples](#filestore-post-examples)
    - [Add file to filestore](#add-file-to-filestore)
    - [Subscribe to filestore](#subscribe-to-filestore)
    - [Unsubscribe from filestore](#unsubscribe-from-filestore)
  - [DELETE Examples](#filestore-delete-examples)
    - [Delete file from filestore](#delete-file-from-filestore)
- [`health`](#health)
  - [GET Examples](#health-get-examples)
    - [Health check](#health-check)
---

## Reference

## `organizations`

Functionality: Use GET, POST, PUT, and DELETE to list, create, update, and manage V2 organizations

GET Options:

|  Key   |  Type   |                         Description                          |
|:------:|:--------:|:------------------------------------------------------------:|
| None (default) | N/A | List all organizations |
| orgUid | String | (Optional) Get metadata for specific organization |

<a id="organizations-get-examples"></a>
### GET Examples

#### List all organizations

Request
```sh
curl --location --request GET 'localhost:31310/v2/organizations' --header 'Content-Type: application/json'
```

Response
```json
{
  "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9":{
    "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
    "orgHash": "0x14d8ea0f809c73c649827837cada5ec4d931153839383008a28c59fd1de86d2e",
    "name":"Org Test",
    "icon":"https://www.chia.net/wp-content/uploads/2023/01/chia-logo-dark.svg",
    "isHome":true,
    "subscribed":true,
    "synced": true,
    "fileStoreSubscribed": "0",
    "registryId": "xfy7oofvb31bg07stafbqxcug7mmmjzxg0gi8r1nwkv63u3pxwy85s5xpgs204bk",
    "registryHash": "0x34c4671f721ff0132b4eb80a8e0d46ffb446ec8f03ed87368adcd29415cdbac4",
    "sync_remaining": 0
  }
}
```

---

#### Get organization status

Request
```sh
curl --location --request GET 'localhost:31310/v2/organizations/status?orgUid=77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9' --header 'Content-Type: application/json'
```

Response
```json
{
  "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
  "synced": true,
  "sync_remaining": 0
}
```

---

#### Get organization metadata

Request
```sh
curl --location --request GET 'localhost:31310/v2/organizations/metadata?orgUid=77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9' --header 'Content-Type: application/json'
```

Response
```json
{
  "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
  "metadata": {
    "key1": "value1",
    "key2": "value2"
  }
}
```

---

POST Options:

|  Key   |   Type   |                         Description                          |
|:------:|:--------:|:------------------------------------------------------------:|
|  name  |  String  |      (Required) Name of the organization to be created       |
|  icon  |  String  | (Required) URL of the icon to be used for this organization  |

<a id="organizations-post-examples"></a>
### POST Examples

#### Create a V2 organization

- Please note that creating an organization takes approximately 30 minutes.
- The request will resolve and the organization will complete in the background.
- The status of the organization creation can be tracked via a GET request to `organizations` and searching for the PENDING orgUid.
- V2 organizations can be created with either a JSON body or by uploading a file containing organization data.

**Using JSON body:**

Request
```sh
curl --location -g --request POST 'localhost:31310/v2/organizations' \
     --header 'Content-Type: application/json' \
     --data-raw '{
        "name": "Sample Org",
        "icon": "https://www.chia.net/wp-content/uploads/2023/01/chia-logo-dark.svg"
}'
```

**Using file upload:**

Request
```sh
curl --location -g --request POST 'localhost:31310/v2/organizations' \
     --form 'file=@"./organization.json"'
```

Response
```json
{
    "message": "New organization is currently being created. It can take up to 30 mins. Please do not interrupt this process.",
    "success": true
}
```

---

#### Upgrade V1 organization to V2

- This endpoint allows existing V1 organizations to be upgraded to V2.
- The upgrade process migrates V1 organization data to V2 format while maintaining V1/V2 isolation.

Request
```sh
curl --location -g --request POST 'localhost:31310/v2/organizations/upgrade' \
     --header 'Content-Type: application/json' \
     --data-raw '{
        "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9"
}'
```

Response
```json
{
    "message": "Organization upgrade initiated successfully",
    "success": true
}
```

---

#### Add organization metadata

Request
```sh
curl --location -g --request POST 'localhost:31310/v2/organizations/metadata' \
     --header 'Content-Type: application/json' \
     --data-raw '{
        "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
        "metadata": {
            "key1": "value1",
            "key2": "value2"
        }
}'
```

Response
```json
{
    "message": "Metadata added successfully",
    "success": true
}
```

---

#### Sync organization metadata

Request
```sh
curl --location -g --request POST 'localhost:31310/v2/organizations/sync' \
     --header 'Content-Type: application/json'
```

Response
```json
{
    "message": "Organization sync initiated",
    "success": true
}
```

---

#### Add mirror for a store

Request
```sh
curl --location -g --request POST 'localhost:31310/v2/organizations/mirror' \
     --header 'Content-Type: application/json' \
     --data-raw '{
        "storeId": "xfy7oofvb31bg07stafbqxcug7mmmjzxg0gi8r1nwkv63u3pxwy85s5xpgs204bk",
        "coinId": "0x1234567890abcdef"
}'
```

Response
```json
{
    "message": "Mirror added successfully",
    "success": true
}
```

---

#### Remove mirror for a store

Request
```sh
curl --location -g --request POST 'localhost:31310/v2/organizations/remove-mirror' \
     --header 'Content-Type: application/json' \
     --data-raw '{
        "storeId": "xfy7oofvb31bg07stafbqxcug7mmmjzxg0gi8r1nwkv63u3pxwy85s5xpgs204bk",
        "coinId": "0x1234567890abcdef"
}'
```

Response
```json
{
    "message": "Mirror removed successfully",
    "success": true
}
```

---

PUT Options:

|  Key   |  Type   |                                      Description                                      |
|:------:|:-------:|:-------------------------------------------------------------------------------------:|
| orgUid | String  |                 (Required) OrgUid of the organization to import                  |
| isHome | Boolean |  (Optional) Specify true if the specified orgUid should be imported as the home org   |

<a id="organizations-put-examples"></a>
### PUT Examples

#### Edit home organization

- V2 organizations can be edited with either a JSON body or by uploading a file containing organization data.

**Using JSON body:**

Request
```sh
curl --location -g --request PUT 'http://localhost:31310/v2/organizations/edit' \
--header 'Content-Type: application/json' \
--data-raw '{
  "name": "Updated Org Name",
  "icon": "https://www.chia.net/wp-content/uploads/2023/01/chia-logo-light.svg"
}'
```

**Using file upload:**

Request
```sh
curl --location -g --request PUT 'http://localhost:31310/v2/organizations/edit' \
--form 'file=@"./organization-update.json"'
```

Response
```json
{
  "success": true,
  "message": "Organization updated successfully"
}
```

---

#### Import organization from datalayer

Request
```sh
curl --location -g --request PUT 'http://localhost:31310/v2/organizations/' \
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

---

#### Subscribe to organization

Request
```sh
curl --location -g --request PUT 'http://localhost:31310/v2/organizations/subscribe' \
--header 'Content-Type: application/json' \
--data-raw '{
  "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9"
}'
```

Response
```json
{
  "success": true,
  "message": "Successfully subscribed to organization"
}
```

---

#### Unsubscribe from organization

Request
```sh
curl --location -g --request PUT 'http://localhost:31310/v2/organizations/unsubscribe' \
--header 'Content-Type: application/json' \
--data-raw '{
  "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9"
}'
```

Response
```json
{
  "success": true,
  "message": "Successfully unsubscribed from organization"
}
```

---

#### Resync organization

Request
```sh
curl --location -g --request PUT 'http://localhost:31310/v2/organizations/resync' \
--header 'Content-Type: application/json' \
--data-raw '{
  "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9"
}'
```

Response
```json
{
  "success": true,
  "message": "Organization resync initiated"
}
```

---

DELETE Options: None

<a id="organizations-delete-examples"></a>
### DELETE Examples

#### Delete organization

Request
```sh
curl --location --request DELETE \
'http://localhost:31310/v2/organizations/c9661d1ce77194c9e82311418aa4d370e25e10961d74d586636354746bc9ad65'
```

Response
```json
{
  "message": "Removed all organization records for organization ${orgUid} and unsubscribed from organization datalayer stores. cadt will not sync the organizations data from datalayer",
  "success": true
}
```

### Additional Organizations Resources

- All organization endpoints support V2-specific operations
- V2 organizations maintain isolation from V1 organizations
- V2 organizations use snake_case for database fields and camelCase for API fields

---

## `staging`

Functionality: List, modify, commit, and delete records in the staging table

Query string options:

|        Key         |  Type   | Description                                                                                                                     |
|:------------------:|:-------:|:--------------------------------------------------------------------------------------------------------------------------------|
|   None (default)   |   N/A   | Display all staged records                                                                                                 |
|       type         | String  | Filter by type: `staged` (uncommitted), `pending` (committed but not confirmed), or `failed` (failed commits)                                                               |
|       table        | String  | Filter by table name (e.g., `project`, `unit`, `methodology`)                                                                           |
|       limit        | Number  | (Conditionally Required) Limit the number of records to be displayed (must be used with page, eg `?page=5&limit=2`) |
|        page        | Number  | (Conditionally Required) Only display results from this page number (must be used with limit, eg `?page=5&limit=2`)             |

POST body options (for commit):

|        Key         |  Type   | Description                                                                                                                     |
|:------------------:|:-------:|:--------------------------------------------------------------------------------------------------------------------------------|
|       ids          | Array   | (Optional) Array of UUIDs to commit. If not provided, all staged records will be committed                                                                                                 |
|       author       | String  | (Optional) Author name for the commit                                                                           |
|       comment      | String  | (Optional) Comment for the commit                                                                           |

<a id="staging-get-examples"></a>
### GET Examples

#### List all staged records

Request
```shell
curl --location --request GET 'localhost:31310/v2/staging?page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 5,
  "data": [
    {
      "id": 1,
      "uuid": "9b9bb857-c71b-4649-b805-a289db27dc1c",
      "table": "methodology",
      "action": "INSERT",
      "committed": false,
      "failed_commit": false,
      "created_at": "2022-03-11T05:17:55.427Z",
      "updated_at": "2022-03-11T05:17:55.427Z",
      "diff": {
        "original": {},
        "change": {
          "methodologyCode": "ACR-001",
          "methodologyName": "Truck Stop Electrification",
          "methodologyType": "Reduction - technical"
        }
      }
    }
  ]
}
```

---

#### Check for pending commits

Request
```shell
curl --location --request GET 'localhost:31310/v2/staging/pending' --header 'Content-Type: application/json'
```

Response
```json
{
  "confirmed": false,
  "message": "There are currently pending commits",
  "success": true
}
```

---

<a id="staging-post-examples"></a>
### POST Examples

#### Commit staged records

Request
```shell
curl --location --request POST 'localhost:31310/v2/staging/commit' \
--header 'Content-Type: application/json' \
--data-raw '{
  "author": "John Doe",
  "comment": "Committing methodology updates"
}'
```

Response
```json
{
  "message": "Staging Table committing to full node",
  "success": true
}
```

---

#### Retry failed commit

Request
```shell
curl --location --request POST 'localhost:31310/v2/staging/retry' \
--header 'Content-Type: application/json' \
--data-raw '{
  "uuid": "9b9bb857-c71b-4649-b805-a289db27dc1c"
}'
```

Response
```json
{
  "message": "Staging record re-staged",
  "success": true
}
```

---

<a id="staging-put-examples"></a>
### PUT Examples

#### Edit staged record

Request
```shell
curl --location --request PUT 'localhost:31310/v2/staging' \
--header 'Content-Type: application/json' \
--data-raw '{
  "uuid": "9b9bb857-c71b-4649-b805-a289db27dc1c",
  "data": {
    "methodologyCode": "ACR-001",
    "methodologyName": "Truck Stop Electrification - Updated",
    "methodologyType": "Reduction - technical"
  }
}'
```

Response
```json
{
  "message": "Staging record updated",
  "success": true
}
```

---

<a id="staging-delete-examples"></a>
### DELETE Examples

#### Delete staged record

Request
```shell
curl --location --request DELETE 'localhost:31310/v2/staging' \
--header 'Content-Type: application/json' \
--data-raw '{
  "uuid": "9b9bb857-c71b-4649-b805-a289db27dc1c"
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

#### Clean all staged records

Request
```shell
curl --location --request DELETE 'localhost:31310/v2/staging/clean' \
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

### Additional Staging Resources

- GET `/v2/staging` - List all staged records with pagination and filtering
- GET `/v2/staging/pending` - Check if there are pending commits
- POST `/v2/staging/commit` - Commit staged records to the datalayer
- POST `/v2/staging/retry` - Retry committing a failed staging record
- PUT `/v2/staging` - Update a staged record
- DELETE `/v2/staging` - Delete a specific staged record
- DELETE `/v2/staging/clean` - Delete all staged records

---

## `governance`

Functionality for most users: read and sync governance values
Functionality for climate project development: create and manage governance data

Most users will never use these endpoints.

<a id="governance-get-examples"></a>
### GET Examples

#### Get all governance data

Request
```shell
curl --location --request GET 'localhost:31310/v2/governance' --header 'Content-Type: application/json'
```

Response
```json
{
  "id": 1,
  "pickList": "...",
  "orgList": "...",
  "glossary": "...",
  "createdAt": "2022-03-13T03:08:15.156Z",
  "updatedAt": "2022-03-13T03:08:15.156Z"
}
```

---

#### Check if governance body exists

Request
```shell
curl --location --request GET 'localhost:31310/v2/governance/exists' --header 'Content-Type: application/json'
```

Response
```json
{
  "exists": true
}
```

---

#### Sync governance data

Request
```shell
curl --location --request GET 'localhost:31310/v2/governance/sync' --header 'Content-Type: application/json'
```

Response
```json
{
  "message": "Governance data synced successfully",
  "success": true
}
```

---

#### Get picklist data

Request
```shell
curl --location --request GET 'localhost:31310/v2/governance/meta/pickList' --header 'Content-Type: application/json'
```

Response
```json
{
  "registries": [
    "American Carbon Registry (ACR)",
    "Article 6.4 Mechanism Registry",
    "Biocarbon Registry S.A.S",
    "Carbon Assets Trading System (CATS)",
    "Switzerland National Registry",
    "UNFCCC",
    "Verra"
  ],
  "projectSector": [
    "Accommodation and food service activities",
    "Activities of extraterritorial organizations and bodies",
    "Not elsewhere classified"
  ],
  "projectType": [
    "Afforestation",
    "Avoided Conversion",
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
    "VCS - VM0043"
  ],
  "validationBody": [
    "350 Solutions",
    "4K Earth Science Private Limited",
    "VKU Certification Private Limited"
  ],
  "countries": [
    "Afghanistan",
    "Albania",
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
    "SDG 16 - Peace and justice strong institutions",
    "SDG 17 - Partnerships for the goals"
  ]
}
```

---

#### Get the UID's of all organizations registered in governance data

Request
```shell
curl --location --request GET 'localhost:31310/v2/governance/meta/orgList' --header 'Content-Type: application/json'
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
  }
]
```

---

#### Get glossary data

Request
```shell
curl --location --request GET 'localhost:31310/v2/governance/meta/glossary' --header 'Content-Type: application/json'
```

Response
```json
{
  "term1": "Definition 1",
  "term2": "Definition 2"
}
```

---

<a id="governance-post-examples"></a>
### POST Examples

#### Create governance body

Request
```shell
curl --location --request POST 'localhost:31310/v2/governance' \
--header 'Content-Type: application/json' \
--data-raw '{
  "name": "Sample Governance Body"
}'
```

Response
```json
{
  "message": "Governance body created successfully",
  "success": true
}
```

---

#### Set the governance organization list

Request
```shell
curl --location --request POST 'localhost:31310/v2/governance/meta/orgList' --header 'Content-Type: application/json' \
--data-raw '[
  {
    "orgUid": "a9d374baa8ced8b7a4add2a23f35f430fd7a3c99d1480d762e0b40572db4b024"
  },
  {
    "orgUid": "fa47700cb693529602c3eab47a5d681ffe0145dabeee6c69cabdd7869537b917"
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

---

#### Set picklist data

Request
```shell
curl --location --request POST 'localhost:31310/v2/governance/meta/pickList' \
--header 'Content-Type: application/json' \
--data-raw '{
  "registries": ["ACR", "Verra"],
  "projectSector": ["Agriculture", "Energy"]
}'
```

Response
```json
{
  "message": "Picklist data updated successfully",
  "success": true
}
```

---

#### Set glossary data

Request
```shell
curl --location --request POST 'localhost:31310/v2/governance/meta/glossary' \
--header 'Content-Type: application/json' \
--data-raw '{
  "term1": "Definition 1",
  "term2": "Definition 2"
}'
```

Response
```json
{
  "message": "Glossary data updated successfully",
  "success": true
}
```

---

#### Subscribe to governance body

Request
```shell
curl --location --request POST 'localhost:31310/v2/governance/subscribe' \
--header 'Content-Type: application/json' \
--data-raw '{
  "governanceBodyId": "xfy7oofvb31bg07stafbqxcug7mmmjzxg0gi8r1nwkv63u3pxwy85s5xpgs204bk"
}'
```

Response
```json
{
  "message": "Subscribed to governance body",
  "success": true
}
```

---

### Additional Governance Resources

- GET `/v2/governance/exists` - determine if the instance is a governance body
- GET `/v2/governance` - get all governance data. picklist orgList, pickList, and glossary data stringified in the metaValue attribute
- GET `/v2/governance/sync` - sync governance data from other governance bodies
- GET `/v2/governance/meta/picklist` - get governance picklist data
- GET `/v2/governance/meta/glossary` - get governance glossary data
- GET `/v2/governance/meta/orglist` - get governance organization data
- POST `/v2/governance` - create a governance body on the current node
- POST `/v2/governance/meta/picklist` - set the governance picklist data returned by GET `/v2/governance/meta/picklist`
- POST `/v2/governance/meta/glossary` - set the governance glossary data returned by GET `/v2/governance/meta/glossary`
- POST `/v2/governance/meta/orglist` - set the governance organization list data returned by GET `/v2/governance/meta/orglist`
- POST `/v2/governance/subscribe` - subscribe to a governance body's datalayer store

---

## `methodology`

Functionality: Create, read, update, and delete methodology records

<a id="methodology-get-examples"></a>
### GET Examples

#### List all methodologies

Request
```shell
curl --location --request GET 'localhost:31310/v2/methodology?page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 5,
  "data": [
    {
      "cadTrustMethodologyId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
      "methodologyCode": "ACR-001",
      "methodologyName": "Truck Stop Electrification",
      "methodologyVersion": "1.0.0",
      "methodologyDate": "2022-01-01T00:00:00.000Z",
      "methodologyLink": "https://example.com/methodology",
      "methodologyType": "Reduction - technical",
      "createdAt": "2022-03-11T05:17:55.427Z",
      "updatedAt": "2022-03-11T05:17:55.427Z"
    }
  ]
}
```

---

#### Get single methodology

Request
```shell
curl --location --request GET 'localhost:31310/v2/methodology/9b9bb857-c71b-4649-b805-a289db27dc1c' --header 'Content-Type: application/json'
```

Response
```json
{
  "cadTrustMethodologyId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
  "methodologyCode": "ACR-001",
  "methodologyName": "Truck Stop Electrification",
  "methodologyVersion": "1.0.0",
  "methodologyDate": "2022-01-01T00:00:00.000Z",
  "methodologyLink": "https://example.com/methodology",
  "methodologyType": "Reduction - technical",
  "createdAt": "2022-03-11T05:17:55.427Z",
  "updatedAt": "2022-03-11T05:17:55.427Z"
}
```

---

<a id="methodology-post-examples"></a>
### POST Examples

#### Create methodology

Request
```shell
curl --location --request POST 'localhost:31310/v2/methodology' \
--header 'Content-Type: application/json' \
--data-raw '{
  "methodologyCode": "ACR-001",
  "methodologyName": "Truck Stop Electrification",
  "methodologyVersion": "1.0.0",
  "methodologyDate": "2022-01-01",
  "methodologyLink": "https://example.com/methodology",
  "methodologyType": "Reduction - technical"
}'
```

Response
```json
{
  "message": "Methodology staged successfully",
  "uuid": "9b9bb857-c71b-4649-b805-a289db27dc1c",
  "success": true
}
```

---

<a id="methodology-put-examples"></a>
### PUT Examples

#### Update methodology

Request
```shell
curl --location --request PUT 'localhost:31310/v2/methodology/9b9bb857-c71b-4649-b805-a289db27dc1c' \
--header 'Content-Type: application/json' \
--data-raw '{
  "methodologyCode": "ACR-001",
  "methodologyName": "Truck Stop Electrification - Updated",
  "methodologyVersion": "1.0.0",
  "methodologyDate": "2022-01-01",
  "methodologyLink": "https://example.com/methodology",
  "methodologyType": "Reduction - technical"
}'
```

Response
```json
{
  "message": "Methodology update added to staging",
  "success": true
}
```

---

<a id="methodology-delete-examples"></a>
### DELETE Examples

#### Delete methodology

Request
```shell
curl --location --request DELETE 'localhost:31310/v2/methodology/9b9bb857-c71b-4649-b805-a289db27dc1c' \
--header 'Content-Type: application/json'
```

Response
```json
{
  "message": "Methodology deletion staged successfully",
  "success": true
}
```

---

## `program`

Functionality: Create, read, update, and delete program records

<a id="program-get-examples"></a>
### GET Examples

#### List all programs

Request
```shell
curl --location --request GET 'localhost:31310/v2/program?page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 3,
  "data": [
    {
      "cadTrustProgramId": "51ca9638-22b0-4e14-ae7a-c09d23b37b58",
      "programName": "Gold Standard Program",
      "programRegistry": "Gold Standard",
      "programRegistryActivityId": "GS-001",
      "programRegistryProgramId": "PROG-001",
      "programDescription": "A carbon crediting program",
      "createdAt": "2022-03-11T05:17:55.422Z",
      "updatedAt": "2022-03-11T05:17:55.422Z"
    }
  ]
}
```

---

#### Get single program

Request
```shell
curl --location --request GET 'localhost:31310/v2/program/51ca9638-22b0-4e14-ae7a-c09d23b37b58' --header 'Content-Type: application/json'
```

Response
```json
{
  "cadTrustProgramId": "51ca9638-22b0-4e14-ae7a-c09d23b37b58",
  "programName": "Gold Standard Program",
  "programRegistry": "Gold Standard",
  "programRegistryActivityId": "GS-001",
  "programRegistryProgramId": "PROG-001",
  "programDescription": "A carbon crediting program",
  "createdAt": "2022-03-11T05:17:55.422Z",
  "updatedAt": "2022-03-11T05:17:55.422Z"
}
```

---

<a id="program-post-examples"></a>
### POST Examples

#### Create program

Request
```shell
curl --location --request POST 'localhost:31310/v2/program' \
--header 'Content-Type: application/json' \
--data-raw '{
  "programName": "Gold Standard Program",
  "programRegistry": "Gold Standard",
  "programRegistryActivityId": "GS-001",
  "programRegistryProgramId": "PROG-001",
  "programDescription": "A carbon crediting program"
}'
```

Response
```json
{
  "message": "Program staged successfully",
  "uuid": "51ca9638-22b0-4e14-ae7a-c09d23b37b58",
  "success": true
}
```

---

<a id="program-put-examples"></a>
### PUT Examples

#### Update program

Request
```shell
curl --location --request PUT 'localhost:31310/v2/program/51ca9638-22b0-4e14-ae7a-c09d23b37b58' \
--header 'Content-Type: application/json' \
--data-raw '{
  "programName": "Gold Standard Program - Updated",
  "programRegistry": "Gold Standard",
  "programRegistryActivityId": "GS-001",
  "programRegistryProgramId": "PROG-001",
  "programDescription": "An updated carbon crediting program"
}'
```

Response
```json
{
  "message": "Program update added to staging",
  "success": true
}
```

---

<a id="program-delete-examples"></a>
### DELETE Examples

#### Delete program

Request
```shell
curl --location --request DELETE 'localhost:31310/v2/program/51ca9638-22b0-4e14-ae7a-c09d23b37b58' \
--header 'Content-Type: application/json'
```

Response
```json
{
  "message": "Program deletion staged successfully",
  "success": true
}
```

---

## `project`

Functionality: Create, read, update, delete, and manage project records with advanced query features

Query string options:

|        Key         |  Type   | Description                                                                                                                     |
|:------------------:|:-------:|:--------------------------------------------------------------------------------------------------------------------------------|
|   None (default)   |   N/A   | Display all projects                                                                                                 |
| cadTrustProjectId | String  | Only display projects matching this cadTrustProjectId                                                               |
|       orgUid       | String  | Only display projects matching this orgUid                                                                           |
|       search       | String  | Display all projects that contain the specified query (case insensitive)                                             |
|      columns       | String  | Limit the result to the specified column. Can be used multiple times to show multiple columns                                   |
|       limit        | Number  | (Conditionally Required) Limit the number of projects to be displayed (must be used with page, eg `?page=5&limit=2`) |
|        page        | Number  | (Conditionally Required) Only display results from this page number (must be used with limit, eg `?page=5&limit=2`)             |
|        xls         | Boolean | If `true`, save the results to xls (Excel spreadsheet) format                                                                   |
|   projectIds       | String  | Filter by comma-separated list of project IDs                                                                   |
|       filter       | String  | Generic filter (e.g., `filter=field:value:eq`)                                                                   |
|       order        | String  | Sort order (e.g., `order=field:DESC`)                                                                   |
| onlyMarketplaceProjects | Boolean | Filter projects that have at least one unit listed on a marketplace (`true` = projects with marketplace units only) |

<a id="project-get-examples"></a>
### GET Examples

#### List all projects

- Pagination is required when not filtering by cadTrustProjectId

Request
```shell
curl --location --request GET 'http://localhost:31310/v2/project?page=1&limit=10' \
--header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 18,
  "data": [
    {
      "cadTrustProjectId":"9b9bb857-c71b-4649-b805-a289db27dc1c",
      "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
      "projectRegistryName":"Sweden National Registry",
      "projectId":"789",
      "projectCreditingProgram":"Gold Standard",
      "projectName":"Stop Desertification",
      "projectLink":"https://desertificationtest.com",
      "projectDescription":"A project to stop desertification",
      "projectSector":"Fugitive emissions – from fuels (solid, oil and gas)",
      "projectType":"Coal Mine Methane",
      "projectSubtype":"Methane Capture",
      "projectStatus":"Registered",
      "projectStatusDate":"2022-02-02T00:00:00.000Z",
      "projectUnitMetric":"tCO2e",
      "cadTrustReferenceProjectId":"REF-001",
      "cadTrustProgramId":"51ca9638-22b0-4e14-ae7a-c09d23b37b58",
      "createdAt":"2022-03-11T05:17:55.427Z",
      "updatedAt":"2022-03-11T05:17:55.427Z"
    }
  ]
}
```

**Note**: The `orgUid` field is automatically set from the home organization when creating or updating projects. It cannot be provided in POST or PUT requests and will be rejected if included.

---

#### Get single project

- Pagination is not required when providing a cadTrustProjectId

Request
```shell
curl --location --request GET 'localhost:31310/v2/project/51ca9638-22b0-4e14-ae7a-c09d23b37b58' --header 'Content-Type: application/json'
```

Response
```json
{
  "cadTrustProjectId":"51ca9638-22b0-4e14-ae7a-c09d23b37b58",
  "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
  "projectRegistryName":"Gold Standard",
  "projectId":"555",
  "projectCreditingProgram":"Gold Standard Program",
  "projectName":"Stop Deforestation",
  "projectLink":"http://testurl.com",
  "projectDescription":"A project to stop deforestation",
  "projectSector":"Agriculture Forestry and Other Land Use (AFOLU)",
  "projectType":"Soil Enrichment",
  "projectSubtype":"Soil Carbon",
  "projectStatus":"Listed",
  "projectStatusDate":"2022-03-02T00:00:00.000Z",
  "projectUnitMetric":"tCO2e",
  "cadTrustReferenceProjectId":"REF-555",
  "cadTrustProgramId":"51ca9638-22b0-4e14-ae7a-c09d23b37b58",
  "createdAt":"2022-03-11T05:17:55.422Z",
  "updatedAt":"2022-03-11T05:17:55.422Z"
}
```

---

#### List projects by orgUid

- Filter projects by organization UID. Pagination is required when filtering by orgUid.

Request
```shell
curl --location --request GET 'localhost:31310/v2/project?orgUid=77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9&page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 5,
  "data": [
    {
      "cadTrustProjectId":"9b9bb857-c71b-4649-b805-a289db27dc1c",
      "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
      "projectName":"Stop Desertification",
      "projectStatus":"Registered"
    }
  ]
}
```

---

#### List projects with advanced query features

Request
```shell
curl --location --request GET 'localhost:31310/v2/project?page=1&limit=10&search=forestry&columns=projectName&columns=projectStatus&filter=projectSector:Agriculture:eq&order=projectName:ASC' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 5,
  "data": [
    {
      "projectName":"Stop Deforestation",
      "projectStatus":"Listed"
    }
  ]
}
```

---

#### Filter projects with marketplace units

Request
```shell
curl --location --request GET 'localhost:31310/v2/project?onlyMarketplaceProjects=true&page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 3,
  "data": [
    {
      "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
      "projectName": "Stop Desertification",
      "projectStatus": "Registered"
    }
  ]
}
```

**Note**: This filter returns projects that have at least one unit with a `marketplaceIdentifier` set (not null and not empty). This includes both regular marketplace listings and tokenized units.

---

#### Export projects to Excel

Request
```sh
curl --location --request GET 'localhost:31310/v2/project?xls=true' --header 'Content-Type: application/json' > projects.xlsx
```

Response:

Download stream to download the XLS file of project records.

---

### POST Examples

#### Create project

**Note**: The `orgUid` field is automatically set from the home organization and cannot be provided in the request body. If included, the request will be rejected with an error.

Request
```sh
curl --location --request POST 'localhost:31310/v2/project' \
     --header 'Content-Type: application/json' \
     --data-raw '{
        "projectRegistryName": "UNFCCC",
        "projectId": "c9d147e2-bc07-4e68-a76d-43424fa8cd4e",
        "projectName": "POST sample",
        "projectLink": "http://testurl.com",
        "projectDescription": "Sample project description",
        "projectCreditingProgram": "Gold Standard Program",
        "projectSector": "Manufacturing industries",
        "projectType": "Conservation",
        "projectSubtype": "Forest Conservation",
        "projectStatus": "Registered",
        "projectStatusDate": "2022-03-12",
        "projectUnitMetric": "tCO2e",
        "cadTrustReferenceProjectId": "REF-001",
        "cadTrustProgramId": "51ca9638-22b0-4e14-ae7a-c09d23b37b58"
}'
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

#### Batch upload projects from CSV

Request
```shell
curl --location --request POST 'http://localhost:31310/v2/project/batch' --form 'csv=@"./createProject.csv"'
```

Response
```json
{
  "message":"CSV processing complete, your records have been added to the staging table.",
  "success": true
}
```

---

<a id="project-put-examples"></a>
### PUT Examples

#### Update project

**Note**: The `orgUid` field is automatically set from the home organization and cannot be provided in the request body. If included, the request will be rejected with an error.

Request
```sh
curl --location -g --request PUT 'http://localhost:31310/v2/project/51ca9638-22b0-4e14-ae7a-c09d23b37b58' \
--header 'Content-Type: application/json' \
--data-raw '{
    "projectRegistryName": "Verra",
    "projectId": "987",
    "projectName": "Stop Deforestation",
    "projectLink": "http://testurl.com",
    "projectDescription": "Updated project description",
    "projectCreditingProgram": "Verra Program",
    "projectSector": "Mining/Mineral production",
    "projectType": "Afforestation",
    "projectSubtype": "Reforestation",
    "projectStatus": "Listed",
    "projectStatusDate": "2022-03-19",
    "projectUnitMetric": "tCO2e",
    "cadTrustReferenceProjectId": "REF-987",
    "cadTrustProgramId": "51ca9638-22b0-4e14-ae7a-c09d23b37b58"
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

#### Transfer project between organizations

Request
```shell
curl --location -g --request PUT 'http://localhost:31310/v2/project/transfer' \
--header 'Content-Type: application/json' \
--data-raw '{
    "cadTrustProjectId": "51ca9638-22b0-4e14-ae7a-c09d23b37b58",
    "targetOrgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9"
}'
```

Response
```json
{
  "message": "Project transfer staged successfully",
  "success": true
}
```

---

#### Update projects from XLSX file

Request
```shell
curl --location -g --request PUT 'http://localhost:31310/v2/project/xlsx' --form 'xlsx=@"./cw_query.xlsx"'
```

Response
```json
{
  "message": "Updates from xlsx added to staging",
  "success": true
}
```

---

<a id="project-delete-examples"></a>
### DELETE Examples

#### Delete project

Request
```shell
curl --location -g --request DELETE 'http://localhost:31310/v2/project/693d37f6-318e-4d8b-9e14-3d2328b569be' \
--header 'Content-Type: application/json'
```

Response
```json
{
  "message": "Project deletion staged successfully",
  "success": true
}
```

---

### Additional Projects Resources

- PUT `project/transfer` - stage the transfer of a project from another CADT organization to the instance home organization
- PUT `project/xlsx` - update projects from XLSX file
- POST `project/batch` - batch upload projects from CSV file
- Advanced query features: search, orgUid filtering, column selection, xls export, generic filtering, sorting

---

## `validation`

Functionality: Create, read, update, and delete validation records

<a id="validation-get-examples"></a>
### GET Examples

#### List all validations

Request
```shell
curl --location --request GET 'localhost:31310/v2/validation?page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 3,
  "data": [
    {
      "cadTrustValidationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "validationId": "VAL-001",
      "validationType": "Validation of Project Design Document",
      "validationBody": "Sample Validation Body",
      "validationDate": "2022-01-15T00:00:00.000Z",
      "validationCreditPeriodStartDate": "2022-01-01T00:00:00.000Z",
      "validationCreditPeriodEndDate": "2022-12-31T00:00:00.000Z",
      "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
      "createdAt": "2022-03-11T05:17:55.427Z",
      "updatedAt": "2022-03-11T05:17:55.427Z"
    }
  ]
}
```

---

#### Get single validation

Request
```shell
curl --location --request GET 'localhost:31310/v2/validation/a1b2c3d4-e5f6-7890-abcd-ef1234567890' --header 'Content-Type: application/json'
```

Response
```json
{
  "cadTrustValidationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "validationId": "VAL-001",
  "validationType": "Validation of Project Design Document",
  "validationBody": "Sample Validation Body",
  "validationDate": "2022-01-15T00:00:00.000Z",
  "validationCreditPeriodStartDate": "2022-01-01T00:00:00.000Z",
  "validationCreditPeriodEndDate": "2022-12-31T00:00:00.000Z",
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
  "createdAt": "2022-03-11T05:17:55.427Z",
  "updatedAt": "2022-03-11T05:17:55.427Z"
}
```

---

<a id="validation-post-examples"></a>
### POST Examples

#### Create validation

Request
```shell
curl --location --request POST 'localhost:31310/v2/validation' \
--header 'Content-Type: application/json' \
--data-raw '{
  "validationId": "VAL-001",
  "validationType": "Validation of Project Design Document",
  "validationBody": "Sample Validation Body",
  "validationDate": "2022-01-15",
  "validationCreditPeriodStartDate": "2022-01-01",
  "validationCreditPeriodEndDate": "2022-12-31",
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c"
}'
```

Response
```json
{
  "message": "Validation staged successfully",
  "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "success": true
}
```

---

<a id="validation-put-examples"></a>
### PUT Examples

#### Update validation

Request
```shell
curl --location --request PUT 'localhost:31310/v2/validation/a1b2c3d4-e5f6-7890-abcd-ef1234567890' \
--header 'Content-Type: application/json' \
--data-raw '{
  "validationId": "VAL-001",
  "validationType": "Validation of Project Design Document",
  "validationBody": "Updated Validation Body",
  "validationDate": "2022-01-15",
  "validationCreditPeriodStartDate": "2022-01-01",
  "validationCreditPeriodEndDate": "2022-12-31",
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c"
}'
```

Response
```json
{
  "message": "Validation update added to staging",
  "success": true
}
```

---

<a id="validation-delete-examples"></a>
### DELETE Examples

#### Delete validation

Request
```shell
curl --location --request DELETE 'localhost:31310/v2/validation/a1b2c3d4-e5f6-7890-abcd-ef1234567890' \
--header 'Content-Type: application/json'
```

Response
```json
{
  "message": "Validation deletion staged successfully",
  "success": true
}
```

---

## `verification`

Functionality: Create, read, update, and delete verification records

<a id="verification-get-examples"></a>
### GET Examples

#### List all verifications

Request
```shell
curl --location --request GET 'localhost:31310/v2/verification?page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 3,
  "data": [
    {
      "cadTrustVerificationId": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
      "verificationId": "VER-001",
      "verificationStartDate": "2022-02-01T00:00:00.000Z",
      "verificationEndDate": "2022-02-20T00:00:00.000Z",
      "verificationBody": "Sample Verification Body",
      "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
      "cadTrustValidationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "createdAt": "2022-03-11T05:17:55.427Z",
      "updatedAt": "2022-03-11T05:17:55.427Z"
    }
  ]
}
```

---

#### Get single verification

Request
```shell
curl --location --request GET 'localhost:31310/v2/verification/b2c3d4e5-f6a7-8901-bcde-f23456789012' --header 'Content-Type: application/json'
```

Response
```json
{
  "cadTrustVerificationId": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
  "verificationId": "VER-001",
  "verificationStartDate": "2022-02-01T00:00:00.000Z",
  "verificationEndDate": "2022-02-20T00:00:00.000Z",
  "verificationBody": "Sample Verification Body",
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
  "cadTrustValidationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "createdAt": "2022-03-11T05:17:55.427Z",
  "updatedAt": "2022-03-11T05:17:55.427Z"
}
```

---

<a id="verification-post-examples"></a>
### POST Examples

#### Create verification

Request
```shell
curl --location --request POST 'localhost:31310/v2/verification' \
--header 'Content-Type: application/json' \
--data-raw '{
  "verificationId": "VER-001",
  "verificationStartDate": "2022-02-01",
  "verificationEndDate": "2022-02-20",
  "verificationBody": "Sample Verification Body",
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
  "cadTrustValidationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}'
```

Response
```json
{
  "message": "Verification staged successfully",
  "uuid": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
  "success": true
}
```

---

<a id="verification-put-examples"></a>
### PUT Examples

#### Update verification

Request
```shell
curl --location --request PUT 'localhost:31310/v2/verification/b2c3d4e5-f6a7-8901-bcde-f23456789012' \
--header 'Content-Type: application/json' \
--data-raw '{
  "verificationId": "VER-001",
  "verificationStartDate": "2022-02-01",
  "verificationEndDate": "2022-02-20",
  "verificationBody": "Updated Verification Body",
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
  "cadTrustValidationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}'
```

Response
```json
{
  "message": "Verification update added to staging",
  "success": true
}
```

---

<a id="verification-delete-examples"></a>
### DELETE Examples

#### Delete verification

Request
```shell
curl --location --request DELETE 'localhost:31310/v2/verification/b2c3d4e5-f6a7-8901-bcde-f23456789012' \
--header 'Content-Type: application/json'
```

Response
```json
{
  "message": "Verification deletion staged successfully",
  "success": true
}
```

---

## `issuance`

Functionality: Create, read, update, and delete issuance records

<a id="issuance-get-examples"></a>
### GET Examples

#### List all issuances

Request
```shell
curl --location --request GET 'localhost:31310/v2/issuance?page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 5,
  "data": [
    {
      "cadTrustIssuanceId": "d9f58b08-af25-461c-88eb-403bb02b135e",
      "issuanceId": "ISS-001",
      "issuanceDate": "2022-01-02T00:00:00.000Z",
      "cadTrustVerificationId": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
      "cadTrustMethodologyId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
      "cadTrustLocationId": "8182100d-7794-4df7-b3b3-758391d13011",
      "createdAt": "2022-03-12T08:58:43.271Z",
      "updatedAt": "2022-03-12T08:58:43.271Z"
    }
  ]
}
```

---

#### Get single issuance

Request
```shell
curl --location --request GET 'localhost:31310/v2/issuance/d9f58b08-af25-461c-88eb-403bb02b135e' --header 'Content-Type: application/json'
```

Response
```json
{
  "cadTrustIssuanceId": "d9f58b08-af25-461c-88eb-403bb02b135e",
  "issuanceId": "ISS-001",
  "issuanceDate": "2022-01-02T00:00:00.000Z",
  "cadTrustVerificationId": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
  "cadTrustMethodologyId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
  "cadTrustLocationId": "8182100d-7794-4df7-b3b3-758391d13011",
  "createdAt": "2022-03-12T08:58:43.271Z",
  "updatedAt": "2022-03-12T08:58:43.271Z"
}
```

---

<a id="issuance-post-examples"></a>
### POST Examples

#### Create issuance

Request
```shell
curl --location --request POST 'localhost:31310/v2/issuance' \
--header 'Content-Type: application/json' \
--data-raw '{
  "issuanceId": "ISS-001",
  "issuanceDate": "2022-01-02",
  "cadTrustVerificationId": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
  "cadTrustMethodologyId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
  "cadTrustLocationId": "8182100d-7794-4df7-b3b3-758391d13011"
}'
```

Response
```json
{
  "message": "Issuance staged successfully",
  "uuid": "d9f58b08-af25-461c-88eb-403bb02b135e",
  "success": true
}
```

---

<a id="issuance-put-examples"></a>
### PUT Examples

#### Update issuance

Request
```shell
curl --location --request PUT 'localhost:31310/v2/issuance/d9f58b08-af25-461c-88eb-403bb02b135e' \
--header 'Content-Type: application/json' \
--data-raw '{
  "issuanceId": "ISS-001",
  "issuanceDate": "2022-01-02",
  "cadTrustVerificationId": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
  "cadTrustMethodologyId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
  "cadTrustLocationId": "8182100d-7794-4df7-b3b3-758391d13011"
}'
```

Response
```json
{
  "message": "Issuance update added to staging",
  "success": true
}
```

---

<a id="issuance-delete-examples"></a>
### DELETE Examples

#### Delete issuance

Request
```shell
curl --location --request DELETE 'localhost:31310/v2/issuance/d9f58b08-af25-461c-88eb-403bb02b135e' \
--header 'Content-Type: application/json'
```

Response
```json
{
  "message": "Issuance deletion staged successfully",
  "success": true
}
```

---

## `unit`

Functionality: Create, read, update, delete, and manage unit records with advanced query features

Query string options:

|        Key         |  Type   | Description                                                                                                                     |
|:------------------:|:-------:|:--------------------------------------------------------------------------------------------------------------------------------|
|   None (default)   |   N/A   | Display all units                                                                                                 |
| cadTrustUnitId | String  | Only display units matching this cadTrustUnitId                                                               |
|       orgUid       | String  | Only display units matching this orgUid                                                                           |
|       search       | String  | Display all units that contain the specified query (case insensitive)                                             |
|      columns       | String  | Limit the result to the specified column. Can be used multiple times to show multiple columns                                   |
|       limit        | Number  | (Conditionally Required) Limit the number of units to be displayed (must be used with page, eg `?page=5&limit=2`) |
|        page        | Number  | (Conditionally Required) Only display results from this page number (must be used with limit, eg `?page=5&limit=2`)             |
|        xls         | Boolean | If `true`, save the results to xls (Excel spreadsheet) format                                                                   |
|       filter       | String  | Generic filter (e.g., `filter=field:value:eq`)                                                                   |
|       order        | String  | Sort order (e.g., `order=field:DESC`)                                                                   |
| marketplaceIdentifiers | String/Array | Filter units by specific marketplace identifiers (comma-separated or array) |
| hasMarketplaceIdentifier | Boolean | Filter units based on whether they have a marketplace identifier (`true` = with identifier, `false` = without identifier) |
| onlyTokenizedUnits | Boolean | Filter units that have been tokenized on Chia blockchain (`true` = tokenized units only, `false` = non-tokenized units only) |

<a id="unit-get-examples"></a>
### GET Examples

#### List all units

- Pagination is required when not filtering by cadTrustUnitId

Request
```shell
curl --location -g --request GET 'localhost:31310/v2/unit?page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 3134,
  "data": [
    {
      "cadTrustUnitId":"89d7a102-a5a6-4f80-bc67-d28eba4952f3",
      "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
      "unitSerialId":"UNIT-001",
      "unitStartBlock":"A345",
      "unitEndBlock":"B567",
      "unitCount":222,
      "unitVintageYear":2014,
      "unitType":"Reduction - technical",
      "unitStatus":"Buffer",
      "unitStatusReason":"Issued and active",
      "unitStatusDate":"2024-01-01T00:00:00.000Z",
      "unitLink":"https://example.com/unit",
      "unitMetric":"tCO2e",
      "unitCurrentOwner":"Sample Owner",
      "unitItmosReferenceId":"ITMO-001",
      "marketplace":"Demo Marketplace",
      "marketplaceLink":"http://climateWarehouse.com/myMarketplace",
      "marketplaceIdentifier":"AKFEE3",
      "cadTrustIssuanceId":"d9f58b08-af25-461c-88eb-403bb02b135e",
      "createdAt":"2022-03-13T05:29:39.647Z",
      "updatedAt":"2022-03-13T05:29:39.647Z"
    }
  ]
}
```

**Note**: The `orgUid` field is automatically set from the home organization when creating or updating units. It cannot be provided in POST or PUT requests and will be rejected if included.

---

#### Get single unit

Request
```shell
curl --location --request GET 'localhost:31310/v2/unit/89d7a102-a5a6-4f80-bc67-d28eba4952f3' --header 'Content-Type: application/json'
```

Response
```json
{
  "cadTrustUnitId":"89d7a102-a5a6-4f80-bc67-d28eba4952f3",
  "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
  "unitSerialId":"UNIT-001",
  "unitStartBlock":"A345",
  "unitEndBlock":"B567",
  "unitCount":222,
  "unitVintageYear":2014,
  "unitType":"Reduction - technical",
  "unitStatus":"Buffer",
  "unitStatusReason":"Issued and active",
  "unitStatusDate":"2024-01-01T00:00:00.000Z",
  "unitLink":"https://example.com/unit",
  "unitMetric":"tCO2e",
  "unitCurrentOwner":"Sample Owner",
  "unitItmosReferenceId":"ITMO-001",
  "marketplace":"Demo Marketplace",
  "marketplaceLink":"http://climateWarehouse.com/myMarketplace",
  "marketplaceIdentifier":"AKFEE3",
  "cadTrustIssuanceId":"d9f58b08-af25-461c-88eb-403bb02b135e",
  "createdAt":"2022-03-13T05:29:39.647Z",
  "updatedAt":"2022-03-13T05:29:39.647Z"
}
```

---

#### List units by orgUid

- Filter units by organization UID. Pagination is required when filtering by orgUid.

Request
```shell
curl --location --request GET 'localhost:31310/v2/unit?orgUid=77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9&page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 7,
  "data": [
    {
      "cadTrustUnitId":"89d7a102-a5a6-4f80-bc67-d28eba4952f3",
      "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
      "unitSerialId":"TEST-UNIT-001",
      "unitStartBlock":"A345",
      "unitEndBlock":"B567",
      "unitCount":222,
      "unitVintageYear":2014,
      "unitType":"Reduction - technical",
      "unitStatus":"Buffer"
    }
  ]
}
```

---

#### List units with advanced query features

Request
```shell
curl --location --request GET 'localhost:31310/v2/unit?page=1&limit=10&search=renewable&columns=unitCurrentOwner&columns=unitStatus&filter=unitVintageYear:2014:eq&order=unitCurrentOwner:ASC' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 5,
  "data": [
    {
      "unitCurrentOwner":"Sample Owner",
      "unitStatus":"Buffer"
    }
  ]
}
```

---

#### Export units to Excel

Request
```sh
curl --location --request GET 'localhost:31310/v2/unit?xls=true' --header 'Content-Type: application/json' > units.xlsx
```

Response:

Download stream to download the XLS file of unit records.

---

#### Filter units by marketplace identifiers

Request
```shell
curl --location --request GET 'localhost:31310/v2/unit?marketplaceIdentifiers=AKFEE3,XYZ123&page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 2,
  "data": [
    {
      "cadTrustUnitId": "89d7a102-a5a6-4f80-bc67-d28eba4952f3",
      "unitSerialId": "UNIT-001",
      "marketplace": "Demo Marketplace",
      "marketplaceLink": "http://climateWarehouse.com/myMarketplace",
      "marketplaceIdentifier": "AKFEE3",
      "unitVintageYear": 2024
    }
  ]
}
```

---

#### Filter units with marketplace identifier

Request
```shell
curl --location --request GET 'localhost:31310/v2/unit?hasMarketplaceIdentifier=true&page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 15,
  "data": [
    {
      "cadTrustUnitId": "89d7a102-a5a6-4f80-bc67-d28eba4952f3",
      "unitSerialId": "UNIT-001",
      "marketplace": "Demo Marketplace",
      "marketplaceIdentifier": "AKFEE3",
      "unitVintageYear": 2024
    }
  ]
}
```

---

#### Filter tokenized units

Request
```shell
curl --location --request GET 'localhost:31310/v2/unit?onlyTokenizedUnits=true&page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 5,
  "data": [
    {
      "cadTrustUnitId": "89d7a102-a5a6-4f80-bc67-d28eba4952f3",
      "unitSerialId": "UNIT-001",
      "marketplace": "Tokenized on Chia",
      "marketplaceIdentifier": "CHIA-TOKEN-12345",
      "unitVintageYear": 2024
    }
  ]
}
```

**Note**: Tokenized units must have `marketplace='Tokenized on Chia'` AND `marketplaceIdentifier` set (not null and not empty).

---

### POST Examples

#### Create unit

**Note**: The `orgUid` field is automatically set from the home organization and cannot be provided in the request body. If included, the request will be rejected with an error.

**Marketplace Fields**: The `marketplace`, `marketplaceLink`, and `marketplaceIdentifier` fields are optional. If provided, `marketplaceIdentifier` cannot be an empty string (must be null or a valid identifier).

Request
```shell
curl --location -g --request POST 'localhost:31310/v2/unit' \
     --header 'Content-Type: application/json' \
     --data-raw '{
       "unitSerialId": "UNIT-001",
       "unitStartBlock": "abc123",
       "unitEndBlock": "bcd456",
       "unitVintageYear": 1998,
       "unitCount": 200,
       "unitType": "Removal - technical",
       "unitStatus": "Held",
       "unitStatusReason": "Issued and active",
       "unitStatusDate": "2024-01-01",
       "unitLink": "http://climateWarehouse.com/myRegistry",
       "unitMetric": "tCO2e",
       "unitCurrentOwner": "Chia",
       "unitItmosReferenceId": "ITMO-001",
       "marketplace": "Demo Marketplace",
       "marketplaceLink": "http://climateWarehouse.com/myMarketplace",
       "marketplaceIdentifier": "AKFEE3",
       "cadTrustIssuanceId": "d9f58b08-af25-461c-88eb-403bb02b135e"
}'
```

Response
```json
{
  "message":"Unit staged successfully",
  "uuid":"9a29f826-ea60-489f-a290-c734e8fd57f1",
  "success":true
}
```

---

#### Create tokenized unit on Chia

Request
```shell
curl --location -g --request POST 'localhost:31310/v2/unit' \
     --header 'Content-Type: application/json' \
     --data-raw '{
       "unitSerialId": "UNIT-TOKENIZED-001",
       "unitStartBlock": "BLK001",
       "unitEndBlock": "BLK010",
       "unitVintageYear": 2024,
       "cadTrustIssuanceId": "issuance-uuid-here",
       "marketplace": "Tokenized on Chia",
       "marketplaceIdentifier": "CHIA-TOKEN-12345"
}'
```

Response
```json
{
  "message":"Unit staged successfully",
  "uuid":"9a29f826-ea60-489f-a290-c734e8fd57f1",
  "success":true
}
```

**Note**: To mark a unit as tokenized on Chia, set `marketplace='Tokenized on Chia'` and provide a `marketplaceIdentifier`. The unit can then be queried using `onlyTokenizedUnits=true`.

---

#### Split unit into multiple units

Request
```shell
curl --location -g --request POST 'localhost:31310/v2/unit/split' \
--header 'Content-Type: application/json' \
--data-raw '{
  "cadTrustUnitId": "5c3a952b-108e-4245-9e02-8fd8e3023a13",
  "records": [
    {
      "unitCount": 10,
      "unitBlockStart": "A001",
      "unitBlockEnd": "A010",
      "unitOwner": "New Owner 1",
      "unitStatus": "active",
      "countryJurisdictionOfOwner": "Bhutan"
    },
    {
      "unitCount": 5,
      "unitBlockStart": "B001",
      "unitBlockEnd": "B005",
      "unitStatus": "Held",
      "countryJurisdictionOfOwner": "Canada"
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

#### Batch upload units from CSV

Request
```shell
curl --location --request POST 'http://localhost:31310/v2/unit/batch' --form 'csv=@"./createUnit.csv"'
```

Response
```json
{
  "message":"CSV processing complete, your records have been added to the staging table.",
  "success": true
}
```

---

<a id="unit-put-examples"></a>
### PUT Examples

#### Update unit

**Note**: The `orgUid` field is automatically set from the home organization and cannot be provided in the request body. If included, the request will be rejected with an error.

Request
```shell
curl --location -g --request PUT 'localhost:31310/v2/unit/9a5def49-7af6-428a-9958-a1e88d74bf58' \
--header 'Content-Type: application/json' \
--data-raw '{
    "unitSerialId": "UNIT-001",
    "unitStartBlock": "QWERTY9800",
    "unitEndBlock": "ASDFGH9850",
    "unitVintageYear": 2002,
    "unitCount": 200,
    "unitType": "Removal - technical",
    "unitStatus": "Held",
    "unitStatusReason": "Updated status",
    "unitStatusDate": "2024-01-01",
    "unitLink": "http://climateWarehouse.com/myRegistry",
    "unitMetric": "tCO2e",
    "unitCurrentOwner": "New Owner",
    "unitItmosReferenceId": "ITMO-002",
    "cadTrustIssuanceId": "d9f58b08-af25-461c-88eb-403bb02b135e"
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

#### Update units from XLSX file

Request
```shell
curl --location -g --request PUT 'http://localhost:31310/v2/unit/xlsx' --form 'xlsx=@"./cw_query.xlsx"'
```

Response
```json
{
  "message": "Updates from xlsx added to staging",
  "success": true
}
```

---

<a id="unit-delete-examples"></a>
### DELETE Examples

#### Delete unit

Request
```shell
curl --location -g --request DELETE 'localhost:31310/v2/unit/104b082c-b112-4c39-9249-a52c6c53282b' \
     --header 'Content-Type: application/json'
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

- POST `unit/split` - split a unit into multiple units
- PUT `unit/xlsx` - update units from XLSX file
- POST `unit/batch` - batch upload units from CSV file
- Advanced query features: search, orgUid filtering, column selection, xls export, generic filtering, sorting

---

## `location`

Functionality: Create, read, update, and delete location records

<a id="location-get-examples"></a>
### GET Examples

#### List all locations

Request
```shell
curl --location --request GET 'localhost:31310/v2/location?page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 5,
  "data": [
    {
      "cadTrustLocationId": "8182100d-7794-4df7-b3b3-758391d13011",
      "locationCountry": "Latvia",
      "locationRegion": "Vidzeme",
      "locationGis": "{\"lat\": 56.8796, \"lng\": 24.6032}",
      "locationMapType": "geojson",
      "locationMapFileLink": "https://example.com/map.geojson",
      "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
      "createdAt": "2022-03-11T05:17:55.425Z",
      "updatedAt": "2022-03-11T05:17:55.425Z"
    }
  ]
}
```

---

#### Get single location

Request
```shell
curl --location --request GET 'localhost:31310/v2/location/8182100d-7794-4df7-b3b3-758391d13011' --header 'Content-Type: application/json'
```

Response
```json
{
  "cadTrustLocationId": "8182100d-7794-4df7-b3b3-758391d13011",
  "locationCountry": "Latvia",
  "locationRegion": "Vidzeme",
  "locationGis": "{\"lat\": 56.8796, \"lng\": 24.6032}",
  "locationMapType": "geojson",
  "locationMapFileLink": "https://example.com/map.geojson",
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
  "createdAt": "2022-03-11T05:17:55.425Z",
  "updatedAt": "2022-03-11T05:17:55.425Z"
}
```

---

<a id="location-post-examples"></a>
### POST Examples

#### Create location

Request
```shell
curl --location --request POST 'localhost:31310/v2/location' \
--header 'Content-Type: application/json' \
--data-raw '{
  "locationCountry": "Latvia",
  "locationRegion": "Vidzeme",
  "locationGis": "{\"lat\": 56.8796, \"lng\": 24.6032}",
  "locationMapType": "geojson",
  "locationMapFileLink": "https://example.com/map.geojson",
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c"
}'
```

Response
```json
{
  "message": "Location staged successfully",
  "uuid": "8182100d-7794-4df7-b3b3-758391d13011",
  "success": true
}
```

---

<a id="location-put-examples"></a>
### PUT Examples

#### Update location

Request
```shell
curl --location --request PUT 'localhost:31310/v2/location/8182100d-7794-4df7-b3b3-758391d13011' \
--header 'Content-Type: application/json' \
--data-raw '{
  "locationCountry": "Latvia",
  "locationRegion": "Region A",
  "locationGis": "{\"lat\": 56.8796, \"lng\": 24.6032}",
  "locationMapType": "geojson",
  "locationMapFileLink": "https://example.com/updated-map.geojson",
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c"
}'
```

Response
```json
{
  "message": "Location update added to staging",
  "success": true
}
```

---

<a id="location-delete-examples"></a>
### DELETE Examples

#### Delete location

Request
```shell
curl --location --request DELETE 'localhost:31310/v2/location/8182100d-7794-4df7-b3b3-758391d13011' \
--header 'Content-Type: application/json'
```

Response
```json
{
  "message": "Location deletion staged successfully",
  "success": true
}
```

---


## `estimation`

Functionality: Create, read, update, and delete estimation records

<a id="estimation-get-examples"></a>
### GET Examples

#### List all estimations

Request
```shell
curl --location --request GET 'localhost:31310/v2/estimation?page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 3,
  "data": [
    {
      "cadTrustEstimationId": "c73fb4e7-3bd0-4449-8a57-6137b7c95a1f",
      "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
      "estimationStartDate": "2022-02-04T00:00:00.000Z",
      "estimationEndDate": "2022-03-04T00:00:00.000Z",
      "estimationUnitCount": 100,
      "estimationReferenceNo": "EST-001",
      "createdAt": "2022-03-11T05:17:55.427Z",
      "updatedAt": "2022-03-11T05:17:55.427Z"
    }
  ]
}
```

---

#### Get single estimation

Request
```shell
curl --location --request GET 'localhost:31310/v2/estimation/c73fb4e7-3bd0-4449-8a57-6137b7c95a1f' --header 'Content-Type: application/json'
```

Response
```json
{
  "cadTrustEstimationId": "c73fb4e7-3bd0-4449-8a57-6137b7c95a1f",
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
  "estimationStartDate": "2022-02-04T00:00:00.000Z",
  "estimationEndDate": "2022-03-04T00:00:00.000Z",
  "estimationUnitCount": 100,
  "estimationReferenceNo": "EST-001",
  "createdAt": "2022-03-11T05:17:55.427Z",
  "updatedAt": "2022-03-11T05:17:55.427Z"
}
```

---

<a id="estimation-post-examples"></a>
### POST Examples

#### Create estimation

Request
```shell
curl --location --request POST 'localhost:31310/v2/estimation' \
--header 'Content-Type: application/json' \
--data-raw '{
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
  "estimationStartDate": "2022-02-04",
  "estimationEndDate": "2022-03-04",
  "estimationUnitCount": 100,
  "estimationReferenceNo": "EST-001"
}'
```

Response
```json
{
  "message": "Estimation staged successfully",
  "uuid": "c73fb4e7-3bd0-4449-8a57-6137b7c95a1f",
  "success": true
}
```

---

<a id="estimation-put-examples"></a>
### PUT Examples

#### Update estimation

Request
```shell
curl --location --request PUT 'localhost:31310/v2/estimation/c73fb4e7-3bd0-4449-8a57-6137b7c95a1f' \
--header 'Content-Type: application/json' \
--data-raw '{
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
  "estimationStartDate": "2022-02-04",
  "estimationEndDate": "2022-03-04",
  "estimationUnitCount": 150,
  "estimationReferenceNo": "EST-001"
}'
```

Response
```json
{
  "message": "Estimation update added to staging",
  "success": true
}
```

---

<a id="estimation-delete-examples"></a>
### DELETE Examples

#### Delete estimation

Request
```shell
curl --location --request DELETE 'localhost:31310/v2/estimation/c73fb4e7-3bd0-4449-8a57-6137b7c95a1f' \
--header 'Content-Type: application/json'
```

Response
```json
{
  "message": "Estimation deletion staged successfully",
  "success": true
}
```

---

## `rating`

Functionality: Create, read, update, and delete rating records

<a id="rating-get-examples"></a>
### GET Examples

#### List all ratings

Request
```shell
curl --location --request GET 'localhost:31310/v2/rating?page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 2,
  "data": [
    {
      "cadTrustRatingId": "d31c3c75-b944-498d-9557-315f9005f478",
      "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
      "ratingType": "CCQI",
      "ratingName": "Quality Assessment Rating",
      "ratingValue": "97",
      "ratingLink": "testlink.com",
      "createdAt": "2022-03-11T05:17:55.427Z",
      "updatedAt": "2022-03-11T05:17:55.427Z"
    }
  ]
}
```

---

#### Get single rating

Request
```shell
curl --location --request GET 'localhost:31310/v2/rating/d31c3c75-b944-498d-9557-315f9005f478' --header 'Content-Type: application/json'
```

Response
```json
{
  "cadTrustRatingId": "d31c3c75-b944-498d-9557-315f9005f478",
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
  "ratingType": "CCQI",
  "ratingName": "Quality Assessment Rating",
  "ratingValue": "97",
  "ratingLink": "testlink.com",
  "createdAt": "2022-03-11T05:17:55.427Z",
  "updatedAt": "2022-03-11T05:17:55.427Z"
}
```

---

<a id="rating-post-examples"></a>
### POST Examples

#### Create rating

Request
```shell
curl --location --request POST 'localhost:31310/v2/rating' \
--header 'Content-Type: application/json' \
--data-raw '{
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
  "ratingType": "CCQI",
  "ratingName": "Quality Assessment Rating",
  "ratingValue": "97",
  "ratingLink": "testlink.com"
}'
```

Response
```json
{
  "message": "Rating staged successfully",
  "uuid": "d31c3c75-b944-498d-9557-315f9005f478",
  "success": true
}
```

---

<a id="rating-put-examples"></a>
### PUT Examples

#### Update rating

Request
```shell
curl --location --request PUT 'localhost:31310/v2/rating/d31c3c75-b944-498d-9557-315f9005f478' \
--header 'Content-Type: application/json' \
--data-raw '{
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
  "ratingType": "CCQI",
  "ratingName": "Updated Quality Assessment Rating",
  "ratingValue": "98",
  "ratingLink": "testlink.com"
}'
```

Response
```json
{
  "message": "Rating update added to staging",
  "success": true
}
```

---

<a id="rating-delete-examples"></a>
### DELETE Examples

#### Delete rating

Request
```shell
curl --location --request DELETE 'localhost:31310/v2/rating/d31c3c75-b944-498d-9557-315f9005f478' \
--header 'Content-Type: application/json'
```

Response
```json
{
  "message": "Rating deletion staged successfully",
  "success": true
}
```

---

## `co-benefit`

Functionality: Create, read, update, and delete co-benefit records

<a id="co-benefit-get-examples"></a>
### GET Examples

#### List all co-benefits

Request
```shell
curl --location --request GET 'localhost:31310/v2/co-benefit?page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 2,
  "data": [
    {
      "cadTrustCoBenefitId": "73cfbe9c-8cea-4aca-94d8-f1641e686787",
      "coBenefitId": "SDG 1 - No poverty",
      "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
      "createdAt": "2022-03-11T05:17:55.424Z",
      "updatedAt": "2022-03-11T05:17:55.424Z"
    }
  ]
}
```

---

#### Get single co-benefit

Request
```shell
curl --location --request GET 'localhost:31310/v2/co-benefit/73cfbe9c-8cea-4aca-94d8-f1641e686787' --header 'Content-Type: application/json'
```

Response
```json
{
  "cadTrustCoBenefitId": "73cfbe9c-8cea-4aca-94d8-f1641e686787",
  "coBenefitId": "SDG 1 - No poverty",
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
  "createdAt": "2022-03-11T05:17:55.424Z",
  "updatedAt": "2022-03-11T05:17:55.424Z"
}
```

---

<a id="co-benefit-post-examples"></a>
### POST Examples

#### Create co-benefit

Request
```shell
curl --location --request POST 'localhost:31310/v2/co-benefit' \
--header 'Content-Type: application/json' \
--data-raw '{
  "coBenefitId": "SDG 1 - No poverty",
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c"
}'
```

Response
```json
{
  "message": "Co-benefit staged successfully",
  "uuid": "73cfbe9c-8cea-4aca-94d8-f1641e686787",
  "success": true
}
```

---

<a id="co-benefit-put-examples"></a>
### PUT Examples

#### Update co-benefit

Request
```shell
curl --location --request PUT 'localhost:31310/v2/co-benefit/73cfbe9c-8cea-4aca-94d8-f1641e686787' \
--header 'Content-Type: application/json' \
--data-raw '{
  "coBenefitId": "SDG 2 - Zero hunger",
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c"
}'
```

Response
```json
{
  "message": "Co-benefit update added to staging",
  "success": true
}
```

---

<a id="co-benefit-delete-examples"></a>
### DELETE Examples

#### Delete co-benefit

Request
```shell
curl --location --request DELETE 'localhost:31310/v2/co-benefit/73cfbe9c-8cea-4aca-94d8-f1641e686787' \
--header 'Content-Type: application/json'
```

Response
```json
{
  "message": "Co-benefit deletion staged successfully",
  "success": true
}
```

---


## `project-methodology`

Functionality: Create, read, update, and delete project-methodology relationships

<a id="project-methodology-get-examples"></a>
### GET Examples

#### List all project-methodology relationships

Request
```shell
curl --location --request GET 'localhost:31310/v2/project-methodology?page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 5,
  "data": [
    {
      "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
      "cadTrustMethodologyId": "51ca9638-22b0-4e14-ae7a-c09d23b37b58",
      "createdAt": "2022-03-11T05:17:55.427Z",
      "updatedAt": "2022-03-11T05:17:55.427Z"
    }
  ]
}
```

---

#### Get single project-methodology relationship

Request
```shell
curl --location --request GET 'localhost:31310/v2/project-methodology/project/9b9bb857-c71b-4649-b805-a289db27dc1c/methodology/51ca9638-22b0-4e14-ae7a-c09d23b37b58' --header 'Content-Type: application/json'
```

Response
```json
{
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
  "cadTrustMethodologyId": "51ca9638-22b0-4e14-ae7a-c09d23b37b58",
  "createdAt": "2022-03-11T05:17:55.427Z",
  "updatedAt": "2022-03-11T05:17:55.427Z"
}
```

---

<a id="project-methodology-post-examples"></a>
### POST Examples

#### Create project-methodology relationship

Request
```shell
curl --location --request POST 'localhost:31310/v2/project-methodology' \
--header 'Content-Type: application/json' \
--data-raw '{
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
  "cadTrustMethodologyId": "51ca9638-22b0-4e14-ae7a-c09d23b37b58",
  "projectMethodologyDate": "2022-01-01",
  "projectMethodologyDescription": "Primary methodology for this project"
}'
```

Response
```json
{
  "message": "Project-methodology relationship staged successfully",
  "success": true
}
```

---

<a id="project-methodology-put-examples"></a>
### PUT Examples

#### Update project-methodology relationship

Request
```shell
curl --location --request PUT 'localhost:31310/v2/project-methodology/project/9b9bb857-c71b-4649-b805-a289db27dc1c/methodology/51ca9638-22b0-4e14-ae7a-c09d23b37b58' \
--header 'Content-Type: application/json' \
--data-raw '{
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
  "cadTrustMethodologyId": "51ca9638-22b0-4e14-ae7a-c09d23b37b58",
  "projectMethodologyDate": "2022-01-01",
  "projectMethodologyDescription": "Updated methodology description"
}'
```

Response
```json
{
  "message": "Project-methodology relationship update added to staging",
  "success": true
}
```

---

<a id="project-methodology-delete-examples"></a>
### DELETE Examples

#### Delete project-methodology relationship

Request
```shell
curl --location --request DELETE 'localhost:31310/v2/project-methodology/project/9b9bb857-c71b-4649-b805-a289db27dc1c/methodology/51ca9638-22b0-4e14-ae7a-c09d23b37b58' \
--header 'Content-Type: application/json'
```

Response
```json
{
  "message": "Project-methodology relationship deletion staged successfully",
  "success": true
}
```

---

## `stakeholder`

Functionality: Create, read, update, and delete stakeholder records

<a id="stakeholder-get-examples"></a>
### GET Examples

#### List all stakeholders

Request
```shell
curl --location --request GET 'localhost:31310/v2/stakeholder?page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 3,
  "data": [
    {
      "cadTrustStakeholderId": "e880047e-cdf4-45bb-a9df-e706fa427713",
      "stakeholderName": "Sample Stakeholder",
      "stakeholderType": "Owner",
      "stakeholderLink": "https://example.com/stakeholder",
      "createdAt": "2022-03-11T05:17:55.426Z",
      "updatedAt": "2022-03-11T05:17:55.426Z"
    }
  ]
}
```

---

#### Get single stakeholder

Request
```shell
curl --location --request GET 'localhost:31310/v2/stakeholder/e880047e-cdf4-45bb-a9df-e706fa427713' --header 'Content-Type: application/json'
```

Response
```json
{
  "cadTrustStakeholderId": "e880047e-cdf4-45bb-a9df-e706fa427713",
  "stakeholderName": "Sample Stakeholder",
  "stakeholderType": "Owner",
  "stakeholderLink": "https://example.com/stakeholder",
  "createdAt": "2022-03-11T05:17:55.426Z",
  "updatedAt": "2022-03-11T05:17:55.426Z"
}
```

---

### POST Examples

#### Create stakeholder

Request
```shell
curl --location --request POST 'localhost:31310/v2/stakeholder' \
--header 'Content-Type: application/json' \
--data-raw '{
  "stakeholderName": "Sample Stakeholder",
  "stakeholderType": "Owner",
  "stakeholderLink": "https://example.com/stakeholder"
}'
```

Response
```json
{
  "message": "Stakeholder staged successfully",
  "uuid": "e880047e-cdf4-45bb-a9df-e706fa427713",
  "success": true
}
```

---

<a id="stakeholder-put-examples"></a>
### PUT Examples

#### Update stakeholder

Request
```shell
curl --location --request PUT 'localhost:31310/v2/stakeholder/e880047e-cdf4-45bb-a9df-e706fa427713' \
--header 'Content-Type: application/json' \
--data-raw '{
  "stakeholderName": "Updated Stakeholder",
  "stakeholderType": "Developer",
  "stakeholderLink": "https://example.com/stakeholder"
}'
```

Response
```json
{
  "message": "Stakeholder update added to staging",
  "success": true
}
```

---

<a id="stakeholder-delete-examples"></a>
### DELETE Examples

#### Delete stakeholder

Request
```shell
curl --location --request DELETE 'localhost:31310/v2/stakeholder/e880047e-cdf4-45bb-a9df-e706fa427713' \
--header 'Content-Type: application/json'
```

Response
```json
{
  "message": "Stakeholder deletion staged successfully",
  "success": true
}
```

---

## `stakeholder-projects`

Functionality: Create, read, update, and delete stakeholder-project relationships

<a id="stakeholder-projects-get-examples"></a>
### GET Examples

#### List all stakeholder-project relationships

Request
```shell
curl --location --request GET 'localhost:31310/v2/stakeholder-projects?page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 3,
  "data": [
    {
      "cadTrustStakeholderProjectsId": "f1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "cadTrustStakeholderId": "e880047e-cdf4-45bb-a9df-e706fa427713",
      "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
      "createdAt": "2022-03-11T05:17:55.426Z",
      "updatedAt": "2022-03-11T05:17:55.426Z"
    }
  ]
}
```

---

#### Get single stakeholder-project relationship

Request
```shell
curl --location --request GET 'localhost:31310/v2/stakeholder-projects/f1a2b3c4-d5e6-7890-abcd-ef1234567890' --header 'Content-Type: application/json'
```

Response
```json
{
  "cadTrustStakeholderProjectsId": "f1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "cadTrustStakeholderId": "e880047e-cdf4-45bb-a9df-e706fa427713",
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
  "createdAt": "2022-03-11T05:17:55.426Z",
  "updatedAt": "2022-03-11T05:17:55.426Z"
}
```

---

<a id="stakeholder-projects-post-examples"></a>
### POST Examples

#### Create stakeholder-project relationship

Request
```shell
curl --location --request POST 'localhost:31310/v2/stakeholder-projects' \
--header 'Content-Type: application/json' \
--data-raw '{
  "cadTrustStakeholderId": "e880047e-cdf4-45bb-a9df-e706fa427713",
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c"
}'
```

Response
```json
{
  "message": "Stakeholder-project relationship staged successfully",
  "uuid": "f1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "success": true
}
```

---

<a id="stakeholder-projects-put-examples"></a>
### PUT Examples

#### Update stakeholder-project relationship

Request
```shell
curl --location --request PUT 'localhost:31310/v2/stakeholder-projects/f1a2b3c4-d5e6-7890-abcd-ef1234567890' \
--header 'Content-Type: application/json' \
--data-raw '{
  "cadTrustStakeholderId": "e880047e-cdf4-45bb-a9df-e706fa427713",
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c"
}'
```

Response
```json
{
  "message": "Stakeholder-project relationship update added to staging",
  "success": true
}
```

---

<a id="stakeholder-projects-delete-examples"></a>
### DELETE Examples

#### Delete stakeholder-project relationship

Request
```shell
curl --location --request DELETE 'localhost:31310/v2/stakeholder-projects/f1a2b3c4-d5e6-7890-abcd-ef1234567890' \
--header 'Content-Type: application/json'
```

Response
```json
{
  "message": "Stakeholder-project relationship deletion staged successfully",
  "success": true
}
```

---

## `label`

Functionality: Create, read, update, and delete label records

<a id="label-get-examples"></a>
### GET Examples

#### List all labels

Request
```shell
curl --location --request GET 'localhost:31310/v2/label?page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 5,
  "data": [
    {
      "cadTrustLabelId": "dcacd68e-1cfb-4f06-9798-efa0aacda42c",
      "labelName": "Sample Label",
      "labelType": "Certification",
      "labelLink": "http://samplelabel.net",
      "labelDate": "2022-03-11T00:00:00.000Z",
      "createdAt": "2022-03-11T05:17:55.426Z",
      "updatedAt": "2022-03-11T05:17:55.426Z"
    }
  ]
}
```

---

#### Get single label

Request
```shell
curl --location --request GET 'localhost:31310/v2/label/dcacd68e-1cfb-4f06-9798-efa0aacda42c' --header 'Content-Type: application/json'
```

Response
```json
{
  "cadTrustLabelId": "dcacd68e-1cfb-4f06-9798-efa0aacda42c",
  "labelName": "Sample Label",
  "labelType": "Certification",
  "labelLink": "http://samplelabel.net",
  "labelDate": "2022-03-11T00:00:00.000Z",
  "createdAt": "2022-03-11T05:17:55.426Z",
  "updatedAt": "2022-03-11T05:17:55.426Z"
}
```

---

<a id="label-post-examples"></a>
### POST Examples

#### Create label

Request
```shell
curl --location --request POST 'localhost:31310/v2/label' \
--header 'Content-Type: application/json' \
--data-raw '{
  "labelName": "Sample Label",
  "labelType": "Certification",
  "labelLink": "http://samplelabel.net",
  "labelDate": "2022-03-11"
}'
```

Response
```json
{
  "message": "Label staged successfully",
  "uuid": "dcacd68e-1cfb-4f06-9798-efa0aacda42c",
  "success": true
}
```

---

<a id="label-put-examples"></a>
### PUT Examples

#### Update label

Request
```shell
curl --location --request PUT 'localhost:31310/v2/label/dcacd68e-1cfb-4f06-9798-efa0aacda42c' \
--header 'Content-Type: application/json' \
--data-raw '{
  "labelName": "Updated Label",
  "labelType": "Article 6 - Endorsement",
  "labelLink": "http://samplelabel.net",
  "labelDate": "2022-03-11"
}'
```

Response
```json
{
  "message": "Label update added to staging",
  "success": true
}
```

---

<a id="label-delete-examples"></a>
### DELETE Examples

#### Delete label

Request
```shell
curl --location --request DELETE 'localhost:31310/v2/label/dcacd68e-1cfb-4f06-9798-efa0aacda42c' \
--header 'Content-Type: application/json'
```

Response
```json
{
  "message": "Label deletion staged successfully",
  "success": true
}
```

---

## `unit-label`

Functionality: Create, read, update, and delete unit-label relationships

<a id="unit-label-get-examples"></a>
### GET Examples

#### List all unit-label relationships

Request
```shell
curl --location --request GET 'localhost:31310/v2/unit-label?page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 3,
  "data": [
    {
      "cadTrustLabelId": "dcacd68e-1cfb-4f06-9798-efa0aacda42c",
      "cadTrustUnitId": "89d7a102-a5a6-4f80-bc67-d28eba4952f3",
      "createdAt": "2022-03-11T05:17:55.426Z",
      "updatedAt": "2022-03-11T05:17:55.426Z"
    }
  ]
}
```

---

#### Get single unit-label relationship

Request
```shell
curl --location --request GET 'localhost:31310/v2/unit-label/dcacd68e-1cfb-4f06-9798-efa0aacda42c/89d7a102-a5a6-4f80-bc67-d28eba4952f3' --header 'Content-Type: application/json'
```

Response
```json
{
  "cadTrustLabelId": "dcacd68e-1cfb-4f06-9798-efa0aacda42c",
  "cadTrustUnitId": "89d7a102-a5a6-4f80-bc67-d28eba4952f3",
  "createdAt": "2022-03-11T05:17:55.426Z",
  "updatedAt": "2022-03-11T05:17:55.426Z"
}
```

---

<a id="unit-label-post-examples"></a>
### POST Examples

#### Create unit-label relationship

Request
```shell
curl --location --request POST 'localhost:31310/v2/unit-label' \
--header 'Content-Type: application/json' \
--data-raw '{
  "cadTrustLabelId": "dcacd68e-1cfb-4f06-9798-efa0aacda42c",
  "cadTrustUnitId": "89d7a102-a5a6-4f80-bc67-d28eba4952f3",
  "labelUnitDate": "2022-03-11",
  "labelUnitDescription": "Label applied to unit for certification"
}'
```

Response
```json
{
  "message": "Unit-label relationship staged successfully",
  "success": true
}
```

---

<a id="unit-label-put-examples"></a>
### PUT Examples

#### Update unit-label relationship

Request
```shell
curl --location --request PUT 'localhost:31310/v2/unit-label/dcacd68e-1cfb-4f06-9798-efa0aacda42c/89d7a102-a5a6-4f80-bc67-d28eba4952f3' \
--header 'Content-Type: application/json' \
--data-raw '{
  "cadTrustLabelId": "dcacd68e-1cfb-4f06-9798-efa0aacda42c",
  "cadTrustUnitId": "89d7a102-a5a6-4f80-bc67-d28eba4952f3",
  "labelUnitDate": "2022-03-11",
  "labelUnitDescription": "Updated label description"
}'
```

Response
```json
{
  "message": "Unit-label relationship update added to staging",
  "success": true
}
```

---

<a id="unit-label-delete-examples"></a>
### DELETE Examples

#### Delete unit-label relationship

Request
```shell
curl --location --request DELETE 'localhost:31310/v2/unit-label/dcacd68e-1cfb-4f06-9798-efa0aacda42c/89d7a102-a5a6-4f80-bc67-d28eba4952f3' \
--header 'Content-Type: application/json'
```

Response
```json
{
  "message": "Unit-label relationship deletion staged successfully",
  "success": true
}
```

---

## `aef-t1-submission`

Functionality: Create, read, update, and delete AEF-T1-Submission records

<a id="aef-t1-submission-get-examples"></a>
### GET Examples

#### List all AEF-T1-Submissions

Request
```shell
curl --location --request GET 'localhost:31310/v2/aef-t1-submission?page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 2,
  "data": [
    {
      "cadTrustAefT1SubmissionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "submissionDate": "2022-01-15T00:00:00.000Z",
      "createdAt": "2022-03-11T05:17:55.427Z",
      "updatedAt": "2022-03-11T05:17:55.427Z"
    }
  ]
}
```

---

#### Get single AEF-T1-Submission

Request
```shell
curl --location --request GET 'localhost:31310/v2/aef-t1-submission/a1b2c3d4-e5f6-7890-abcd-ef1234567890' --header 'Content-Type: application/json'
```

Response
```json
{
  "cadTrustAefT1SubmissionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "submissionDate": "2022-01-15T00:00:00.000Z",
  "createdAt": "2022-03-11T05:17:55.427Z",
  "updatedAt": "2022-03-11T05:17:55.427Z"
}
```

---

<a id="aef-t1-submission-post-examples"></a>
### POST Examples

#### Create AEF-T1-Submission

Request
```shell
curl --location --request POST 'localhost:31310/v2/aef-t1-submission' \
--header 'Content-Type: application/json' \
--data-raw '{
  "submissionDate": "2022-01-15"
}'
```

Response
```json
{
  "message": "AEF-T1-Submission staged successfully",
  "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "success": true
}
```

---

<a id="aef-t1-submission-put-examples"></a>
### PUT Examples

#### Update AEF-T1-Submission

Request
```shell
curl --location --request PUT 'localhost:31310/v2/aef-t1-submission/a1b2c3d4-e5f6-7890-abcd-ef1234567890' \
--header 'Content-Type: application/json' \
--data-raw '{
  "submissionDate": "2022-01-20"
}'
```

Response
```json
{
  "message": "AEF-T1-Submission update added to staging",
  "success": true
}
```

---

<a id="aef-t1-submission-delete-examples"></a>
### DELETE Examples

#### Delete AEF-T1-Submission

Request
```shell
curl --location --request DELETE 'localhost:31310/v2/aef-t1-submission/a1b2c3d4-e5f6-7890-abcd-ef1234567890' \
--header 'Content-Type: application/json'
```

Response
```json
{
  "message": "AEF-T1-Submission deletion staged successfully",
  "success": true
}
```

---

## `aef-t5-authorized-entities`

Functionality: Create, read, update, and delete AEF-T5-Authorized-Entities records

<a id="aef-t5-authorized-entities-get-examples"></a>
### GET Examples

#### List all AEF-T5-Authorized-Entities

Request
```shell
curl --location --request GET 'localhost:31310/v2/aef-t5-authorized-entities?page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 2,
  "data": [
    {
      "cadTrustAefT5AuthorizedEntitiesId": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
      "entityName": "Sample Entity",
      "createdAt": "2022-03-11T05:17:55.427Z",
      "updatedAt": "2022-03-11T05:17:55.427Z"
    }
  ]
}
```

---

#### Get single AEF-T5-Authorized-Entities

Request
```shell
curl --location --request GET 'localhost:31310/v2/aef-t5-authorized-entities/b2c3d4e5-f6a7-8901-bcde-f23456789012' --header 'Content-Type: application/json'
```

Response
```json
{
  "cadTrustAefT5AuthorizedEntitiesId": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
  "entityName": "Sample Entity",
  "createdAt": "2022-03-11T05:17:55.427Z",
  "updatedAt": "2022-03-11T05:17:55.427Z"
}
```

---

<a id="aef-t5-authorized-entities-post-examples"></a>
### POST Examples

#### Create AEF-T5-Authorized-Entities

Request
```shell
curl --location --request POST 'localhost:31310/v2/aef-t5-authorized-entities' \
--header 'Content-Type: application/json' \
--data-raw '{
  "entityName": "Sample Entity"
}'
```

Response
```json
{
  "message": "AEF-T5-Authorized-Entities staged successfully",
  "uuid": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
  "success": true
}
```

---

<a id="aef-t5-authorized-entities-put-examples"></a>
### PUT Examples

#### Update AEF-T5-Authorized-Entities

Request
```shell
curl --location --request PUT 'localhost:31310/v2/aef-t5-authorized-entities/b2c3d4e5-f6a7-8901-bcde-f23456789012' \
--header 'Content-Type: application/json' \
--data-raw '{
  "entityName": "Updated Entity"
}'
```

Response
```json
{
  "message": "AEF-T5-Authorized-Entities update added to staging",
  "success": true
}
```

---

<a id="aef-t5-authorized-entities-delete-examples"></a>
### DELETE Examples

#### Delete AEF-T5-Authorized-Entities

Request
```shell
curl --location --request DELETE 'localhost:31310/v2/aef-t5-authorized-entities/b2c3d4e5-f6a7-8901-bcde-f23456789012' \
--header 'Content-Type: application/json'
```

Response
```json
{
  "message": "AEF-T5-Authorized-Entities deletion staged successfully",
  "success": true
}
```

---

## `aef-t2-authorizations`

Functionality: Create, read, update, and delete AEF-T2-Authorizations records

<a id="aef-t2-authorizations-get-examples"></a>
### GET Examples

#### List all AEF-T2-Authorizations

Request
```shell
curl --location --request GET 'localhost:31310/v2/aef-t2-authorizations?page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 2,
  "data": [
    {
      "cadTrustAefT2AuthorizationsId": "c3d4e5f6-a7b8-9012-cdef-345678901234",
      "authorizationDate": "2022-02-01T00:00:00.000Z",
      "createdAt": "2022-03-11T05:17:55.427Z",
      "updatedAt": "2022-03-11T05:17:55.427Z"
    }
  ]
}
```

---

#### Get single AEF-T2-Authorizations

Request
```shell
curl --location --request GET 'localhost:31310/v2/aef-t2-authorizations/c3d4e5f6-a7b8-9012-cdef-345678901234' --header 'Content-Type: application/json'
```

Response
```json
{
  "cadTrustAefT2AuthorizationsId": "c3d4e5f6-a7b8-9012-cdef-345678901234",
  "authorizationDate": "2022-02-01T00:00:00.000Z",
  "createdAt": "2022-03-11T05:17:55.427Z",
  "updatedAt": "2022-03-11T05:17:55.427Z"
}
```

---

<a id="aef-t2-authorizations-post-examples"></a>
### POST Examples

#### Create AEF-T2-Authorizations

Request
```shell
curl --location --request POST 'localhost:31310/v2/aef-t2-authorizations' \
--header 'Content-Type: application/json' \
--data-raw '{
  "authorizationDate": "2022-02-01"
}'
```

Response
```json
{
  "message": "AEF-T2-Authorizations staged successfully",
  "uuid": "c3d4e5f6-a7b8-9012-cdef-345678901234",
  "success": true
}
```

---

<a id="aef-t2-authorizations-put-examples"></a>
### PUT Examples

#### Update AEF-T2-Authorizations

Request
```shell
curl --location --request PUT 'localhost:31310/v2/aef-t2-authorizations/c3d4e5f6-a7b8-9012-cdef-345678901234' \
--header 'Content-Type: application/json' \
--data-raw '{
  "authorizationDate": "2022-02-05"
}'
```

Response
```json
{
  "message": "AEF-T2-Authorizations update added to staging",
  "success": true
}
```

---

<a id="aef-t2-authorizations-delete-examples"></a>
### DELETE Examples

#### Delete AEF-T2-Authorizations

Request
```shell
curl --location --request DELETE 'localhost:31310/v2/aef-t2-authorizations/c3d4e5f6-a7b8-9012-cdef-345678901234' \
--header 'Content-Type: application/json'
```

Response
```json
{
  "message": "AEF-T2-Authorizations deletion staged successfully",
  "success": true
}
```

---

## `aef-t3-actions`

Functionality: Create, read, update, and delete AEF-T3-Actions records

<a id="aef-t3-actions-get-examples"></a>
### GET Examples

#### List all AEF-T3-Actions

Request
```shell
curl --location --request GET 'localhost:31310/v2/aef-t3-actions?page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 2,
  "data": [
    {
      "cadTrustAefT3ActionsId": "d4e5f6a7-b8c9-0123-def4-456789012345",
      "actionDate": "2022-03-01T00:00:00.000Z",
      "createdAt": "2022-03-11T05:17:55.427Z",
      "updatedAt": "2022-03-11T05:17:55.427Z"
    }
  ]
}
```

---

#### Get single AEF-T3-Actions

Request
```shell
curl --location --request GET 'localhost:31310/v2/aef-t3-actions/d4e5f6a7-b8c9-0123-def4-456789012345' --header 'Content-Type: application/json'
```

Response
```json
{
  "cadTrustAefT3ActionsId": "d4e5f6a7-b8c9-0123-def4-456789012345",
  "actionDate": "2022-03-01T00:00:00.000Z",
  "createdAt": "2022-03-11T05:17:55.427Z",
  "updatedAt": "2022-03-11T05:17:55.427Z"
}
```

---

<a id="aef-t3-actions-post-examples"></a>
### POST Examples

#### Create AEF-T3-Actions

Request
```shell
curl --location --request POST 'localhost:31310/v2/aef-t3-actions' \
--header 'Content-Type: application/json' \
--data-raw '{
  "actionDate": "2022-03-01"
}'
```

Response
```json
{
  "message": "AEF-T3-Actions staged successfully",
  "uuid": "d4e5f6a7-b8c9-0123-def4-456789012345",
  "success": true
}
```

---

<a id="aef-t3-actions-put-examples"></a>
### PUT Examples

#### Update AEF-T3-Actions

Request
```shell
curl --location --request PUT 'localhost:31310/v2/aef-t3-actions/d4e5f6a7-b8c9-0123-def4-456789012345' \
--header 'Content-Type: application/json' \
--data-raw '{
  "actionDate": "2022-03-05"
}'
```

Response
```json
{
  "message": "AEF-T3-Actions update added to staging",
  "success": true
}
```

---

<a id="aef-t3-actions-delete-examples"></a>
### DELETE Examples

#### Delete AEF-T3-Actions

Request
```shell
curl --location --request DELETE 'localhost:31310/v2/aef-t3-actions/d4e5f6a7-b8c9-0123-def4-456789012345' \
--header 'Content-Type: application/json'
```

Response
```json
{
  "message": "AEF-T3-Actions deletion staged successfully",
  "success": true
}
```

---

## `aef-t4-holdings`

Functionality: Create, read, update, and delete AEF-T4-Holdings records

<a id="aef-t4-holdings-get-examples"></a>
### GET Examples

#### List all AEF-T4-Holdings

Request
```shell
curl --location --request GET 'localhost:31310/v2/aef-t4-holdings?page=1&limit=10' --header 'Content-Type: application/json'
```

Response
```json
{
  "page": 1,
  "pageCount": 2,
  "data": [
    {
      "cadTrustAefT4HoldingsId": "e5f6a7b8-c9d0-1234-ef56-567890123456",
      "holdingDate": "2022-04-01T00:00:00.000Z",
      "createdAt": "2022-03-11T05:17:55.427Z",
      "updatedAt": "2022-03-11T05:17:55.427Z"
    }
  ]
}
```

---

#### Get single AEF-T4-Holdings

Request
```shell
curl --location --request GET 'localhost:31310/v2/aef-t4-holdings/e5f6a7b8-c9d0-1234-ef56-567890123456' --header 'Content-Type: application/json'
```

Response
```json
{
  "cadTrustAefT4HoldingsId": "e5f6a7b8-c9d0-1234-ef56-567890123456",
  "holdingDate": "2022-04-01T00:00:00.000Z",
  "createdAt": "2022-03-11T05:17:55.427Z",
  "updatedAt": "2022-03-11T05:17:55.427Z"
}
```

---

<a id="aef-t4-holdings-post-examples"></a>
### POST Examples

#### Create AEF-T4-Holdings

Request
```shell
curl --location --request POST 'localhost:31310/v2/aef-t4-holdings' \
--header 'Content-Type: application/json' \
--data-raw '{
  "holdingDate": "2022-04-01"
}'
```

Response
```json
{
  "message": "AEF-T4-Holdings staged successfully",
  "uuid": "e5f6a7b8-c9d0-1234-ef56-567890123456",
  "success": true
}
```

---

<a id="aef-t4-holdings-put-examples"></a>
### PUT Examples

#### Update AEF-T4-Holdings

Request
```shell
curl --location --request PUT 'localhost:31310/v2/aef-t4-holdings/e5f6a7b8-c9d0-1234-ef56-567890123456' \
--header 'Content-Type: application/json' \
--data-raw '{
  "holdingDate": "2022-04-05"
}'
```

Response
```json
{
  "message": "AEF-T4-Holdings update added to staging",
  "success": true
}
```

---

<a id="aef-t4-holdings-delete-examples"></a>
### DELETE Examples

#### Delete AEF-T4-Holdings

Request
```shell
curl --location --request DELETE 'localhost:31310/v2/aef-t4-holdings/e5f6a7b8-c9d0-1234-ef56-567890123456' \
--header 'Content-Type: application/json'
```

Response
```json
{
  "message": "AEF-T4-Holdings deletion staged successfully",
  "success": true
}
```

---


## `audit`

Functionality: Show the complete history of an organization and manage conflicts

Options:

|    Key    |       Type        |                                              Description                                               |
|:---------:|:-----------------:|:------------------------------------------------------------------------------------------------------:|
|  orgUid   | (Required) String |                            Display audit records matching this orgUid                            |
|   order   |      String       |            Sort the audit records by `ASC` or `DESC` order based on confirmation timestamp             |
|   limit   | (Required) Number | Limit the number of audit records to be displayed (must be used with page, eg `?page=5&limit=2`) |
|   page    | (Required) Number |       Only display results from this page number (must be used with limit, eg `?page=5&limit=2`)       |

<a id="audit-get-examples"></a>
### GET Examples

#### Show the complete history of an organization

- Pagination is required when requesting audit history records

Request
```shell
curl --location --request GET 'localhost:31310/v2/audit?orgUid=9659b237d3316e0c5481148f6fbc6257e94736bf160854e7c6734366e312829a&page=1&limit=10' \
--header 'Content-Type: application/json'
```

Response
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
      "change": "{\"cadTrustProjectLocationId\":\"ID_USA\",\"unitOwner\":\"Chia\", ... }",
      "table": "unit",
      "onchainConfirmationTimeStamp": "1732131042",
      "author": "",
      "comment": "",
      "createdAt": "2024-11-20T19:31:51.960Z",
      "updatedAt": "2024-11-20T19:31:51.960Z",
      "generation": 4
    }
  ]
}
```

---

#### Find conflicts in organization data

Request
```shell
curl --location --request GET 'localhost:31310/v2/audit/findConflicts?orgUid=9659b237d3316e0c5481148f6fbc6257e94736bf160854e7c6734366e312829a' \
--header 'Content-Type: application/json'
```

Response
```json
{
  "conflicts": [
    {
      "generation": 3,
      "rootHash": "0x9caef12440fd98bf7edc8820fbc4633ce513df7da4ee70d7af0d68a7b7427361",
      "description": "Conflict detected at generation 3"
    }
  ]
}
```

---

<a id="audit-post-examples"></a>
### POST Examples

#### Reset organization to specific generation

Request
```shell
curl --location --request POST 'localhost:31310/v2/audit/resetToGeneration' \
--header 'Content-Type: application/json' \
--data-raw '{
  "orgUid": "9659b237d3316e0c5481148f6fbc6257e94736bf160854e7c6734366e312829a",
  "generation": 3
}'
```

Response
```json
{
  "message": "Organization reset to generation 3",
  "success": true
}
```

---

#### Reset organization to specific date

Request
```shell
curl --location --request POST 'localhost:31310/v2/audit/resetToDate' \
--header 'Content-Type: application/json' \
--data-raw '{
  "orgUid": "9659b237d3316e0c5481148f6fbc6257e94736bf160854e7c6734366e312829a",
  "date": "2024-10-01T00:00:00.000Z"
}'
```

Response
```json
{
  "message": "Organization reset to date 2024-10-01T00:00:00.000Z",
  "success": true
}
```

---

## `offer`

Functionality: generate, view, import, accept, datalayer offers for data transfers to other organizations

#### A Note On CADT Offers
 - Terms:
   - *Offer Maker*: the party requesting that data be transferred from a 3rd party organization into their own organization registry
   - *Offer Taker*: the party accepting an offer to transfer ownership of a climate project record form their organization registry into
   the offer maker's organization registry
 - Transfer Workflow Overview:
   - the offer maker stages the transfer of a project from another registry into their own
   - the offer maker creates an offer file which details the ownership transfer of the project record from its current
   registry into the offer makers registry
   - the offer taker uploads the offer file into CADT and reviews the records changes that have been purposed
   - the offer taker accepts the offer to transfer ownership of the project record and the project record is removed
   from their organization registry and added to the offer makers organization registry

<a id="offer-get-examples"></a>
### GET Examples

#### Generate and download a datalayer offer file

- Used by the offer maker
- For additional information please see [A Note On CADT Offers](#a-note-on-cadt-offers)

Request
```shell
curl --location --request GET 'localhost:31310/v2/offer/' --header 'Content-Type: application/json' > project-offer.txt
```

Response

Download stream to download the project transfer offer file.
Using the above `curl` will save the results to a file in the current directory called `project-offer.txt`.

---

#### Get the details of the currently uploaded offer file

- Only fetches purposed changes, makes no changes
- Used by the offer taker
- For additional information please see [A Note On CADT Offers](#a-note-on-cadt-offers)

Request
```shell
curl --location --request GET 'localhost:31310/v2/offer/accept' --header 'Content-Type: application/json'
```

Response
```json
{
  "offer": {
    "tradeId": "test-trade-id-12345",
    "maker": [{"store_id": "maker-store-id", "inclusions": []}],
    "taker": [{"store_id": "taker-store-id", "inclusions": []}]
  },
  "stagingRecords": []
}
```

---

<a id="offer-post-examples"></a>
### POST Examples

#### Upload an offer file

- Upload and parse an offer file named `offer-file.txt` in the current directory
- Used by the offer taker
- For additional information please see [A Note On CADT Offers](#a-note-on-cadt-offers)

Request
```shell
curl --location --request POST 'localhost:31310/v2/offer/accept/import' --header 'Content-Type: multipart/form-data' \
--form 'file=./offer-file.txt'
```

Response
```json
{
  "message": "Offer file imported successfully",
  "success": true
}
```

---

#### Commit imported offer

- Used by the offer taker
- For additional information please see [A Note On CADT Offers](#a-note-on-cadt-offers)

Request
```shell
curl --location --request POST 'localhost:31310/v2/offer/accept/commit' --header 'Content-Type: application/json'
```

Response
```json
{
  "message": "Imported offer committed successfully",
  "success": true
}
```

---

<a id="offer-delete-examples"></a>
### DELETE Examples

#### Cancel the currently active offer

- Used by the offer maker
- For additional information please see [A Note On CADT Offers](#a-note-on-cadt-offers)

Request
```shell
curl --location --request DELETE 'localhost:31310/v2/offer/' --header 'Content-Type: application/json'
```

Response
```json
{
  "message": "Active offer has been canceled",
  "success": true
}
```

---

#### Reject the currently imported transfer offer file

- Used by the offer taker
- For additional information please see [A Note On CADT Offers](#a-note-on-cadt-offers)

Request
```shell
curl --location --request DELETE 'localhost:31310/v2/offer/accept/cancel' --header 'Content-Type: application/json'
```

Response
```json
{
  "message": "Offer Cancelled",
  "success": true
}
```

---

### Additional offer resources

- GET `/v2/offer/` - Generate and download a datalayer offer file
- GET `/v2/offer/accept` - Get the details of the currently uploaded offer file
- POST `/v2/offer/accept/import` - Upload an offer file
- POST `/v2/offer/accept/commit` - Commit imported offer
- DELETE `/v2/offer/` - Cancel the currently active offer
- DELETE `/v2/offer/accept/cancel` - Reject the currently imported transfer offer file

---

## `filestore`

Functionality: Manage files in the filestore

<a id="filestore-get-examples"></a>
### GET Examples

#### Get file from filestore

Request
```shell
curl --location --request GET 'localhost:31310/v2/filestore/get_file?fileId=abc123def456' --header 'Content-Type: application/json'
```

Response

File download stream or JSON response with file data.

---

#### Get file list from filestore

Request
```shell
curl --location --request GET 'localhost:31310/v2/filestore/get_file_list' --header 'Content-Type: application/json'
```

Response
```json
{
  "files": [
    {
      "fileId": "abc123def456",
      "fileName": "example.pdf",
      "fileSize": 1024,
      "uploadDate": "2022-03-11T05:17:55.427Z"
    }
  ]
}
```

---

<a id="filestore-post-examples"></a>
### POST Examples

#### Add file to filestore

Request
```shell
curl --location --request POST 'localhost:31310/v2/filestore/add_file' \
--form 'file=@"./example.pdf"'
```

Response
```json
{
  "message": "File added successfully",
  "fileId": "abc123def456",
  "success": true
}
```

---

#### Subscribe to filestore

Request
```shell
curl --location --request POST 'localhost:31310/v2/filestore/subscribe' \
--header 'Content-Type: application/json' \
--data-raw '{
  "storeId": "xfy7oofvb31bg07stafbqxcug7mmmjzxg0gi8r1nwkv63u3pxwy85s5xpgs204bk"
}'
```

Response
```json
{
  "message": "Subscribed to filestore successfully",
  "success": true
}
```

---

#### Unsubscribe from filestore

Request
```shell
curl --location --request POST 'localhost:31310/v2/filestore/unsubscribe' \
--header 'Content-Type: application/json' \
--data-raw '{
  "storeId": "xfy7oofvb31bg07stafbqxcug7mmmjzxg0gi8r1nwkv63u3pxwy85s5xpgs204bk"
}'
```

Response
```json
{
  "message": "Unsubscribed from filestore successfully",
  "success": true
}
```

---

<a id="filestore-delete-examples"></a>
### DELETE Examples

#### Delete file from filestore

Request
```shell
curl --location --request DELETE 'localhost:31310/v2/filestore/delete_file?fileId=abc123def456' \
--header 'Content-Type: application/json'
```

Response
```json
{
  "message": "File deleted successfully",
  "success": true
}
```

---

## `health`

Functionality: Health check endpoint for V2 API

<a id="health-get-examples"></a>
### GET Examples

#### Health check

Request
```shell
curl --location --request GET 'localhost:31310/v2/health' --header 'Content-Type: application/json'
```

Response
```json
{
  "message": "V2 API is running",
  "timestamp": "2022-03-11T05:17:55.427Z"
}
```

---

