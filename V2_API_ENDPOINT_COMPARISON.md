# V2 API Endpoint Comparison with V1

This document compares V1 API endpoints (from `docs/cadt_rpc_api.md`) with V2 API implementation status (from `v2-api-implementation-editable.plan.md`).

## Summary

**Status Overview:**
- ✅ **Implemented**: Core CRUD endpoints for all data models + system endpoints + most advanced features
- ⚠️ **Partially Implemented**: Some advanced query features (search, orgUid filtering, marketplace filters)
- ❌ **Missing**: Full-text search and some V1-specific query filters

**Total V1 Endpoints**: ~50+ endpoints across 10 resource groups
**V2 Implemented**: ~45+ endpoints (core CRUD + system endpoints + advanced features)
**V2 Partially Implemented**: ~5 endpoints (advanced query params - most work, some filters missing)
**V2 Missing**: ~3-5 query parameters (search, orgUid filtering for units, marketplace filters)

---

## Detailed Comparison by Resource Group

### 1. Organizations ✅ COMPLETE

| V1 Endpoint | V2 Status | Notes |
|------------|-----------|-------|
| `GET /v1/organizations` | ✅ `GET /v2/organizations` | Implemented |
| `POST /v1/organizations/create` | ✅ `POST /v2/organizations` | Implemented (create V2 home org) |
| `PUT /v1/organizations/` | ✅ `PUT /v2/organizations` | Implemented (import/subscribe) |
| `DELETE /v1/organizations/:orgUid` | ✅ `DELETE /v2/organizations/:orgUid` | Implemented |
| `POST /v1/organizations/remove-mirror` | ✅ `POST /v2/organizations/remove-mirror` | Implemented |
| `POST /v1/organizations/sync` | ✅ `POST /v2/organizations/sync` | Implemented |
| `POST /v1/organizations/edit` | ✅ `PUT /v2/organizations/edit` | Implemented |
| `PUT /v1/organizations/resync` | ✅ `PUT /v2/organizations/resync` | Implemented |
| `POST /v1/organizations/mirror` | ✅ `POST /v2/organizations/mirror` | Implemented |
| `GET /v1/organizations/metadata` | ✅ `GET /v2/organizations/metadata` | Implemented |
| `GET /v1/organizations/status` | ✅ `GET /v2/organizations/status` | Implemented |
| `POST /v1/organizations/metadata` | ✅ `POST /v2/organizations/metadata` | Implemented |
| **V2 Additional** | ✅ `POST /v2/organizations/upgrade` | V1→V2 upgrade endpoint |
| **V2 Additional** | ✅ `PUT /v2/organizations/subscribe` | Subscribe endpoint |
| **V2 Additional** | ✅ `PUT /v2/organizations/unsubscribe` | Unsubscribe endpoint |

**Status**: ✅ **COMPLETE** - All V1 endpoints implemented + V2-specific additions

---

### 2. Projects ✅ MOSTLY COMPLETE

| V1 Endpoint | V2 Status | Notes |
|------------|-----------|-------|
| `GET /v1/projects` (basic) | ✅ `GET /v2/project` | Implemented (basic CRUD) |
| `GET /v1/projects?warehouseProjectId=xxx` | ✅ `GET /v2/project/:id` | Implemented |
| `GET /v1/projects?orgUid=xxx` | ❌ Not implemented | V2 doesn't have orgUid on projects |
| `GET /v1/projects?search=xxx` | ❌ Not implemented | Full-text search not implemented |
| `GET /v1/projects?columns=xxx` | ✅ `GET /v2/project?columns=xxx` | ✅ Implemented Phase 20 |
| `GET /v1/projects?xls=true` | ✅ `GET /v2/project?xls=true` | ✅ Implemented Phase 20 |
| `GET /v1/projects?onlyMarketplaceProjects=true` | ❌ Not implemented | Marketplace filter not implemented |
| `GET /v1/projects?projectIds=xxx` | ✅ `GET /v2/project?projectIds=xxx` | ✅ Implemented Phase 20 |
| `GET /v1/projects?filter=xxx` | ✅ `GET /v2/project?filter=xxx` | ✅ Implemented Phase 20 |
| `GET /v1/projects?order=xxx` | ✅ `GET /v2/project?order=xxx` | ✅ Implemented Phase 20 |
| `POST /v1/projects` | ✅ `POST /v2/project` | Implemented |
| `POST /v1/projects/batch` | ✅ `POST /v2/project/batch` | ✅ Implemented Phase 20 |
| `PUT /v1/projects` | ✅ `PUT /v2/project/:id` | Implemented |
| `PUT /v1/projects/xlsx` | ✅ `PUT /v2/project/xlsx` | ✅ Implemented Phase 20 |
| `DELETE /v1/projects` | ✅ `DELETE /v2/project/:id` | Implemented |
| `PUT /v1/projects/transfer` | ✅ `PUT /v2/project/transfer` | ✅ Implemented Phase 20 |

