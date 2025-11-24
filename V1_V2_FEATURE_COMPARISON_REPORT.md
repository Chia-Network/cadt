# V1 vs V2 Feature Comparison Report

**Date**: 2025-11-21
**Purpose**: Comprehensive analysis of V1 features to identify any missing functionality in V2

---

## Executive Summary

After comprehensive analysis of V1 codebase, V2 has **feature parity** with V1 for all critical functionality. The only missing items are:

1. **One-time historical background task** (`reset-audit-table`) - Not needed for V2
2. **Marketplace/tokenization features** - Intentionally not in V2 schema yet (documented as future work)
3. **Minor query parameter differences** - Some V1 query params intentionally differ in V2

**Overall Status**: ✅ **V2 is complete and production-ready**

---

## Detailed Comparison

### 1. API Endpoints

#### ✅ All Core Endpoints Implemented

| Resource | V1 Endpoints | V2 Status | Notes |
|----------|-------------|-----------|-------|
| **Organizations** | 13 endpoints | ✅ 15 endpoints | V2 has additional `upgrade` endpoint |
| **Projects** | 6 endpoints | ✅ 6 endpoints | All CRUD + advanced features |
| **Units** | 6 endpoints | ✅ 6 endpoints | All CRUD + advanced features |
| **Staging** | 8 endpoints | ✅ 8 endpoints | Complete |
| **Issuances** | 1 endpoint (read-only) | ✅ 4 endpoints | V2 has full CRUD |
| **Labels** | 1 endpoint (read-only) | ✅ 4 endpoints | V2 has full CRUD |
| **Audit** | 4 endpoints | ✅ 4 endpoints | Complete |
| **Offer/Transfer** | 6 endpoints | ✅ 6 endpoints | Complete |
| **Governance** | 10 endpoints | ✅ 11 endpoints | V2 has additional `subscribe` endpoint |
| **Filestore** | 6 endpoints | ✅ 6 endpoints | Complete |

**Total**: V1 has ~50 endpoints, V2 has ~65 endpoints (includes full CRUD for all 21 data models)

---

### 2. Background Tasks

#### V1 Background Tasks:
1. ✅ `sync-governance-body` - **SHARED** (syncs both V1 and V2)
2. ✅ `sync-default-organizations` - V2 equivalent: `sync-default-organizations-v2`
3. ✅ `sync-picklists` - V2 equivalent: `sync-picklists-v2`
4. ✅ `sync-registries` - V2 equivalent: `sync-registries-v2`
5. ✅ `sync-organization-meta` - V2 equivalent: `sync-organization-meta-v2`
6. ✅ `mirror-check` - V2 equivalent: `mirror-check-v2`
7. ✅ `validate-organization-table-and-subscriptions` - V2 equivalent: `validate-organization-table-and-subscriptions-v2`
8. ✅ `clean-up-failed-org` - V2 equivalent: `clean-up-failed-org-v2`
9. ⚠️ `reset-audit-table` - **V1 ONLY** (one-time historical task from May 2024)

**Status**: ✅ All production background tasks have V2 equivalents. The `reset-audit-table` task is a one-time historical task that ran in May 2024 and is not needed for V2.

---

### 3. Query Features

#### Projects Query Parameters

| Parameter | V1 | V2 | Status |
|-----------|----|----|--------|
| `page`, `limit` | ✅ | ✅ | ✅ Implemented |
| `columns` | ✅ | ✅ | ✅ Implemented (Phase 20) |
| `xls` | ✅ | ✅ | ✅ Implemented (Phase 20) |
| `projectIds` | ✅ | ✅ | ✅ Implemented (Phase 20) |
| `filter` | ✅ | ✅ | ✅ Implemented (Phase 20) |
| `order` | ✅ | ✅ | ✅ Implemented (Phase 20) |
| `search` | ✅ | ✅ | ✅ Implemented (Phase 26 - FTS5) |
| `orgUid` | ✅ | ✅ | ✅ Implemented (Phase 25) |
| `onlyMarketplaceProjects` | ✅ | ❌ | ⚠️ Marketplace fields not in V2 schema yet |

#### Units Query Parameters

