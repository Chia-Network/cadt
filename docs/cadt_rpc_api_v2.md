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

## Methodology