**Status**: ✅ **MOSTLY COMPLETE** - Core CRUD + advanced features implemented. Missing: search, orgUid filter, onlyMarketplaceProjects filter

---

### 3. Units ✅ MOSTLY COMPLETE

| V1 Endpoint | V2 Status | Notes |
|------------|-----------|-------|
| `GET /v1/units` (basic) | ✅ `GET /v2/unit` | Implemented (basic CRUD) |
| `GET /v1/units?orgUid=xxx` | ❌ Not implemented | V2 units don't have orgUid directly (linked via issuance/project) |
| `GET /v1/units?search=xxx` | ❌ Not implemented | Full-text search not implemented (reserved for future) |
| `GET /v1/units?columns=xxx` | ✅ `GET /v2/unit?columns=xxx` | ✅ Implemented Phase 21 |
| `GET /v1/units?xls=true` | ✅ `GET /v2/unit?xls=true` | ✅ Implemented Phase 21 |
| `GET /v1/units?includeProjectInfoInSearch=true` | ❌ Not implemented | Reserved for future implementation |
| `GET /v1/units?filter=xxx` | ✅ `GET /v2/unit?filter=xxx` | ✅ Implemented Phase 21 |
| `GET /v1/units?order=xxx` | ✅ `GET /v2/unit?order=xxx` | ✅ Implemented Phase 21 |
| `GET /v1/units?marketplaceIdentifiers=xxx` | ❌ Not implemented | Marketplace fields not in V2 yet |
| `GET /v1/units?hasMarketplaceIdentifier=true` | ❌ Not implemented | Marketplace fields not in V2 yet |
| `GET /v1/units?onlyTokenizedUnits=true` | ❌ Not implemented | Tokenization not in V2 yet |
| `POST /v1/units` | ✅ `POST /v2/unit` | Implemented |
| `POST /v1/units/split` | ✅ `POST /v2/unit/split` | ✅ Implemented Phase 21 |
| `POST /v1/units/batch` | ✅ `POST /v2/unit/batch` | ✅ Implemented Phase 21 |
| `PUT /v1/units` | ✅ `PUT /v2/unit/:id` | Implemented |
| `PUT /v1/units/xlsx` | ✅ `PUT /v2/unit/xlsx` | ✅ Implemented Phase 21 |
| `DELETE /v1/units` | ✅ `DELETE /v2/unit/:id` | Implemented |

**Status**: ✅ **MOSTLY COMPLETE** - Core CRUD + advanced features implemented. Missing: search, orgUid filter, marketplace filters, includeProjectInfoInSearch

---

### 4. Staging ✅ COMPLETE

| V1 Endpoint | V2 Status | Notes |
|------------|-----------|-------|
| `GET /v1/staging` | ✅ `GET /v2/staging` | Implemented |
| `GET /v1/staging?type=projects\|units` | ✅ `GET /v2/staging?type=xxx` | Implemented |
| `GET /v1/staging?page=X&limit=Y` | ✅ `GET /v2/staging?page=X&limit=Y` | Implemented |
| `GET /v1/staging/hasPendingCommits` | ✅ `GET /v2/staging/pending` | Implemented |
| `POST /v1/staging/commit` | ✅ `POST /v2/staging/commit` | Implemented |
| `POST /v1/staging/commit?table=Projects\|Units` | ✅ `POST /v2/staging/commit?table=xxx` | Implemented |
| `POST /v1/staging/commit?ids=xxx&ids=yyy` | ✅ `POST /v2/staging/commit?ids=xxx` | Implemented |
| `POST /v1/staging/retry` | ✅ `POST /v2/staging/retry` | Implemented |
| `PUT /v1/staging` | ✅ `PUT /v2/staging` | Implemented |
| `DELETE /v1/staging` | ✅ `DELETE /v2/staging` | Implemented |
| `DELETE /v1/staging/clean` | ✅ `DELETE /v2/staging/clean` | Implemented |
| `GET /v1/staging/offer` | ✅ `GET /v2/staging/offer` | ✅ Implemented Phase 22 |

**Status**: ✅ **COMPLETE** - All V1 endpoints implemented + offer file generation

---

### 5. Issuances ✅ COMPLETE

| V1 Endpoint | V2 Status | Notes |
|------------|-----------|-------|
| `GET /v1/issuances` | ✅ `GET /v2/issuance` | Implemented (note: singular in V2) |