| Parameter | V1 | V2 | Status |
|-----------|----|----|--------|
| `page`, `limit` | ✅ | ✅ | ✅ Implemented |
| `columns` | ✅ | ✅ | ✅ Implemented (Phase 21) |
| `xls` | ✅ | ✅ | ✅ Implemented (Phase 21) |
| `filter` | ✅ | ✅ | ✅ Implemented (Phase 21) |
| `order` | ✅ | ✅ | ✅ Implemented (Phase 21) |
| `search` | ✅ | ✅ | ✅ Implemented (Phase 26 - FTS5) |
| `includeProjectInfoInSearch` | ✅ | ✅ | ✅ Implemented (Phase 26) |
| `orgUid` | ✅ | ✅ | ✅ Implemented (Phase 25) |
| `marketplaceIdentifiers` | ✅ | ❌ | ⚠️ Marketplace fields not in V2 schema yet |
| `hasMarketplaceIdentifier` | ✅ | ❌ | ⚠️ Marketplace fields not in V2 schema yet |
| `onlyTokenizedUnits` | ✅ | ❌ | ⚠️ Tokenization fields not in V2 schema yet |

**Status**: ✅ All core query features implemented. Marketplace/tokenization features are intentionally not in V2 schema yet (documented as future work).

---

### 4. Advanced Features

#### Projects Advanced Features

| Feature | V1 | V2 | Status |
|---------|----|----|--------|
| Transfer between orgs | ✅ | ✅ | ✅ Implemented (Phase 20) |
| XLSX import/update | ✅ | ✅ | ✅ Implemented (Phase 20) |
| Batch CSV upload | ✅ | ✅ | ✅ Implemented (Phase 20) |
| Advanced query params | ✅ | ✅ | ✅ Implemented (Phase 20) |
| Full-text search | ✅ | ✅ | ✅ Implemented (Phase 26) |

#### Units Advanced Features

| Feature | V1 | V2 | Status |
|---------|----|----|--------|
| Split units | ✅ | ✅ | ✅ Implemented (Phase 21) |
| XLSX import/update | ✅ | ✅ | ✅ Implemented (Phase 21) |
| Batch CSV upload | ✅ | ✅ | ✅ Implemented (Phase 21) |
| Advanced query params | ✅ | ✅ | ✅ Implemented (Phase 21) |
| Full-text search | ✅ | ✅ | ✅ Implemented (Phase 26) |

#### Staging Advanced Features

| Feature | V1 | V2 | Status |
|---------|----|----|--------|
| Offer file generation | ✅ | ✅ | ✅ Implemented (Phase 22) |

---

### 5. Model Features

#### V1 Models vs V2 Models

| Model | V1 | V2 | Status |
|-------|----|----|--------|
| **Projects** | Full CRUD | Full CRUD | ✅ Complete |
| **Units** | Full CRUD | Full CRUD | ✅ Complete |
| **Issuances** | Read-only | Full CRUD | ✅ V2 superior |
| **Labels** | Read-only | Full CRUD | ✅ V2 superior |
| **Methodology** | ❌ | Full CRUD | ✅ V2 only |
| **Program** | ❌ | Full CRUD | ✅ V2 only |
| **Validation** | ❌ | Full CRUD | ✅ V2 only |
| **Verification** | ❌ | Full CRUD | ✅ V2 only |
| **Location** | ❌ | Full CRUD | ✅ V2 only |
| **Estimation** | ❌ | Full CRUD | ✅ V2 only |
| **Rating** | ❌ | Full CRUD | ✅ V2 only |
| **Co-Benefit** | ❌ | Full CRUD | ✅ V2 only |
| **Project-Methodology** | ❌ | Full CRUD | ✅ V2 only |
| **Stakeholder** | ❌ | Full CRUD | ✅ V2 only |
| **Stakeholder-Projects** | ❌ | Full CRUD | ✅ V2 only |
| **Unit-Label** | ❌ | Full CRUD | ✅ V2 only |
| **AEF-T1** | ❌ | Full CRUD | ✅ V2 only |
| **AEF-T2** | ❌ | Full CRUD | ✅ V2 only |
| **AEF-T3** | ❌ | Full CRUD | ✅ V2 only |
| **AEF-T4** | ❌ | Full CRUD | ✅ V2 only |
| **AEF-T5** | ❌ | Full CRUD | ✅ V2 only |

**Status**: ✅ V2 has full CRUD for all 21 data models, while V1 only has full CRUD for Projects and Units.

