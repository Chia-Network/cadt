# V1 vs V2 API Endpoint Comparison

This document compares all V1 API endpoints to V2 API endpoints to identify missing functionality.

## Summary

**V1 Resources**: 10 resource types
**V2 Resources**: 24 resource types (includes many new data models)

**Missing in V2**:
- Audit endpoints (3 endpoints)
- Offer endpoints (6 endpoints)
- Filestore endpoints (5 endpoints)
- Projects advanced features (batch upload, transfer, xlsx import)
- Units advanced features (split, batch upload, xlsx import)
- Staging offer file generation
- Governance subscribe endpoint

---

## Detailed Comparison by Resource

### 1. Organizations

| Endpoint | V1 | V2 | Status |
|----------|----|----|--------|
| GET / | ✅ | ✅ | ✅ Covered |
| POST / | ✅ | ✅ | ✅ Covered |
| POST /create | ✅ | ✅ | ✅ Covered (as POST / with file upload) |
| POST /edit | ✅ | ✅ | ✅ Covered (as PUT /edit) |
| PUT / | ✅ | ✅ | ✅ Covered (import) |
| PUT /subscribe | ✅ | ✅ | ✅ Covered |
| PUT /unsubscribe | ✅ | ✅ | ✅ Covered |
| PUT /resync | ✅ | ✅ | ✅ Covered |
| POST /mirror | ✅ | ✅ | ✅ Covered |
| POST /remove-mirror | ✅ | ✅ | ✅ Covered |
| GET /metadata | ✅ | ✅ | ✅ Covered |
| POST /metadata | ✅ | ✅ | ✅ Covered |
| GET /status | ✅ | ✅ | ✅ Covered |
| DELETE /:orgUid | ✅ | ✅ | ✅ Covered |
| POST /sync | ✅ | ✅ | ✅ Covered |
| POST /upgrade | ❌ | ✅ | ✅ V2-only feature |

**Status**: ✅ Fully covered (V2 has additional upgrade endpoint)

---

### 2. Projects

| Endpoint | V1 | V2 | Status |
|----------|----|----|--------|
| GET / (with query params) | ✅ | ✅ | ⚠️ **PARTIAL** - V2 missing advanced query features |
| POST / | ✅ | ✅ | ✅ Covered |
| PUT / | ✅ | ✅ | ✅ Covered (as PUT /:id) |
| PUT /transfer | ✅ | ❌ | ❌ **MISSING** |
| PUT /xlsx | ✅ | ❌ | ❌ **MISSING** |
| DELETE / | ✅ | ✅ | ✅ Covered (as DELETE /:id) |
| POST /batch | ✅ | ❌ | ❌ **MISSING** |

**V1 GET / Query Parameters**:
- `warehouseProjectId` - Get single project
- `orgUid` - Filter by organization
- `search` - Full-text search
- `columns` - Select specific columns
- `limit` - Pagination limit
- `page` - Pagination page
- `xls` - Export to Excel
- `onlyMarketplaceProjects` - Filter marketplace projects
- `projectIds` - Filter by project IDs
- `filter` - Generic filter (e.g., `filter=field:value:eq`)
- `order` - Sort order (e.g., `order=field:DESC`)

**V2 GET / Query Parameters**:
- `page` - Pagination page
- `limit` - Pagination limit

**Status**: ⚠️ Missing advanced features:
- Project transfer between organizations
- XLSX file import/update
- Batch CSV upload
- **Advanced query features**: search, orgUid filtering, column selection, xls export, generic filtering, sorting, marketplace filtering

---

### 3. Units

| Endpoint | V1 | V2 | Status |
|----------|----|----|--------|
| GET / (with query params) | ✅ | ✅ | ⚠️ **PARTIAL** - V2 missing advanced query features |
| POST / | ✅ | ✅ | ✅ Covered |
| PUT / | ✅ | ✅ | ✅ Covered (as PUT /:id) |
| PUT /xlsx | ✅ | ❌ | ❌ **MISSING** |
| DELETE / | ✅ | ✅ | ✅ Covered (as DELETE /:id) |
| POST /split | ✅ | ❌ | ❌ **MISSING** |
| POST /batch | ✅ | ❌ | ❌ **MISSING** |

**V1 GET / Query Parameters**:
- `warehouseUnitId` - Get single unit
- `orgUid` - Filter by organization
- `search` - Full-text search
- `columns` - Select specific columns
- `limit` - Pagination limit
- `page` - Pagination page
- `xls` - Export to Excel
- `includeProjectInfoInSearch` - Include project info in search
- `marketplaceIdentifiers` - Filter by marketplace identifiers
- `hasMarketplaceIdentifier` - Filter units with marketplace identifiers
- `onlyTokenizedUnits` - Filter tokenized units
- `filter` - Generic filter (e.g., `filter=field:value:eq`)
- `order` - Sort order (e.g., `order=field:DESC`)