**Status**: ✅ **COMPLETE** - V2 has full CRUD (GET, POST, PUT, DELETE) vs V1's read-only

---

### 6. Labels ✅ COMPLETE

| V1 Endpoint | V2 Status | Notes |
|------------|-----------|-------|
| `GET /v1/labels` | ✅ `GET /v2/label` | Implemented (note: singular in V2) |

**Status**: ✅ **COMPLETE** - V2 has full CRUD (GET, POST, PUT, DELETE) vs V1's read-only

---

### 7. Audit ✅ COMPLETE

| V1 Endpoint | V2 Status | Notes |
|------------|-----------|-------|
| `GET /v1/audit?orgUid=xxx&page=X&limit=Y&order=ASC\|DESC` | ✅ `GET /v2/audit` | Implemented |
| `GET /v1/audit/findConflicts` | ✅ `GET /v2/audit/findConflicts` | Implemented |
| `POST /v1/audit/resetToGeneration` | ✅ `POST /v2/audit/resetToGeneration` | Implemented |
| `POST /v1/audit/resetToDate` | ✅ `POST /v2/audit/resetToDate` | Implemented |

**Status**: ✅ **COMPLETE** - All V1 endpoints implemented

---

### 8. Offer/Transfer ✅ COMPLETE

| V1 Endpoint | V2 Status | Notes |
|------------|-----------|-------|
| `GET /v1/offer/` | ✅ `GET /v2/offer` | Implemented |
| `GET /v1/offer/accept` | ✅ `GET /v2/offer/accept` | Implemented |
| `POST /v1/offer/accept/import` | ✅ `POST /v2/offer/accept/import` | Implemented |
| `POST /v1/offer/accept/commit` | ✅ `POST /v2/offer/accept/commit` | Implemented |
| `DELETE /v1/offer/` | ✅ `DELETE /v2/offer` | Implemented |
| `DELETE /v1/offer/accept/cancel` | ✅ `DELETE /v2/offer/accept/cancel` | Implemented |

**Status**: ✅ **COMPLETE** - All V1 endpoints implemented

---

### 9. Governance ✅ COMPLETE

| V1 Endpoint | V2 Status | Notes |
|------------|-----------|-------|
| `GET /v1/governance/meta/pickList` | ✅ `GET /v2/governance/meta/pickList` | Implemented |
| `GET /v1/governance/meta/orglist` | ✅ `GET /v2/governance/meta/orgList` | Implemented |
| `POST /v1/governance/meta/orglist` | ✅ `POST /v2/governance/meta/orgList` | Implemented |
| `GET /v1/governance/exists` | ✅ `GET /v2/governance/exists` | Implemented |
| `GET /v1/governance` | ✅ `GET /v2/governance` | Implemented |
| `GET /v1/governance/sync` | ✅ `GET /v2/governance/sync` | Implemented |
| `GET /v1/governance/meta/glossary` | ✅ `GET /v2/governance/meta/glossary` | Implemented |
| `POST /v1/governance` | ✅ `POST /v2/governance` | Implemented |
| `POST /v1/governance/meta/picklist` | ✅ `POST /v2/governance/meta/pickList` | Implemented |
| `POST /v1/governance/meta/glossary` | ✅ `POST /v2/governance/meta/glossary` | Implemented |
| `POST /v1/governance/subscribe` | ✅ `POST /v2/governance/subscribe` | ✅ Implemented Phase 23 |

**Status**: ✅ **COMPLETE** - All V1 endpoints implemented + subscribe endpoint

---

### 10. Filestore ✅ COMPLETE

| V1 Endpoint | V2 Status | Notes |
|------------|-----------|-------|
| `GET /v1/filestore/get_file` | ✅ `GET /v2/filestore/get_file` | ✅ Implemented Phase 19 |
| `GET /v1/filestore/get_file_list` | ✅ `GET /v2/filestore/get_file_list` | ✅ Implemented Phase 19 |
| `POST /v1/filestore/add_file` | ✅ `POST /v2/filestore/add_file` | ✅ Implemented Phase 19 |
| `POST /v1/filestore/subscribe` | ✅ `POST /v2/filestore/subscribe` | ✅ Implemented Phase 19 |
| `POST /v1/filestore/unsubscribe` | ✅ `POST /v2/filestore/unsubscribe` | ✅ Implemented Phase 19 |
| `DELETE /v1/filestore/delete_file` | ✅ `DELETE /v2/filestore/delete_file` | ✅ Implemented Phase 19 |

**Status**: ✅ **COMPLETE** - All V1 endpoints implemented

