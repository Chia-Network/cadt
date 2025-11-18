# V2 API Endpoint Comparison with V1

This document compares V1 API endpoints (from `docs/cadt_rpc_api.md`) with V2 API implementation status (from `v2-api-implementation-editable.plan.md`).

## Summary

**Status Overview:**
- ✅ **Implemented**: Core CRUD endpoints for all data models + system endpoints
- ⏳ **Planned**: Advanced features (filestore, advanced query params, batch operations)
- ❌ **Missing**: Some advanced query features and additional resources

**Total V1 Endpoints**: ~50+ endpoints across 10 resource groups
**V2 Implemented**: ~35+ endpoints (core CRUD + system endpoints)
**V2 Planned**: ~15+ endpoints (advanced features)
**V2 Missing**: ~5-10 endpoints (mostly advanced query features)

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

### 2. Projects ⚠️ PARTIAL

| V1 Endpoint | V2 Status | Notes |
|------------|-----------|-------|
| `GET /v1/projects` (basic) | ✅ `GET /v2/project` | Implemented (basic CRUD) |
| `GET /v1/projects?warehouseProjectId=xxx` | ✅ `GET /v2/project/:id` | Implemented |
| `GET /v1/projects?orgUid=xxx` | ⏳ Planned Phase 20 | Advanced query params |
| `GET /v1/projects?search=xxx` | ⏳ Planned Phase 20 | Full-text search |
| `GET /v1/projects?columns=xxx` | ⏳ Planned Phase 20 | Column selection |
| `GET /v1/projects?xls=true` | ⏳ Planned Phase 20 | Excel export |
| `GET /v1/projects?onlyMarketplaceProjects=true` | ⏳ Planned Phase 20 | Marketplace filter |
| `POST /v1/projects` | ✅ `POST /v2/project` | Implemented |
| `POST /v1/projects/batch` | ⏳ Planned Phase 20 | Batch CSV upload |
| `PUT /v1/projects` | ✅ `PUT /v2/project/:id` | Implemented |
| `PUT /v1/projects/xlsx` | ⏳ Planned Phase 20 | XLSX import |
| `DELETE /v1/projects` | ✅ `DELETE /v2/project/:id` | Implemented |
| `PUT /v1/projects/transfer` | ⏳ Planned Phase 20 | Project transfer |

**Status**: ⚠️ **PARTIAL** - Core CRUD complete, advanced features planned in Phase 20

---

### 3. Units ⚠️ PARTIAL

| V1 Endpoint | V2 Status | Notes |
|------------|-----------|-------|
| `GET /v1/units` (basic) | ✅ `GET /v2/unit` | Implemented (basic CRUD) |
| `GET /v1/units?orgUid=xxx` | ⏳ Planned Phase 21 | Advanced query params |
| `GET /v1/units?search=xxx` | ⏳ Planned Phase 21 | Full-text search |
| `GET /v1/units?columns=xxx` | ⏳ Planned Phase 21 | Column selection |
| `GET /v1/units?xls=true` | ⏳ Planned Phase 21 | Excel export |
| `GET /v1/units?includeProjectInfoInSearch=true` | ⏳ Planned Phase 21 | Project info in search |
| `POST /v1/units` | ✅ `POST /v2/unit` | Implemented |
| `POST /v1/units/split` | ⏳ Planned Phase 21 | Unit split operation |
| `POST /v1/units/batch` | ⏳ Planned Phase 21 | Batch CSV upload |
| `PUT /v1/units` | ✅ `PUT /v2/unit/:id` | Implemented |
| `PUT /v1/units/xlsx` | ⏳ Planned Phase 21 | XLSX import |
| `DELETE /v1/units` | ✅ `DELETE /v2/unit/:id` | Implemented |

**Status**: ⚠️ **PARTIAL** - Core CRUD complete, advanced features planned in Phase 21

---

### 4. Staging ⚠️ PARTIAL

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
| `DELETE /v1/staging` | ✅ `DELETE /v2/staging` | Implemented |
| `DELETE /v1/staging/clean` | ✅ `DELETE /v2/staging/clean` | Implemented |
| `GET /v1/staging/offer` | ⏳ Planned Phase 22 | Offer file generation |

**Status**: ⚠️ **PARTIAL** - Core functionality complete, offer file generation planned in Phase 22

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

### 9. Governance ⚠️ PARTIAL

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

**Status**: ✅ **COMPLETE** - All V1 endpoints implemented

---

### 10. Filestore ❌ NOT IMPLEMENTED

| V1 Endpoint | V2 Status | Notes |
|------------|-----------|-------|
| `GET /v1/filestore/get_file` | ⏳ Planned Phase 19 | Next phase |
| `GET /v1/filestore/get_file_list` | ⏳ Planned Phase 19 | Next phase |
| `POST /v1/filestore/add_file` | ⏳ Planned Phase 19 | Next phase |
| `POST /v1/filestore/subscribe` | ⏳ Planned Phase 19 | Next phase |
| `POST /v1/filestore/unsubscribe` | ⏳ Planned Phase 19 | Next phase |
| `DELETE /v1/filestore/delete_file` | ⏳ Planned Phase 19 | Next phase |

**Status**: ❌ **NOT IMPLEMENTED** - Planned as Phase 19 (next phase)

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

## Missing Endpoints Summary

### High Priority (Core Functionality)
1. **Filestore Endpoints** (Phase 19) - 6 endpoints
   - All filestore operations are missing

### Medium Priority (Advanced Features)
2. **Projects Advanced Features** (Phase 20) - ~10 endpoints/features
   - Transfer endpoint
   - XLSX import
   - Batch CSV upload
   - Advanced query params (search, columns, xls export, onlyMarketplaceProjects)

3. **Units Advanced Features** (Phase 21) - ~10 endpoints/features
   - Split endpoint
   - XLSX import
   - Batch CSV upload
   - Advanced query params (search, columns, xls export, includeProjectInfoInSearch)

4. **Staging Advanced Features** (Phase 22) - 1 endpoint
   - Offer file generation

### Low Priority (Nice to Have)
5. **Governance Advanced Features** (Phase 23) - Already implemented
   - Sync endpoint already exists ✅

---

## Recommendations

1. **Phase 19 (Filestore)** should be prioritized as it's a complete resource group missing from V2
2. **Phase 20-21 (Advanced Features)** can be implemented incrementally as needed
3. **Phase 22 (Staging Offer)** is lower priority since offer functionality exists via `/v2/offer`
4. **Phase 24 (Documentation)** should be updated once all phases are complete

---

## Implementation Status by Phase

- ✅ **Phases 1-18**: COMPLETE
- ⏳ **Phase 19**: Filestore Endpoints - **NEXT PHASE**
- ⏳ **Phase 20**: Projects Advanced Features - Planned
- ⏳ **Phase 21**: Units Advanced Features - Planned
- ⏳ **Phase 22**: Staging Advanced Features - Planned
- ✅ **Phase 23**: Governance Advanced Features - Already implemented
- ⏳ **Phase 24**: V2 API Documentation - Planned

---

## Conclusion

**Current Status**: V2 has implemented all **core CRUD endpoints** and **system endpoints** (organizations, staging, audit, offer, governance). The main gaps are:

1. **Filestore endpoints** (complete resource group missing)
2. **Advanced query features** for Projects and Units (search, filtering, export)
3. **Batch operations** (CSV/XLSX import)
4. **Transfer/split operations** (project transfer, unit split)

All missing endpoints are accounted for in the plan (Phases 19-22), so the V2 plan is comprehensive and covers all V1 functionality.

