# Marketplace and Tokenization Features in V1

**Date**: 2025-11-21
**Purpose**: Detailed explanation of marketplace and tokenization features that exist in V1 but are not yet in V2

---

## Overview

The marketplace and tokenization features in V1 allow carbon credit units to be:
1. **Listed on marketplaces** - Units can be associated with external carbon credit marketplaces
2. **Tokenized on Chia blockchain** - Units can be tokenized and traded on the Chia blockchain

These features enable carbon credit trading and marketplace integration, allowing organizations to:
- Track which units are listed on which marketplaces
- Identify tokenized units (units that have been converted to blockchain tokens)
- Filter and query units/projects based on marketplace and tokenization status

---

## Database Fields

### Units Table Fields

V1 Units table includes the following marketplace/tokenization fields:

| Field | Type | Description |
|-------|------|-------------|
| `marketplace` | STRING | Name of the marketplace where the unit is listed (e.g., "Demo Marketplace", "Tokenized on Chia") |
| `marketplaceLink` | STRING | URL link to the unit's listing on the marketplace |
| `marketplaceIdentifier` | STRING | Unique identifier for the unit on the marketplace (e.g., "AKFEE3") |

**Example Unit Record**:
```javascript
{
  warehouseUnitId: 'uuid-here',
  unitSerialId: 'UNIT-001',
  marketplace: 'Demo Marketplace',
  marketplaceLink: 'http://climateWarehouse.com/myMarketplace',
  marketplaceIdentifier: 'AKFEE3',
  // ... other fields
}
```

### Projects Table

Projects don't have direct marketplace fields, but V1 provides a method `getTokenizedProjectIds()` that identifies projects that have tokenized units:

```javascript
// Returns project IDs that have at least one unit with a marketplaceIdentifier
static async getTokenizedProjectIds() {
  const sqlQuery = `
    SELECT Projects.warehouseProjectId
    FROM Projects
    INNER JOIN Issuances ON Projects.warehouseProjectId = Issuances.warehouseProjectId
    INNER JOIN Units ON Issuances.id = Units.issuanceId
    WHERE Units.marketplaceIdentifier IS NOT NULL AND Units.marketplaceIdentifier != '';
  `;
  // Returns array of project IDs
}
```

---

## API Query Parameters

### Units Endpoints

#### 1. `marketplaceIdentifiers` (Array of Strings)

**Purpose**: Filter units by specific marketplace identifiers

**Usage**: `GET /v1/units?marketplaceIdentifiers=AKFEE3,XYZ123`

**Implementation**:
```javascript
if (marketplaceIdentifiers) {
  where.marketplaceIdentifier = {
    [Sequelize.Op.in]: _.flatten([marketplaceIdentifiers]),
  };
}
```

**Example**: Find all units with marketplace identifiers "AKFEE3" or "XYZ123"

---

#### 2. `hasMarketplaceIdentifier` (Boolean)

**Purpose**: Filter units based on whether they have a marketplace identifier

**Usage**:
- `GET /v1/units?hasMarketplaceIdentifier=true` - Only units WITH marketplace identifiers
- `GET /v1/units?hasMarketplaceIdentifier=false` - Only units WITHOUT marketplace identifiers

**Implementation**:
```javascript
if (hasMarketplaceIdentifier === true) {
  where.marketplaceIdentifier = {
    [Sequelize.Op.not]: null,
  };
} else if (hasMarketplaceIdentifier === false) {
  where.marketplaceIdentifier = {
    [Sequelize.Op.eq]: null,
  };
}
```

**Example**: Find all units that are listed on any marketplace

---

#### 3. `onlyTokenizedUnits` (Boolean)

**Purpose**: Filter units that have been tokenized on Chia blockchain

**Usage**:
- `GET /v1/units?onlyTokenizedUnits=true` - Only tokenized units
- `GET /v1/units?onlyTokenizedUnits=false` - Only non-tokenized units

**Implementation**:
```javascript
if (onlyTokenizedUnits === true) {
  where.marketplaceIdentifier = {
    [Sequelize.Op.not]: null, // Must have marketplace identifier
  };
  where.marketplace = {
    [Sequelize.Op.eq]: 'Tokenized on Chia', // Must be tokenized on Chia
  };
} else if (onlyTokenizedUnits === false) {
  where.marketplace = {
    [Sequelize.Op.or]: [
      { [Sequelize.Op.is]: null },
      { [Sequelize.Op.not]: 'Tokenized on Chia' },
    ],
  };
}
```

