---
description: CADT RPC API v2 Documentation
---

# CADT RPC API v2

This document describes the v2 API endpoints for CADT (Carbon Asset Data Trust).

## Table of Contents

- [Organizations](#organizations)
- [Methodology](#methodology)
- [Program](#program)
- [Project](#project)
- [Unit](#unit)
- [Issuance](#issuance)
- [Verification](#verification)
- [Validation](#validation)
- [Rating](#rating)
- [Co-Benefit](#co-benefit)
- [Estimation](#estimation)
- [Stakeholder](#stakeholder)
- [Stakeholder Projects](#stakeholder-projects)
- [Project Methodology](#project-methodology)
- [Unit Label](#unit-label)
- [AEF T1 Submission](#aef-t1-submission)
- [AEF T2 Authorizations](#aef-t2-authorizations)
- [AEF T3 Actions](#aef-t3-actions)
- [AEF T4 Holdings](#aef-t4-holdings)
- [AEF T5 Authorized Entities](#aef-t5-authorized-entities)
- [Audit](#audit)
- [File Store](#file-store)
- [Governance](#governance)

---

## Organizations

Organizations represent the top-level entity in the CADT system. Each organization has its own set of projects, methodologies, and other data.

### Endpoints

- `GET /v2/organizations` - List all organizations
- `GET /v2/organizations/status` - Get home org sync status
- `GET /v2/organizations/metadata` - Get metadata (with orgUid query param)
- `POST /v2/organizations` - Create V2 home org (new users) - supports both JSON body and file upload
- `POST /v2/organizations/upgrade` - Upgrade from V1 to V2 (existing users)
- `POST /v2/organizations/metadata` - Add metadata to home organization
- `POST /v2/organizations/sync` - Sync organization metadata
- `POST /v2/organizations/mirror` - Add mirror for a store
- `POST /v2/organizations/remove-mirror` - Remove mirror for a store
- `PUT /v2/organizations/edit` - Edit home organization (name and/or icon) - supports file upload
- `PUT /v2/organizations` - Import organization from datalayer
- `PUT /v2/organizations/subscribe` - Subscribe to organization
- `PUT /v2/organizations/unsubscribe` - Unsubscribe from organization
- `PUT /v2/organizations/resync` - Resync organization
- `DELETE /v2/organizations/:orgUid` - Delete organization

<a id="organizations-get"></a>
### GET /v2/organizations

Get all organizations.

#### Query Parameters

| Parameter | Type    | Required | Description                                                                    |
|:---------:|:-------:|:-------:|:------------------------------------------------------------------------------:|
| orgUid    | String  | No      | (Optional) Get metadata for specific organization                              |

#### Response

```json
{
  "success": true,
  "organizations": {
    "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9": {
      "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
      "name": "Example Organization",
      "icon": "",
      "isHome": true,
      "subscribed": true,
      "synced": true,
      "registryId": "xfy7oofvb31bg07stafbqxcug7mmmjzxg0gi8r1nwkv63u3pxwy85s5xpgs204bk",
      "dataModelVersionStoreId": "xfy7oofvb31bg07stafbqxcug7mmmjzxg0gi8r1nwkv63u3pxwy85s5xpgs204bk",
      "fileStoreSubscribed": "xfy7oofvb31bg07stafbqxcug7mmmjzxg0gi8r1nwkv63u3pxwy85s5xpgs204bk",
      "xchAddress": "xch1rgmkvffgzsjtynnu3vnkg4ywr0w06r69fy76cpx5yldwedslg20qfjsssv",
      "balance": 4.99999997358
    }
  }
}
```

#### Example

```sh
curl --location --request GET 'localhost:31310/v2/organizations' --header 'Content-Type: application/json'
```

Response:

```json
{
  "success": true,
  "organizations": {
    "orgUid":"77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
    "name": "Example Organization",
    "icon": "",
    "isHome": true,
    "subscribed": true,
    "synced": true,
    "registryId": "xfy7oofvb31bg07stafbqxcug7mmmjzxg0gi8r1nwkv63u3pxwy85s5xpgs204bk",
    "dataModelVersionStoreId": "xfy7oofvb31bg07stafbqxcug7mmmjzxg0gi8r1nwkv63u3pxwy85s5xpgs204bk",
    "fileStoreSubscribed": "xfy7oofvb31bg07stafbqxcug7mmmjzxg0gi8r1nwkv63u3pxwy85s5xpgs204bk"
  }
}
```

<a id="organizations-status"></a>
### GET /v2/organizations/status

Get the sync status of the home organization.

#### Query Parameters

| Parameter | Type   | Required | Description                                                                    |
|:---------:|:------:|:-------:|:------------------------------------------------------------------------------:|
| orgUid    | String | No      | (Optional) Get status for specific organization                                |

#### Example

```sh
curl --location --request GET 'localhost:31310/v2/organizations/status?orgUid=77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9' --header 'Content-Type: application/json'
```

Response:

```json
{
  "success": true,
  "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
  "synced": true,
  "syncRemaining": 0
}
```

<a id="organizations-metadata-get"></a>
### GET /v2/organizations/metadata

Get metadata for an organization.

#### Query Parameters

| Parameter | Type   | Required | Description                                                                    |
|:---------:|:------:|:-------:|:------------------------------------------------------------------------------:|
| orgUid    | String | No      | (Optional) Get metadata for specific organization                              |

#### Example

```sh
curl --location --request GET 'localhost:31310/v2/organizations/metadata?orgUid=77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9' --header 'Content-Type: application/json'
```

Response:

```json
{
  "success": true,
  "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9",
  "metadata": {
    "key1": "value1",
    "key2": "value2"
  }
}
```

<a id="organizations-post"></a>
### POST /v2/organizations

Create a new V2 home organization. This endpoint is for new users who don't have a V1 organization.

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

Fields:

| Field | Type | Required | Description |
|:------:|:--------:|:--------:|:------------------------------------------------------------|
| name | String | x | Organization name |
| icon | String | | Organization icon URL or base64-encoded image data |

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
    "message": "New V2 organization is currently being created. It can take up to 30 mins. Please do not interrupt this process.",
    "success": true
}
```

---

#### Upgrade V1 organization to V2

- This endpoint allows existing V1 organizations to be upgraded to V2.
- The upgrade process migrates V1 organization data to V2 format while maintaining V1/V2 isolation.
- **Note**: No request body is required. The endpoint automatically detects and uses the existing V1 home organization (`isHome: true`).

Request
```sh
curl --location -g --request POST 'localhost:31310/v2/organizations/upgrade' \
     --header 'Content-Type: application/json'
```

Response
```json
{
    "message": "V2 organization upgrade is currently being processed. It can take up to 30 mins. Please do not interrupt this process.",
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
        "storeId": "xfy7oofvb31bg07stafbqxcug7mmmjzxg0gi8r1nwkv63u3pxwy85s5xpgs204bk"
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

#### Edit home organization

Request
```sh
curl --location -g --request PUT 'localhost:31310/v2/organizations/edit' \
     --header 'Content-Type: application/json' \
     --data-raw '{
        "name": "Updated Organization Name",
        "icon": "https://example.com/new-icon.png"
}'
```

Response
```json
{
    "message": "Organization updated successfully",
    "success": true
}
```

---

#### Import organization from datalayer

Request
```sh
curl --location -g --request PUT 'localhost:31310/v2/organizations' \
     --header 'Content-Type: application/json' \
     --data-raw '{
        "orgUid": "foobar"
}'
```

Response
```json
{
    "message": "Organization imported successfully",
    "success": true,
    "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9"
}
```

---

#### Subscribe to organization

Request
```sh
curl --location -g --request PUT 'localhost:31310/v2/organizations/subscribe' \
     --header 'Content-Type: application/json' \
     --data-raw '{
        "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9"
}'
```

Response
```json
{
    "message": "Subscribed to organization successfully",
    "success": true
}
```

---

#### Unsubscribe from organization

Request
```sh
curl --location -g --request PUT 'localhost:31310/v2/organizations/unsubscribe' \
     --header 'Content-Type: application/json' \
     --data-raw '{
        "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9"
}'
```

Response
```json
{
    "message": "Unsubscribed from organization successfully",
    "success": true
}
```

---

#### Resync organization

Request
```sh
curl --location -g --request PUT 'localhost:31310/v2/organizations/resync' \
     --header 'Content-Type: application/json' \
     --data-raw '{
        "orgUid": "77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9"
}'
```

Response
```json
{
    "message": "Organization resync initiated",
    "success": true
}
```

---

#### Delete organization

Request
```sh
curl --location -g --request DELETE 'localhost:31310/v2/organizations/77641db780adc6c74f1ff357804e26a799e4a09157f426aac588963a39bdb2d9' \
     --header 'Content-Type: application/json'
```

Response
```json
{
    "message": "Removed all organization records for organization ${orgUid} and unsubscribed from organization datalayer stores. cadt will not sync the organizations data from datalayer",
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

Fields:

| Field | Type | Required | [Picklist](#get-picklist-data) | Description |
|:------:|:--------:|:--------:|:--------:|:------------------------------------------------------------|
| cadTrustProjectId | String | x | | CAD Trust project identifier. Must be a valid UUID |
| estimationStartDate | Date | x | | Start date of the estimation period (ISO 8601 format: YYYY-MM-DD) |
| estimationEndDate | Date | x | | End date of the estimation period (ISO 8601 format: YYYY-MM-DD). Must be after estimationStartDate |
| estimationUnitCount | Number | | | Estimated unit count (max 6 decimal places) |
| estimationReferenceNo | String | | | Reference number for the estimation (max 255 characters) |

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
  "cadTrustEstimationId": "b1c2d3e4-f5a6-7890-1234-567890abcdef",
  "success": true
}
```

---

<a id="estimation-put-examples"></a>
### PUT Examples

#### Update estimation

Fields are the same as POST (see above).

**Note**: Update requests must include ALL fields, not just the ones being changed.

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
      "ratingLink": "https://www.example.com/rating-report",
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
      "ratingLink": "https://www.example.com/rating-report",
      "createdAt": "2022-03-11T05:17:55.427Z",
  "updatedAt": "2022-03-11T05:17:55.427Z"
}
```

---

<a id="rating-post-examples"></a>
### POST Examples

#### Create rating

Fields:

| Field | Type | Required | [Picklist](#get-picklist-data) | Description |
|:------:|:--------:|:--------:|:--------:|:------------------------------------------------------------|
| cadTrustProjectId | String | x | | CAD Trust project identifier. Must be a valid UUID |
| ratingName | String | x | | Name of the rating (max 255 characters) |
| ratingValue | String | x | | Value of the rating (max 255 characters) |
| ratingType | String | | | Type of rating. Must be one of: CDP, CCQI |
| ratingLink | String | | | URL link to the rating. Must be a valid URI |

Request
```shell
curl --location --request POST 'localhost:31310/v2/rating' \
--header 'Content-Type: application/json' \
--data-raw '{
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
  "ratingType": "CCQI",
  "ratingName": "Quality Assessment Rating",
  "ratingValue": "97",
  "ratingLink": "https://www.example.com/rating-report"
}'
```

Response
```json
{
  "message": "Rating staged successfully",
  "uuid": "d31c3c75-b944-498d-9557-315f9005f478",
  "cadTrustRatingId": "c2d3e4f5-a6b7-8901-2345-67890abcdef1",
  "success": true
}
```

---

<a id="rating-put-examples"></a>
### PUT Examples

#### Update rating

Fields are the same as POST (see above).

**Note**: Update requests must include ALL fields, not just the ones being changed.

Request
```shell
curl --location --request PUT 'localhost:31310/v2/rating/d31c3c75-b944-498d-9557-315f9005f478' \
--header 'Content-Type: application/json' \
--data-raw '{
  "cadTrustProjectId": "9b9bb857-c71b-4649-b805-a289db27dc1c",
  "ratingType": "CCQI",
  "ratingName": "Updated Quality Assessment Rating",
  "ratingValue": "98",
  "ratingLink": "https://www.example.com/rating-report"
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

Fields:

| Field | Type | Required | [Picklist](#get-picklist-data) | Description |
|:------:|:--------:|:--------:|:--------:|:------------------------------------------------------------|
| cadTrustProjectId | String | x | | CAD Trust project identifier. Must be a valid UUID |
| coBenefitId | String | x | | Co-benefit identifier. Must be one of the valid SDG values: SDG 1 - No poverty, SDG 2 - Zero hunger, SDG 3 - Good health and well-being, SDG 4 - Quality education, SDG 5 - Gender equality, SDG 6 - Clean water and sanitation, SDG 7 - Affordable and clean energy, SDG 8 - Decent work and economic growth, SDG 9 - Industry, innovation, and infrastructure, SDG 10 - Reduced inequalities, SDG 11 - Sustainable cities and communities, SDG 12 - Responsible consumption and production, SDG 13 - Climate action, SDG 14 - Life below water, SDG 15 - Life on land, SDG 16 - Peace and justice strong institutions, SDG 17 - Partnerships for the goals |

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
  "cadTrustCoBenefitId": "d3e4f5a6-b7c8-9012-3456-7890abcdef12",
  "success": true
}
```

---

<a id="co-benefit-put-examples"></a>
### PUT Examples

#### Update co-benefit

Fields are the same as POST (see above).

**Note**: Update requests must include ALL fields, not just the ones being changed.

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

Fields:

| Field | Type | Required | Description |
|:------:|:--------:|:--------:|:------------------------------------------------------------|
| cadTrustProjectId | String (UUID) | x | CAD Trust project identifier. Must be a valid UUID |
| cadTrustMethodologyId | String (UUID) | x | CAD Trust methodology identifier. Must be a valid UUID |
| projectMethodologyDate | String (ISO Date) | | Date of the project-methodology relationship (YYYY-MM-DD format) |
| projectMethodologyDescription | String | | Description of the project-methodology relationship (max 10000 characters) |

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

Fields are the same as POST (see above).

**Note**: Update requests must include ALL fields, not just the ones being changed.

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

Fields:

| Field | Type | Required | [Picklist](#get-picklist-data) | Description |
|:------:|:--------:|:--------:|:--------:|:------------------------------------------------------------|
| stakeholderName | String | x | | Stakeholder name (max 255 characters) |
| stakeholderType | String | | x | Stakeholder type. Must be one of: Owner, Developer, Consultant |
| stakeholderLink | String | | | URL link to the stakeholder. Must be a valid URI |

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
  "cadTrustStakeholderId": "e4f5a6b7-c8d9-0123-4567-890abcdef123",
  "success": true
}
```

---

<a id="stakeholder-put-examples"></a>
### PUT Examples

#### Update stakeholder

Fields are the same as POST (see above).

**Note**: Update requests must include ALL fields, not just the ones being changed.

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

Fields:

| Field | Type | Required | Description |
|:------:|:--------:|:--------:|:------------------------------------------------------------|
| cadTrustStakeholderId | String (UUID) | x | CAD Trust stakeholder identifier. Must be a valid UUID |
| cadTrustProjectId | String (UUID) | x | CAD Trust project identifier. Must be a valid UUID |

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
  "cadTrustStakeholderProjectId": "f5a6b7c8-d9e0-1234-5678-90abcdef1234",
  "success": true
}
```

---

<a id="stakeholder-projects-put-examples"></a>
### PUT Examples

#### Update stakeholder-project relationship

Fields are the same as POST (see above).

**Note**: Update requests must include ALL fields, not just the ones being changed.

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

Fields:

| Field | Type | Required | [Picklist](#get-picklist-data) | Description |
|:------:|:--------:|:--------:|:--------:|:------------------------------------------------------------|
| labelName | String | x | | Name of the label (max 255 characters) |
| labelType | String | | | Type of label. Must be one of: Certification, Article 6 - Endorsement, Article 6 - Letter of Qualification, Article 6 - Authorisation, Article 6 - Letter of Approvals |
| labelLink | String | | | URL link to the label. Must be a valid URI |
| labelDate | Date | | | Date of the label (ISO 8601 format) |

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

Fields are the same as POST (see above).

**Note**: Update requests must include ALL fields, not just the ones being changed.

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

Fields:

| Field | Type | Required | [Picklist](#get-picklist-data) | Description |
|:------:|:--------:|:--------:|:--------:|:------------------------------------------------------------|
| cadTrustLabelId | String | x | | CAD Trust label identifier. Must be a valid UUID |
| cadTrustUnitId | String | x | | CAD Trust unit identifier. Must be a valid UUID |
| labelUnitDate | Date | | | Date of the unit-label relationship (ISO 8601 format, can be null) |
| labelUnitDescription | String | | | Description of the relationship (can be null) |

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

Fields are the same as POST (see above).

**Note**: Update requests must include ALL fields, not just the ones being changed.

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

Fields:

| Field | Type | Required | [Picklist](#get-picklist-data) | Description |
|:------:|:--------:|:--------:|:--------:|:------------------------------------------------------------|
| aefT1SubmissionParty | String | x | | Party submitting the AEF (max 255 characters) |
| aefT1SubmissionVersion | String | x | | Version of the submission (max 255 characters) |
| aefT1SubmissionReportYear | Number | x | | Report year (must be between 1900 and 2100) |
| aefT1SubmissionSubmissionDate | Date | x | | Submission date (ISO 8601 format) |
| aefT1SubmissionReviewStatus | String | | | Review status (can be null) |
| aefT1SubmissionResultCheck | String | | | Result check (can be null) |
| aefT1SubmissionNdcFirstYear | Number | | | NDC first year (must be between 1900 and 2100, can be null) |
| aefT1SubmissionNdcLastYear | Number | | | NDC last year (must be between 1900 and 2100, can be null) |
| aefT1SubmissionReferenceReviewReport | String | | | Reference review report URL. Must be a valid URI (can be null) |

Request
```shell
curl --location --request POST 'localhost:31310/v2/aef-t1-submission' \
--header 'Content-Type: application/json' \
--data-raw '{
  "aefT1SubmissionParty": "Sample Party",
  "aefT1SubmissionVersion": "1.0",
  "aefT1SubmissionReportYear": 2022,
  "aefT1SubmissionSubmissionDate": "2022-01-15",
  "aefT1SubmissionReviewStatus": "Under Review",
  "aefT1SubmissionResultCheck": "Passed",
  "aefT1SubmissionNdcFirstYear": 2020,
  "aefT1SubmissionNdcLastYear": 2030,
  "aefT1SubmissionReferenceReviewReport": "https://example.com/review-report"
}'
```

Response
```json
{
  "message": "AEF-T1-Submission staged successfully",
  "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "cadTrustAefT1SubmissionId": "b7c8d9e0-f1a2-3456-789a-bcdef1234567",
  "success": true
}
```

---

<a id="aef-t1-submission-put-examples"></a>
### PUT Examples

#### Update AEF-T1-Submission

Fields are the same as POST (see above).

**Note**: Update requests must include ALL fields, not just the ones being changed.

Request
```shell
curl --location --request PUT 'localhost:31310/v2/aef-t1-submission/a1b2c3d4-e5f6-7890-abcd-ef1234567890' \
--header 'Content-Type: application/json' \
--data-raw '{
  "aefT1SubmissionParty": "Sample Party",
  "aefT1SubmissionVersion": "1.0",
  "aefT1SubmissionReportYear": 2022,
  "aefT1SubmissionSubmissionDate": "2022-01-20",
  "aefT1SubmissionReviewStatus": "Approved",
  "aefT1SubmissionResultCheck": "Passed with conditions",
  "aefT1SubmissionNdcFirstYear": 2021,
  "aefT1SubmissionNdcLastYear": 2025,
  "aefT1SubmissionReferenceReviewReport": "https://example.com/updated-review-report"
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

Fields:

| Field | Type | Required | [Picklist](#get-picklist-data) | Description |
|:------:|:--------:|:--------:|:--------:|:------------------------------------------------------------|
| aefT2AuthorizationsId | String | x | | Authorization identifier (max 255 characters) |
| aefT2AuthorizationsDate | Date | x | | Authorization date (ISO 8601 format) |
| aefT2AuthorizationsCooperativeApproachId | String | x | | Cooperative approach identifier (max 255 characters) |
| aefT2AuthorizationsAuthorizedPartyId | String | x | | Authorized party identifier (max 255 characters) |
| aefT2AuthorizationsVersion | String | | | Version (max 255 characters, can be null) |
| aefT2AuthorizationsQuantity | Number | | | Quantity (max 2 decimal places, can be null) |
| aefT2AuthorizationsMetric | String | | x | Metric (can be null) |
| aefT2AuthorizationsGwpValue | String | | | GWP value (max 255 characters, can be null) |
| aefT2AuthorizationsApplicableNonGhgMetric | String | | | Applicable non-GHG metric (max 255 characters, can be null) |
| aefT2AuthorizationsSector | String | | x | Sector (can be null) |
| aefT2AuthorizationsActivityType | String | | x | Activity type (can be null) |
| aefT2AuthorizationsPurposesForAuthorization | String | | x | Purposes for authorization (can be null) |
| aefT2AuthorizationsAuthoziedEntityId | String | | | Authorized entity identifier (max 255 characters, can be null) |
| aefT2AuthorizationsOimpAuthorizedParty | String | | | OIMP authorized party (max 255 characters, can be null) |
| aefT2AuthorizationsAuthorizedTimeframe | String | | | Authorized timeframe (max 255 characters, can be null) |
| aefT2AuthorizationsAuthorizationTerms | String | | | Authorization terms (max 255 characters, can be null) |
| aefT2AuthorizationsAuthorizationDocumentation | String | | | Authorization documentation (can be null) |
| aefT2AuthorizationsFirstTransferDefinitionOimp | String | | | First transfer definition OIMP (can be null) |
| aefT2AuthorizationsAdditionalInformation | String | | | Additional information (can be null) |
| cadTrustAefT1SubmissionId | String | | | CAD Trust AEF T1 submission identifier. Must be a valid UUID (can be null) |
| cadTrustUnitId | String | | | CAD Trust unit identifier. Must be a valid UUID (can be null) |
| cadTrustProjectId | String | | | CAD Trust project identifier. Must be a valid UUID (can be null) |
| cadTrustAefT5AuthorizedEntitiesId | String | | | CAD Trust AEF T5 authorized entities identifier. Must be a valid UUID (can be null) |

**Note**: Valid picklist values can be retrieved using `GET /v2/governance/meta/pickList`.

Request
```shell
curl --location --request POST 'localhost:31310/v2/aef-t2-authorizations' \
--header 'Content-Type: application/json' \
--data-raw '{
  "aefT2AuthorizationsId": "TEST-AUTH-001",
  "aefT2AuthorizationsDate": "2022-02-01",
  "aefT2AuthorizationsCooperativeApproachId": "TEST-CA-001",
  "aefT2AuthorizationsAuthorizedPartyId": "TEST-PARTY-001",
  "aefT2AuthorizationsVersion": "1.0",
  "aefT2AuthorizationsQuantity": 1000.5,
  "aefT2AuthorizationsMetric": "tCO2e",
  "aefT2AuthorizationsGwpValue": "1.0",
  "aefT2AuthorizationsApplicableNonGhgMetric": "Test metric",
  "aefT2AuthorizationsSector": "Energy industries (renewable-/ non renewable sources)",
  "aefT2AuthorizationsActivityType": "Energy efficiency",
  "aefT2AuthorizationsPurposesForAuthorization": "Test purpose",
  "aefT2AuthorizationsAuthoziedEntityId": "TEST-ENTITY-001",
  "aefT2AuthorizationsOimpAuthorizedParty": "Test OIMP Party",
  "aefT2AuthorizationsAuthorizedTimeframe": "2024-2025",
  "aefT2AuthorizationsAuthorizationTerms": "Test terms",
  "aefT2AuthorizationsAuthorizationDocumentation": "<p>Test documentation</p>",
  "aefT2AuthorizationsFirstTransferDefinitionOimp": "Test transfer definition",
  "aefT2AuthorizationsAdditionalInformation": "Test additional information",
  "cadTrustAefT1SubmissionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "cadTrustUnitId": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
  "cadTrustProjectId": "c3d4e5f6-a7b8-9012-cdef-345678901234",
  "cadTrustAefT5AuthorizedEntitiesId": "e5f6a7b8-c9d0-1234-ef56-567890123456"
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

Fields are the same as POST (see above).

**Note**: Update requests must include ALL fields, not just the ones being changed. Valid picklist values can be retrieved using `GET /v2/governance/meta/pickList`.

Request
```shell
curl --location --request PUT 'localhost:31310/v2/aef-t2-authorizations/c3d4e5f6-a7b8-9012-cdef-345678901234' \
--header 'Content-Type: application/json' \
--data-raw '{
  "aefT2AuthorizationsId": "TEST-AUTH-001",
  "aefT2AuthorizationsDate": "2022-02-05",
  "aefT2AuthorizationsCooperativeApproachId": "TEST-CA-001",
  "aefT2AuthorizationsAuthorizedPartyId": "TEST-PARTY-001",
  "aefT2AuthorizationsVersion": "1.1",
  "aefT2AuthorizationsQuantity": 1500.75,
  "aefT2AuthorizationsMetric": "tCO2e",
  "aefT2AuthorizationsGwpValue": "1.0",
  "aefT2AuthorizationsApplicableNonGhgMetric": "Updated metric",
  "aefT2AuthorizationsSector": "Energy industries (renewable-/ non renewable sources)",
  "aefT2AuthorizationsActivityType": "Energy efficiency",
  "aefT2AuthorizationsPurposesForAuthorization": "Updated purpose",
  "aefT2AuthorizationsAuthoziedEntityId": "TEST-ENTITY-001",
  "aefT2AuthorizationsOimpAuthorizedParty": "Updated OIMP Party",
  "aefT2AuthorizationsAuthorizedTimeframe": "2024-2026",
  "aefT2AuthorizationsAuthorizationTerms": "Updated terms",
  "aefT2AuthorizationsAuthorizationDocumentation": "<p>Updated documentation</p>",
  "aefT2AuthorizationsFirstTransferDefinitionOimp": "Updated transfer definition",
  "aefT2AuthorizationsAdditionalInformation": "Updated additional information",
  "cadTrustAefT1SubmissionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "cadTrustUnitId": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
  "cadTrustProjectId": "c3d4e5f6-a7b8-9012-cdef-345678901234",
  "cadTrustAefT5AuthorizedEntitiesId": "e5f6a7b8-c9d0-1234-ef56-567890123456"
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

Fields:

| Field | Type | Required | [Picklist](#get-picklist-data) | Description |
|:------:|:--------:|:--------:|:--------:|:------------------------------------------------------------|
| aefT5AuthorizedEntitiesAuthorizationDate | Date | x | | Authorization date (ISO 8601 format) |
| aefT5AuthorizedEntitiesName | String | x | | Name of the authorized entity (max 255 characters) |
| aefT5AuthorizedEntitiesId | String | x | | Identifier of the authorized entity (max 255 characters) |
| aefT5AuthorizedEntitiesCooperativeApproachId | String | x | | Cooperative approach identifier (max 255 characters) |
| aefT5AuthorizedEntitiesIncorporationCountry | String | | x | Incorporation country (can be null) |
| aefT5AuthorizedEntitiesConditions | String | | | Conditions (can be null) |
| aefT5AuthorizedEntitiesChangeConditions | String | | | Change conditions (can be null) |
| aefT5AuthorizedEntitiesAdditionalInformation | String | | | Additional information (can be null) |
| cadTrustAefT1SubmissionId | String | | | CAD Trust AEF T1 submission identifier. Must be a valid UUID (can be null) |
| cadTrustUnitId | String | | | CAD Trust unit identifier. Must be a valid UUID (can be null) |
| cadTrustProjectId | String | | | CAD Trust project identifier. Must be a valid UUID (can be null) |

**Note**: Valid picklist values can be retrieved using `GET /v2/governance/meta/pickList`.

Request
```shell
curl --location --request POST 'localhost:31310/v2/aef-t5-authorized-entities' \
--header 'Content-Type: application/json' \
--data-raw '{
  "aefT5AuthorizedEntitiesAuthorizationDate": "2024-02-01",
  "aefT5AuthorizedEntitiesName": "Sample Entity",
  "aefT5AuthorizedEntitiesId": "TEST-AE-001",
  "aefT5AuthorizedEntitiesCooperativeApproachId": "TEST-CA-001",
  "aefT5AuthorizedEntitiesIncorporationCountry": "United States",
  "aefT5AuthorizedEntitiesConditions": "Test conditions",
  "aefT5AuthorizedEntitiesChangeConditions": "Test change conditions",
  "aefT5AuthorizedEntitiesAdditionalInformation": "Test additional information",
  "cadTrustAefT1SubmissionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "cadTrustUnitId": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
  "cadTrustProjectId": "c3d4e5f6-a7b8-9012-cdef-345678901234",
}'
```

Response
```json
{
  "message": "AEF-T5-Authorized-Entities staged successfully",
  "uuid": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
  "cadTrustAefT5AuthorizedEntitiesId": "c8d9e0f1-a2b3-4567-89ab-cdef12345678",
  "success": true
}
```

---

<a id="aef-t5-authorized-entities-put-examples"></a>
### PUT Examples

#### Update AEF-T5-Authorized-Entities

Fields are the same as POST (see above).

**Note**: Update requests must include ALL fields, not just the ones being changed. Valid picklist values can be retrieved using `GET /v2/governance/meta/pickList`.

Request
```shell
curl --location --request PUT 'localhost:31310/v2/aef-t5-authorized-entities/b2c3d4e5-f6a7-8901-bcde-f23456789012' \
--header 'Content-Type: application/json' \
--data-raw '{
  "aefT5AuthorizedEntitiesAuthorizationDate": "2024-02-01",
  "aefT5AuthorizedEntitiesName": "Updated Entity",
  "aefT5AuthorizedEntitiesId": "TEST-AE-001",
  "aefT5AuthorizedEntitiesCooperativeApproachId": "TEST-CA-001",
  "aefT5AuthorizedEntitiesIncorporationCountry": "United States",
  "aefT5AuthorizedEntitiesConditions": "Updated conditions",
  "aefT5AuthorizedEntitiesChangeConditions": "Updated change conditions",
  "aefT5AuthorizedEntitiesAdditionalInformation": "Updated additional information",
  "cadTrustAefT1SubmissionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "cadTrustUnitId": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
  "cadTrustProjectId": "c3d4e5f6-a7b8-9012-cdef-345678901234",
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

Fields:

| Field | Type | Required | [Picklist](#get-picklist-data) | Description |
|:------:|:--------:|:--------:|:--------:|:------------------------------------------------------------|
| aefT3ActionsDate | Date | x | | Action date (ISO 8601 format) |
| aefT3ActionsCoopoerativeApproachId | String | x | | Cooperative approach identifier (max 255 characters) |
| aefT3ActionsAuthorizationId | String | x | | Authorization identifier (max 255 characters) |
| aefT3ActionsFirstTransferringPartyId | String | x | | First transferring party identifier (max 255 characters) |
| aefT3ActionsPartyItmoRegistryId | String | x | | Party ITMO registry identifier (max 255 characters) |
| aefT3ActionsItmoFirstId | String | x | | ITMO first identifier (max 255 characters) |
| aefT3ActionsItmoLastId | String | x | | ITMO last identifier (max 255 characters) |
| aefT3ActionsUnitRegistryId | String | x | | Unit registry identifier (max 255 characters) |
| aefT3ActionsUnitFirstId | String | x | | Unit first identifier (max 255 characters) |
| aefT3ActionsUnitLastId | String | x | | Unit last identifier (max 255 characters) |
| aefT3ActionsQuantityTCo2 | Number | x | | Quantity in tCO2 (max 2 decimal places) |
| aefT3ActionsVintageYear | Number | x | | Vintage year (must be between 1900 and 2100) |
| aefT3ActionsTransferringPartyId | String | x | | Transferring party identifier (max 255 characters) |
| aefT3ActionsAcquiringPartyId | String | x | | Acquiring party identifier (max 255 characters) |
| aefT3ActionsType | String | | x | Action type (can be null) |
| aefT3ActionsSubtype | String | | | Action subtype (max 255 characters, can be null) |
| aefT3ActionsMetric | String | | x | Metric (can be null) |
| aefT3ActionsGwpValue | String | | | GWP value (max 255 characters, can be null) |
| aefT3ActionsApplicableNonGhgMetric | String | | | Applicable non-GHG metric (max 255 characters, can be null) |
| aefT3ActionsQuantityNonGhg | String | | | Quantity non-GHG (max 255 characters, can be null) |
| aefT3ActionsMitigationType | String | | x | Mitigation type (can be null) |
| aefT3ActionsPurposeOfUseOimp | String | | | Purpose of use OIMP (max 255 characters, can be null) |
| aefT3ActionsUsingParticipatingPartyId | String | | | Using participating party identifier (max 255 characters, can be null) |
| aefT3ActionsUsingAuthorizedEntityId | String | | | Using authorized entity identifier (max 255 characters, can be null) |
| aefT3ActionsItmoUsedYear | Number | | | ITMO used year (must be between 1900 and 2100, can be null) |
| aefT3ActionsConsistencyCheckResult | String | | | Consistency check result (max 255 characters, can be null) |
| aefT3ActionsAdditionalInformation | String | | | Additional information (max 255 characters, can be null) |
| cadTrustAefT1SubmissionId | String | | | CAD Trust AEF T1 submission identifier. Must be a valid UUID (can be null) |
| cadTrustUnitId | String | | | CAD Trust unit identifier. Must be a valid UUID (can be null) |
| cadTrustProjectId | String | | | CAD Trust project identifier. Must be a valid UUID (can be null) |

**Note**: Valid picklist values can be retrieved using `GET /v2/governance/meta/pickList`.

Request
```shell
curl --location --request POST 'localhost:31310/v2/aef-t3-actions' \
--header 'Content-Type: application/json' \
--data-raw '{
  "aefT3ActionsDate": "2022-03-01",
  "aefT3ActionsCoopoerativeApproachId": "TEST-CA-001",
  "aefT3ActionsAuthorizationId": "TEST-AUTH-001",
  "aefT3ActionsFirstTransferringPartyId": "TEST-PARTY-001",
  "aefT3ActionsPartyItmoRegistryId": "TEST-REGISTRY-001",
  "aefT3ActionsItmoFirstId": "ITMO-001",
  "aefT3ActionsItmoLastId": "ITMO-100",
  "aefT3ActionsUnitRegistryId": "UNIT-REGISTRY-001",
  "aefT3ActionsUnitFirstId": "UNIT-001",
  "aefT3ActionsUnitLastId": "UNIT-100",
  "aefT3ActionsQuantityTCo2": 1000.5,
  "aefT3ActionsVintageYear": 2022,
  "aefT3ActionsTransferringPartyId": "TEST-TRANSFER-001",
  "aefT3ActionsAcquiringPartyId": "TEST-ACQUIRE-001",
  "aefT3ActionsType": "Energy efficiency",
  "aefT3ActionsSubtype": "Test Subtype",
  "aefT3ActionsMetric": "tCO2e",
  "aefT3ActionsGwpValue": "1.0",
  "aefT3ActionsApplicableNonGhgMetric": "Test metric",
  "aefT3ActionsQuantityNonGhg": "100 units",
  "aefT3ActionsMitigationType": "Energy efficiency",
  "aefT3ActionsPurposeOfUseOimp": "Test purpose",
  "aefT3ActionsUsingParticipatingPartyId": "TEST-PARTICIPATING-001",
  "aefT3ActionsUsingAuthorizedEntityId": "TEST-AUTHORIZED-ENTITY-001",
  "aefT3ActionsItmoUsedYear": 2021,
  "aefT3ActionsConsistencyCheckResult": "Passed",
  "aefT3ActionsAdditionalInformation": "Test additional information",
  "cadTrustAefT1SubmissionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "cadTrustUnitId": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
  "cadTrustProjectId": "c3d4e5f6-a7b8-9012-cdef-345678901234",
}'
```

Response
```json
{
  "message": "AEF-T3-Actions staged successfully",
  "uuid": "d4e5f6a7-b8c9-0123-def4-456789012345",
  "cadTrustAefT3ActionsId": "e0f1a2b3-c4d5-6789-abcd-ef123456789a",
  "success": true
}
```

---

<a id="aef-t3-actions-put-examples"></a>
### PUT Examples

#### Update AEF-T3-Actions

Fields are the same as POST (see above).

**Note**: Update requests must include ALL fields, not just the ones being changed. Valid picklist values can be retrieved using `GET /v2/governance/meta/pickList`.

Request
```shell
curl --location --request PUT 'localhost:31310/v2/aef-t3-actions/d4e5f6a7-b8c9-0123-def4-456789012345' \
--header 'Content-Type: application/json' \
--data-raw '{
  "aefT3ActionsDate": "2022-03-05",
  "aefT3ActionsCoopoerativeApproachId": "TEST-CA-001",
  "aefT3ActionsAuthorizationId": "TEST-AUTH-001",
  "aefT3ActionsFirstTransferringPartyId": "TEST-PARTY-001",
  "aefT3ActionsPartyItmoRegistryId": "TEST-REGISTRY-001",
  "aefT3ActionsItmoFirstId": "ITMO-001",
  "aefT3ActionsItmoLastId": "ITMO-100",
  "aefT3ActionsUnitRegistryId": "UNIT-REGISTRY-001",
  "aefT3ActionsUnitFirstId": "UNIT-001",
  "aefT3ActionsUnitLastId": "UNIT-100",
  "aefT3ActionsQuantityTCo2": 1500.75,
  "aefT3ActionsVintageYear": 2022,
  "aefT3ActionsTransferringPartyId": "TEST-TRANSFER-001",
  "aefT3ActionsAcquiringPartyId": "TEST-ACQUIRE-001",
  "aefT3ActionsType": "Energy efficiency",
  "aefT3ActionsSubtype": "Updated Subtype",
  "aefT3ActionsMetric": "tCO2e",
  "aefT3ActionsGwpValue": "1.0",
  "aefT3ActionsApplicableNonGhgMetric": "Updated metric",
  "aefT3ActionsQuantityNonGhg": "150 units",
  "aefT3ActionsMitigationType": "Energy efficiency",
  "aefT3ActionsPurposeOfUseOimp": "Updated purpose",
  "aefT3ActionsUsingParticipatingPartyId": "TEST-PARTICIPATING-001",
  "aefT3ActionsUsingAuthorizedEntityId": "TEST-AUTHORIZED-ENTITY-001",
  "aefT3ActionsItmoUsedYear": 2021,
  "aefT3ActionsConsistencyCheckResult": "Passed with conditions",
  "aefT3ActionsAdditionalInformation": "Updated additional information",
  "cadTrustAefT1SubmissionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "cadTrustUnitId": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
  "cadTrustProjectId": "c3d4e5f6-a7b8-9012-cdef-345678901234",
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

Fields:

| Field | Type | Required | [Picklist](#get-picklist-data) | Description |
|:------:|:--------:|:--------:|:--------:|:------------------------------------------------------------|
| aefT4HoldingsCoopoerativeApproachId | String | x | | Cooperative approach identifier (max 255 characters) |
| aefT4HoldingsAuthorizationId | String | x | | Authorization identifier (max 255 characters) |
| aefT4HoldingsFirstTransferringPartyId | String | x | | First transferring party identifier (max 255 characters) |
| aefT4HoldingsPartyItmoRegistryId | String | x | | Party ITMO registry identifier (max 255 characters) |
| aefT4HoldingsItmoFirstId | String | x | | ITMO first identifier (max 255 characters) |
| aefT4HoldingsItmoLastId | String | x | | ITMO last identifier (max 255 characters) |
| aefT4HoldingsUnitRegistryId | String | x | | Unit registry identifier (max 255 characters) |
| aefT4HoldingsUnitFirstId | String | x | | Unit first identifier (max 255 characters) |
| aefT4HoldingsUnitLastId | String | x | | Unit last identifier (max 255 characters) |
| aefT4HoldingsQuantityTCo2 | Number | x | | Quantity in tCO2 (max 2 decimal places) |
| aefT4HoldingsVintageYear | Number | x | | Vintage year (must be between 1900 and 2100) |
| aefT4HoldingsMetric | String | | x | Metric (can be null) |
| aefT4HoldingsGwpValue | String | | | GWP value (max 255 characters, can be null) |
| aefT4HoldingsApplicableNonGhgMetric | String | | | Applicable non-GHG metric (max 255 characters, can be null) |
| aefT4HoldingsQuantityNonGhg | String | | | Quantity non-GHG (max 255 characters, can be null) |
| aefT4HoldingsMitigationType | String | | x | Mitigation type (can be null) |
| cadTrustAefT1SubmissionId | String | | | CAD Trust AEF T1 submission identifier. Must be a valid UUID (can be null) |
| cadTrustUnitId | String | | | CAD Trust unit identifier. Must be a valid UUID (can be null) |
| cadTrustProjectId | String | | | CAD Trust project identifier. Must be a valid UUID (can be null) |

**Note**: Valid picklist values can be retrieved using `GET /v2/governance/meta/pickList`.

Request
```shell
curl --location --request POST 'localhost:31310/v2/aef-t4-holdings' \
--header 'Content-Type: application/json' \
--data-raw '{
  "aefT4HoldingsCoopoerativeApproachId": "TEST-CA-001",
  "aefT4HoldingsAuthorizationId": "TEST-AUTH-001",
  "aefT4HoldingsFirstTransferringPartyId": "TEST-PARTY-001",
  "aefT4HoldingsPartyItmoRegistryId": "TEST-REGISTRY-001",
  "aefT4HoldingsItmoFirstId": "ITMO-001",
  "aefT4HoldingsItmoLastId": "ITMO-100",
  "aefT4HoldingsUnitRegistryId": "UNIT-REGISTRY-001",
  "aefT4HoldingsUnitFirstId": "UNIT-001",
  "aefT4HoldingsUnitLastId": "UNIT-100",
  "aefT4HoldingsQuantityTCo2": 1000.5,
  "aefT4HoldingsVintageYear": 2022,
  "aefT4HoldingsMetric": "tCO2e",
  "aefT4HoldingsGwpValue": "1.0",
  "aefT4HoldingsApplicableNonGhgMetric": "Test metric",
  "aefT4HoldingsQuantityNonGhg": "100 units",
  "aefT4HoldingsMitigationType": "Energy efficiency",
  "cadTrustAefT1SubmissionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "cadTrustUnitId": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
  "cadTrustProjectId": "c3d4e5f6-a7b8-9012-cdef-345678901234",
}'
```

Response
```json
{
  "message": "AEF-T4-Holdings staged successfully",
  "uuid": "e5f6a7b8-c9d0-1234-ef56-567890123456",
  "cadTrustAefT4HoldingsId": "f1a2b3c4-d5e6-789a-bcde-f123456789ab",
  "success": true
}
```

---

<a id="aef-t4-holdings-put-examples"></a>
### PUT Examples

#### Update AEF-T4-Holdings

Fields are the same as POST (see above).

**Note**: Update requests must include ALL fields, not just the ones being changed. Valid picklist values can be retrieved using `GET /v2/governance/meta/pickList`.

Request
```shell
curl --location --request PUT 'localhost:31310/v2/aef-t4-holdings/e5f6a7b8-c9d0-1234-ef56-567890123456' \
--header 'Content-Type: application/json' \
--data-raw '{
  "aefT4HoldingsCoopoerativeApproachId": "TEST-CA-001",
  "aefT4HoldingsAuthorizationId": "TEST-AUTH-001",
  "aefT4HoldingsFirstTransferringPartyId": "TEST-PARTY-001",
  "aefT4HoldingsPartyItmoRegistryId": "TEST-REGISTRY-001",
  "aefT4HoldingsItmoFirstId": "ITMO-001",
  "aefT4HoldingsItmoLastId": "ITMO-100",
  "aefT4HoldingsUnitRegistryId": "UNIT-REGISTRY-001",
  "aefT4HoldingsUnitFirstId": "UNIT-001",
  "aefT4HoldingsUnitLastId": "UNIT-100",
  "aefT4HoldingsQuantityTCo2": 1500.75,
  "aefT4HoldingsVintageYear": 2022,
  "aefT4HoldingsMetric": "tCO2e",
  "aefT4HoldingsGwpValue": "1.0",
  "aefT4HoldingsApplicableNonGhgMetric": "Updated metric",
  "aefT4HoldingsQuantityNonGhg": "150 units",
  "aefT4HoldingsMitigationType": "Energy efficiency",
  "cadTrustAefT1SubmissionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "cadTrustUnitId": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
  "cadTrustProjectId": "c3d4e5f6-a7b8-9012-cdef-345678901234",
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

## Methodology