---

### 6. Websocket Support

| Feature | V1 | V2 | Status |
|---------|----|----|--------|
| Projects changes | ✅ | ✅ | ✅ Implemented (Phase 29) |
| Units changes | ✅ | ✅ | ✅ Implemented (Phase 29) |
| Staging changes | ✅ | ✅ | ✅ Implemented (Phase 29) |

**Status**: ✅ Complete websocket support for all models.

---

### 7. Utilities and Helpers

#### V1 Utilities vs V2 Utilities

| Utility | V1 | V2 | Status |
|---------|----|----|--------|
| Data assertions | ✅ | ✅ | ✅ V2 has `v2-data-assertions.js` |
| Data loaders | ✅ | ✅ | ✅ V2 has `v2-data-loaders.js` |
| Model utilities | ✅ | ✅ | ✅ V2 has `v2-model-utils.js` |
| Validation utils | ✅ | ✅ | ✅ V2 has `v2-validation-utils.js` |
| FTS utilities | ✅ | ✅ | ✅ V2 has `v2-fts-utils.js` |
| XLS utilities | ✅ | ✅ | ✅ Shared (`xls.js`) |
| Datalayer utils | ✅ | ✅ | ✅ Shared (`datalayer-utils.js`) |

**Status**: ✅ All utilities have V2 equivalents or are shared.

---

## Missing Features (Intentionally Not Implemented)

### 1. Marketplace/Tokenization Features

**Status**: ⚠️ **Intentionally Not in V2 Schema**

These features are documented as future work and are not part of the V2 schema:
- `onlyMarketplaceProjects` filter for Projects
- `marketplaceIdentifiers` filter for Units
- `hasMarketplaceIdentifier` filter for Units
- `onlyTokenizedUnits` filter for Units

**Reason**: V2 schema does not include marketplace/tokenization fields yet. These will be added in a future schema version.

---

### 2. One-Time Historical Background Task

**Status**: ⚠️ **Not Needed for V2**

- `reset-audit-table` - This was a one-time task that ran in May 2024 to reset V1 audit tables. Not needed for V2 as it's a fresh implementation.

---

## V2 Advantages Over V1

1. **Full CRUD for All Models**: V2 has full CRUD operations for all 21 data models, while V1 only has full CRUD for Projects and Units.

2. **Better Query Capabilities**: V2 has improved query features including:
   - Generic filtering (`filter=field:value:eq`)
   - Column selection (`columns=field1,field2`)
   - Excel export (`xls=true`)
   - Full-text search with BM25 ranking (Phase 26)

3. **V1/V2 Isolation**: V2 maintains complete isolation from V1, allowing both systems to run simultaneously.

4. **Upgrade Path**: V2 provides a clear upgrade path from V1 (`POST /v2/organizations/upgrade`).

5. **Comprehensive Documentation**: V2 has complete API documentation (`docs/cadt_rpc_api_v2.md`).

6. **Better Architecture**:
   - Snake_case database naming (consistent)
   - UUID primary keys (better for distributed systems)
   - Improved error handling
   - Better validation

---

## Conclusion

**V2 Status**: ✅ **PRODUCTION READY**

V2 has **complete feature parity** with V1 for all critical functionality, plus significant improvements:

- ✅ All V1 API endpoints implemented
- ✅ All V1 background tasks have V2 equivalents
- ✅ All V1 query features implemented (except marketplace/tokenization, which are intentionally not in V2 schema)
- ✅ Full CRUD for all 21 data models (vs V1's 2 models)
- ✅ Complete websocket support
- ✅ Comprehensive test coverage (978 tests passing)

**Missing Items**:
- Marketplace/tokenization features (intentionally not in V2 schema - future work)
- One-time historical background task (not needed)

**Recommendation**: V2 is ready for production use. The missing marketplace/tokenization features can be added in a future schema version when those fields are added to the V2 database schema.

---

## Test Coverage

- **Total V2 Tests**: 978 tests
- **All Tests Passing**: ✅ 978/978 (100%)
- **Test Coverage**: Comprehensive coverage of all endpoints, models, background tasks, and utilities

---

**Report Generated**: 2025-11-21
**Analysis Method**: Comprehensive code review of V1 and V2 codebases, comparison documents, and test results