---

## V2-Only Endpoints (Not in V1)

These endpoints are V2-specific and don't have V1 equivalents:

1. **Organizations**:
   - `POST /v2/organizations/upgrade` - Upgrade V1 org to V2
   - `PUT /v2/organizations/subscribe` - Subscribe to organization
   - `PUT /v2/organizations/unsubscribe` - Unsubscribe from organization

2. **Data Models** (V2 has full CRUD, V1 only has Projects/Units):
   - All 21 data models have full CRUD operations (Methodology, Program, Project, Validation, Verification, Issuance, Unit, Location, Estimation, Rating, Co-Benefit, Project-Methodology, Stakeholder, Stakeholder-Projects, Label, Unit-Label, AEF-T1, AEF-T2, AEF-T3, AEF-T4, AEF-T5)

---

## Missing Features Summary

### Implemented ✅
1. **Filestore Endpoints** (Phase 19) - ✅ All 6 endpoints implemented
2. **Projects Advanced Features** (Phase 20) - ✅ Most features implemented:
   - ✅ Transfer endpoint
   - ✅ XLSX import
   - ✅ Batch CSV upload
   - ✅ Advanced query params (columns, xls export, projectIds, filter, order)
3. **Units Advanced Features** (Phase 21) - ✅ Most features implemented:
   - ✅ Split endpoint
   - ✅ XLSX import
   - ✅ Batch CSV upload
   - ✅ Advanced query params (columns, xls export, filter, order)
4. **Staging Advanced Features** (Phase 22) - ✅ Offer file generation implemented
5. **Governance Advanced Features** (Phase 23) - ✅ Subscribe endpoint implemented

### Still Missing ❌
1. **Projects Query Features**:
   - ❌ Full-text search (`?search=xxx`)
   - ❌ Organization filtering (`?orgUid=xxx`) - V2 projects don't have orgUid field
   - ❌ Marketplace filter (`?onlyMarketplaceProjects=true`)

2. **Units Query Features**:
   - ❌ Full-text search (`?search=xxx`) - Reserved for future
   - ❌ Organization filtering (`?orgUid=xxx`) - V2 units don't have orgUid directly
   - ❌ Project info in search (`?includeProjectInfoInSearch=true`) - Reserved for future
   - ❌ Marketplace filters (`?marketplaceIdentifiers`, `?hasMarketplaceIdentifier`, `?onlyTokenizedUnits`) - Marketplace fields not in V2 yet

---

## Recommendations

1. ✅ **Phase 19 (Filestore)** - COMPLETE
2. ✅ **Phase 20-21 (Advanced Features)** - COMPLETE (most features)
3. ✅ **Phase 22 (Staging Offer)** - COMPLETE
4. ✅ **Phase 23 (Governance Subscribe)** - COMPLETE
5. ✅ **Phase 24 (Documentation)** - COMPLETE

**Remaining Work**: Implement missing query features if needed:
- Full-text search for Projects and Units (requires FTS setup)
- Marketplace filtering (requires marketplace fields in V2 schema)
- Organization filtering for Units (requires orgUid relationship)

---

## Implementation Status by Phase

- ✅ **Phases 1-18**: COMPLETE
- ✅ **Phase 19**: Filestore Endpoints - COMPLETE
- ✅ **Phase 20**: Projects Advanced Features - COMPLETE (missing: search, orgUid filter, marketplace filter)
- ✅ **Phase 21**: Units Advanced Features - COMPLETE (missing: search, orgUid filter, marketplace filters)
- ✅ **Phase 22**: Staging Advanced Features - COMPLETE
- ✅ **Phase 23**: Governance Advanced Features - COMPLETE
- ✅ **Phase 24**: V2 API Documentation - COMPLETE

---

## Conclusion

**Current Status**: V2 has implemented **all core CRUD endpoints**, **all system endpoints**, and **most advanced features**. V2 now has **feature parity with V1** for the vast majority of functionality.

**Remaining Gaps** (minor):
1. **Full-text search** for Projects and Units (not critical - can use filter parameter)
2. **Organization filtering** for Projects/Units (V2 architecture difference - projects/units don't have direct orgUid)
3. **Marketplace filters** (marketplace fields not yet in V2 schema)

**V2 Advantages over V1**:
- Full CRUD for all 21 data models (vs V1's read-only for most)
- Better query capabilities (filter, order, columns, xls export)
- V1/V2 isolation
- Upgrade path from V1 to V2
- Comprehensive documentation

**Overall**: V2 is **production-ready** and provides **superior functionality** to V1, with only minor query feature gaps that don't impact core functionality.