**V2 GET / Query Parameters**:
- `page` - Pagination page
- `limit` - Pagination limit

**Status**: ⚠️ Missing advanced features:
- Unit splitting functionality
- XLSX file import/update
- Batch CSV upload
- **Advanced query features**: search, orgUid filtering, column selection, xls export, generic filtering, sorting, marketplace filtering, project info in search

---

### 4. Staging

| Endpoint | V1 | V2 | Status |
|----------|----|----|--------|
| GET / (with query params: page, limit, type, table) | ✅ | ✅ | ✅ Covered |
| GET /offer | ✅ | ❌ | ❌ **MISSING** |
| GET /hasPendingTransactions | ✅ | ✅ | ✅ Covered (as GET /pending) |
| PUT / | ✅ | ✅ | ✅ Covered |
| POST /retry | ✅ | ✅ | ✅ Covered |
| POST /commit | ✅ | ✅ | ✅ Covered |
| DELETE / | ✅ | ✅ | ✅ Covered |
| DELETE /clean | ✅ | ✅ | ✅ Covered |

**Status**: ⚠️ Missing:
- Offer file generation from staging

**V2 Has**: All core staging operations except offer file generation

---

### 5. Issuances

| Endpoint | V1 | V2 | Status |
|----------|----|----|--------|
| GET / | ✅ | ✅ | ✅ Covered (plus full CRUD) |

**Status**: ✅ V2 has more functionality (full CRUD vs read-only in V1)

**V2 Has**: POST /, GET /, GET /:id, PUT /:id, DELETE /:id

---

### 6. Labels

| Endpoint | V1 | V2 | Status |
|----------|----|----|--------|
| GET / | ✅ | ✅ | ✅ Covered (plus full CRUD) |

**Status**: ✅ V2 has more functionality (full CRUD vs read-only in V1)

**V2 Has**: POST /, GET /, GET /:id, PUT /:id, DELETE /:id

---

### 7. Audit

| Endpoint | V1 | V2 | Status |
|----------|----|----|--------|
| GET / (with query params: orgUid, order, limit, page) | ✅ | ❌ | ❌ **MISSING** |
| GET /findConflicts | ✅ | ❌ | ❌ **MISSING** |
| POST /resetToGeneration | ✅ | ❌ | ❌ **MISSING** |
| POST /resetToDate | ✅ | ❌ | ❌ **MISSING** |

**Status**: ❌ **COMPLETELY MISSING** - No audit functionality in V2

---

### 8. Offer

| Endpoint | V1 | V2 | Status |
|----------|----|----|--------|
| GET / | ✅ | ❌ | ❌ **MISSING** |
| GET /accept | ✅ | ❌ | ❌ **MISSING** |
| POST /accept/import | ✅ | ❌ | ❌ **MISSING** |
| POST /accept/commit | ✅ | ❌ | ❌ **MISSING** |
| DELETE / | ✅ | ❌ | ❌ **MISSING** |
| DELETE /accept/cancel | ✅ | ❌ | ❌ **MISSING** |

**Status**: ❌ **COMPLETELY MISSING** - No offer/transfer functionality in V2

---

### 9. Governance

| Endpoint | V1 | V2 | Status |
|----------|----|----|--------|
| GET / | ✅ | ✅ | ✅ Covered |
| GET /exists | ✅ | ✅ | ✅ Covered |
| GET /sync | ✅ | ✅ | ✅ Covered |
| GET /meta/orgList | ✅ | ✅ | ✅ Covered |
| GET /meta/pickList | ✅ | ✅ | ✅ Covered |
| GET /meta/glossary | ✅ | ✅ | ✅ Covered |
| POST / | ✅ | ✅ | ✅ Covered |
| POST /meta/orgList | ✅ | ✅ | ✅ Covered |
| POST /meta/pickList | ✅ | ✅ | ✅ Covered |
| POST /meta/glossary | ✅ | ✅ | ✅ Covered |
| POST /subscribe | ✅ | ❌ | ❌ **MISSING** |

**Status**: ⚠️ Missing:
- Subscribe to governance body endpoint

---

### 10. Filestore

| Endpoint | V1 | V2 | Status |
|----------|----|----|--------|
| GET /get_file | ✅ | ❌ | ❌ **MISSING** |
| GET /get_file_list | ✅ | ❌ | ❌ **MISSING** |
| POST /add_file | ✅ | ❌ | ❌ **MISSING** |
| POST /subscribe | ✅ | ❌ | ❌ **MISSING** |
| POST /unsubscribe | ✅ | ❌ | ❌ **MISSING** |
| DELETE /delete_file | ✅ | ❌ | ❌ **MISSING** |