**Key Logic**:
- A tokenized unit must have:
  1. A `marketplaceIdentifier` (not null)
  2. `marketplace` field equals exactly `"Tokenized on Chia"`

**Example**: Find all units that have been converted to Chia blockchain tokens

---

### Projects Endpoints

#### 4. `onlyMarketplaceProjects` (Boolean)

**Purpose**: Filter projects that have at least one unit listed on a marketplace

**Usage**: `GET /v1/projects?onlyMarketplaceProjects=true`

**Implementation**:
```javascript
if (onlyMarketplaceProjects) {
  const marketplaceProjectIds = await Project.getTokenizedProjectIds();
  where.warehouseProjectId = {
    [Sequelize.Op.in]: marketplaceProjectIds,
  };
}
```

**Key Logic**:
- Uses `Project.getTokenizedProjectIds()` to find all projects that have units with `marketplaceIdentifier` set
- Filters projects to only include those with marketplace units

**Example**: Find all projects that have units listed on marketplaces

---

## Full-Text Search Integration

The marketplace fields are included in V1's full-text search (FTS) for units:

```sql
-- V1 Units FTS includes marketplace fields
SELECT * FROM units_fts
WHERE units_fts MATCH :search
-- Searches across: marketplace, marketplaceLink, marketplaceIdentifier, etc.
```

This allows users to search for units by marketplace name or identifier using the general `search` parameter.

---

## Use Cases

### 1. Marketplace Integration

**Scenario**: An organization wants to list their carbon credits on an external marketplace

**Process**:
1. Create units with `marketplace`, `marketplaceLink`, and `marketplaceIdentifier` fields populated
2. Query units using `hasMarketplaceIdentifier=true` to see all listed units
3. Use `marketplaceIdentifiers=XXX` to find specific units by their marketplace ID

**Example**:
```javascript
// List a unit on marketplace
PUT /v1/units
{
  warehouseUnitId: 'unit-uuid',
  marketplace: 'Climate Marketplace',
  marketplaceLink: 'https://marketplace.com/units/ABC123',
  marketplaceIdentifier: 'ABC123'
}

// Query all marketplace units
GET /v1/units?hasMarketplaceIdentifier=true
```

---

### 2. Tokenization on Chia

**Scenario**: An organization wants to tokenize carbon credits on the Chia blockchain

**Process**:
1. Create units with `marketplace='Tokenized on Chia'` and a `marketplaceIdentifier`
2. Query tokenized units using `onlyTokenizedUnits=true`
3. Projects can be filtered to show only those with tokenized units using `onlyMarketplaceProjects=true`

**Example**:
```javascript
// Tokenize a unit on Chia
PUT /v1/units
{
  warehouseUnitId: 'unit-uuid',
  marketplace: 'Tokenized on Chia',
  marketplaceIdentifier: 'CHIA-TOKEN-12345'
}

// Find all tokenized units
GET /v1/units?onlyTokenizedUnits=true

// Find all projects with tokenized units
GET /v1/projects?onlyMarketplaceProjects=true
```

---

### 3. Marketplace Tracking

**Scenario**: Track which units are on which marketplaces

**Process**:
1. Use `marketplaceIdentifiers` to find units by their marketplace IDs
2. Use `hasMarketplaceIdentifier` to filter listed vs unlisted units
3. Use `onlyTokenizedUnits` to distinguish blockchain-tokenized units from regular marketplace listings

**Example**:
```javascript
// Find units listed on specific marketplace
GET /v1/units?marketplaceIdentifiers=AKFEE3,XYZ123

// Find all non-marketplace units
GET /v1/units?hasMarketplaceIdentifier=false

// Find only Chia-tokenized units (not regular marketplace listings)
GET /v1/units?onlyTokenizedUnits=true
```

---

## Validation Rules

### Units Validation

From `src/validations/units.validations.js`:

```javascript
marketplace: Joi.string().allow(null).optional(),
marketplaceLink: Joi.string().allow(null).optional(),
marketplaceIdentifier: Joi.string().disallow('').allow(null).optional(),
```

**Rules**:
- All marketplace fields are optional
- `marketplaceIdentifier` cannot be an empty string (must be null or a valid identifier)
- No length restrictions on marketplace fields

### Query Parameter Validation

```javascript
marketplaceIdentifiers: Joi.array()
  .items(Joi.string())
  .single()
  .max(APP.REQUEST_CONTENT_LIMITS.UNITS.MARKETPLACE_IDENTIFIERS_LEN), // Max 200
hasMarketplaceIdentifier: Joi.boolean(),
onlyTokenizedUnits: Joi.boolean(),
```