**Status**: ❌ **COMPLETELY MISSING** - No filestore functionality in V2

---

## V2-Only Resources (Not in V1)

V2 has many new data model endpoints that don't exist in V1:

1. **Methodology** - Full CRUD (5 endpoints)
2. **Program** - Full CRUD (5 endpoints)
3. **Validation** - Full CRUD (5 endpoints)
4. **Verification** - Full CRUD (5 endpoints)
5. **Location** - Full CRUD (5 endpoints)
6. **Estimation** - Full CRUD (5 endpoints)
7. **Rating** - Full CRUD (5 endpoints)
8. **Co-Benefit** - Full CRUD (5 endpoints)
9. **Project-Methodology** - Full CRUD (5 endpoints)
10. **Stakeholder** - Full CRUD (5 endpoints)
11. **Stakeholder-Projects** - Full CRUD (5 endpoints)
12. **Unit-Label** - Full CRUD (5 endpoints)
13. **AEF-T1-Submission** - Full CRUD (5 endpoints)
14. **AEF-T5-Authorized-Entities** - Full CRUD (5 endpoints)
15. **AEF-T2-Authorizations** - Full CRUD (5 endpoints)
16. **AEF-T3-Actions** - Full CRUD (5 endpoints)
17. **AEF-T4-Holdings** - Full CRUD (5 endpoints)
18. **Health Check** - GET /health (1 endpoint)

---

## Summary of Missing Functionality in V2

### Critical Missing Features (Complete Resource Missing):

1. **Audit** (4 endpoints)
   - GET / - Get audit history (with query params: orgUid, order, limit, page)
   - GET /findConflicts - Find conflicts
   - POST /resetToGeneration - Reset to generation
   - POST /resetToDate - Reset to date

2. **Offer** (6 endpoints)
   - GET / - Generate offer file
   - GET /accept - Get current offer info
   - POST /accept/import - Import offer file
   - POST /accept/commit - Commit imported offer
   - DELETE / - Cancel active offer
   - DELETE /accept/cancel - Reject imported offer

3. **Filestore** (6 endpoints)
   - GET /get_file - Get file by ID
   - GET /get_file_list - List files
   - POST /add_file - Add file to filestore
   - POST /subscribe - Subscribe to filestore
   - POST /unsubscribe - Unsubscribe from filestore
   - DELETE /delete_file - Delete file

### Partial Missing Features (Advanced Operations):

4. **Projects Advanced Features** (3 endpoints + query parameters)
   - PUT /transfer - Transfer project between organizations
   - PUT /xlsx - Update projects from XLSX file
   - POST /batch - Batch upload from CSV
   - **Query Parameters Missing**: search, orgUid, columns, xls, onlyMarketplaceProjects, projectIds, filter, order

5. **Units Advanced Features** (3 endpoints + query parameters)
   - POST /split - Split units
   - PUT /xlsx - Update units from XLSX file
   - POST /batch - Batch upload from CSV
   - **Query Parameters Missing**: search, orgUid, columns, xls, includeProjectInfoInSearch, marketplaceIdentifiers, hasMarketplaceIdentifier, onlyTokenizedUnits, filter, order

6. **Staging Advanced Features** (1 endpoint)
   - GET /offer - Generate offer file from staging

7. **Governance Advanced Features** (1 endpoint)
   - POST /subscribe - Subscribe to governance body

---

## Total Missing Endpoints

**Complete Resources Missing**: 3 (Audit, Offer, Filestore) = 16 endpoints
**Advanced Features Missing**: 8 endpoints
**Advanced Query Features Missing**: Projects and Units GET endpoints have limited query capabilities

**Total Missing Endpoints**: 24 endpoints
**Total Missing Query Features**: ~15 query parameters across Projects and Units

---

## Recommendations

### High Priority:
1. **Audit functionality** (critical for data integrity and history tracking)
   - GET / - Get audit history
   - GET /findConflicts - Find conflicts
   - POST /resetToGeneration - Reset to generation
   - POST /resetToDate - Reset to date

2. **Offer/Transfer functionality** (critical for project transfers between organizations)
   - All 6 offer endpoints

3. **Advanced Query Features for Projects and Units**
   - Full-text search
   - Organization filtering (orgUid)
   - Column selection
   - Excel export (xls)
   - Generic filtering
   - Sorting
   - Marketplace filtering

### Medium Priority:
4. **Filestore functionality** (if file storage is needed)
   - All 6 filestore endpoints

5. **Projects/Units batch operations**
   - XLSX file import/update
   - CSV batch upload
   - Project transfer between organizations

### Low Priority:
6. **Unit splitting** (if still needed)
7. **Governance subscribe** (if governance subscription is needed)
8. **Staging offer file generation** (if offer generation from staging is needed)