**Rules**:
- `marketplaceIdentifiers` can be an array or single string (auto-converted to array)
- Maximum 200 marketplace identifiers per query
- Boolean parameters must be true/false

---

## Current Status in V2

### ❌ Not Implemented

V2 currently does **NOT** have:
1. Marketplace fields in Units table (`marketplace`, `marketplaceLink`, `marketplaceIdentifier`)
2. Query parameters for marketplace filtering
3. `getTokenizedProjectIds()` equivalent method
4. Marketplace fields in FTS search

### Why Not in V2?

1. **Schema Design**: V2 schema (`v2-schema.dat`) does not include marketplace/tokenization fields
2. **Future Work**: These features are documented as future enhancements
3. **Architecture**: V2 focuses on core carbon credit registry functionality first

### What Would Be Needed to Add to V2?

To add marketplace/tokenization features to V2, you would need:

1. **Database Migration**: Add fields to `unit` table:
   ```sql
   ALTER TABLE unit ADD COLUMN marketplace VARCHAR(255);
   ALTER TABLE unit ADD COLUMN marketplace_link VARCHAR(255);
   ALTER TABLE unit ADD COLUMN marketplace_identifier VARCHAR(255);
   ```

2. **Model Updates**: Update `UnitV2` model to include marketplace fields

3. **Controller Updates**: Add query parameter handling in `unit-v2.controller.js`:
   - `marketplaceIdentifiers`
   - `hasMarketplaceIdentifier`
   - `onlyTokenizedUnits`

4. **Project Controller Updates**: Add `onlyMarketplaceProjects` filter and `getTokenizedProjectIds()` method

5. **FTS Updates**: Include marketplace fields in FTS5 search table for units

6. **Validation Updates**: Add marketplace field validation to `unit-v2.validations.js`

---

## Business Value

### Marketplace Features Enable:

1. **Carbon Credit Trading**: Organizations can list credits on external marketplaces
2. **Marketplace Integration**: Connect CADT registry with external carbon credit marketplaces
3. **Trading Tracking**: Track which units are listed where and their marketplace identifiers
4. **Multi-Marketplace Support**: Units can be listed on multiple marketplaces simultaneously

### Tokenization Features Enable:

1. **Blockchain Integration**: Convert carbon credits to blockchain tokens on Chia
2. **Token Trading**: Enable blockchain-based trading of carbon credits
3. **Token Tracking**: Identify which units have been tokenized
4. **Project-Level Tokenization**: Identify projects that have tokenized units

---

## Example Workflows

### Workflow 1: List Unit on Marketplace

```
1. Create unit via POST /v1/units
2. Update unit with marketplace info:
   PUT /v1/units
   {
     marketplace: "Climate Marketplace",
     marketplaceLink: "https://marketplace.com/units/ABC123",
     marketplaceIdentifier: "ABC123"
   }
3. Query listed units:
   GET /v1/units?hasMarketplaceIdentifier=true
```

### Workflow 2: Tokenize Unit on Chia

```
1. Create unit via POST /v1/units
2. Tokenize unit:
   PUT /v1/units
   {
     marketplace: "Tokenized on Chia",
     marketplaceIdentifier: "CHIA-TOKEN-12345"
   }
3. Query tokenized units:
   GET /v1/units?onlyTokenizedUnits=true
4. Find projects with tokenized units:
   GET /v1/projects?onlyMarketplaceProjects=true
```

### Workflow 3: Track Multiple Marketplace Listings

```
1. List unit on Marketplace A:
   PUT /v1/units { marketplaceIdentifier: "MARKET-A-001" }

2. List same unit on Marketplace B:
   PUT /v1/units { marketplaceIdentifier: "MARKET-B-001" }

3. Query by marketplace:
   GET /v1/units?marketplaceIdentifiers=MARKET-A-001,MARKET-B-001
```

---

## Summary

**Marketplace Features**:
- Allow units to be listed on external carbon credit marketplaces
- Track marketplace identifiers and links
- Filter units by marketplace status

**Tokenization Features**:
- Enable units to be tokenized on Chia blockchain
- Identify tokenized units (`marketplace='Tokenized on Chia'`)
- Filter projects with tokenized units

**Current Status**:
- ✅ Fully implemented in V1
- ❌ Not yet in V2 schema (future work)

**Impact**:
- These features enable carbon credit trading and blockchain integration
- Not critical for core registry functionality
- Can be added to V2 when needed via schema migration

---

**Document Generated**: 2025-11-21
**Based on**: V1 codebase analysis (`src/models/units/`, `src/controllers/units.controller.js`, `src/controllers/project.controller.js`)

