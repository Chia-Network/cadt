# V2 Datalayer Integration - Understanding

## How V1 Staging Commit Works

### The Process:
1. **Read Staging Table**: Get all unstaged records (commited=false)
2. **For Each Model** (Project, Unit):
   - Call `generateChangeListFromStagedData(stagedRecords, comment, author)`
   - Method extracts records for that model from stagedRecords
   - Converts to Excel format (via `createXlsFromSequelizeResults()`)
   - Converts Excel to changelist (via `transformFullXslsToChangeList()`)
   - Returns changelist for that model
3. **Merge Changelists**: Combine all model changelists into one unified list
4. **Push to Datalayer**: Send merged changelist via RPC to datalayer

### What is a Changelist?

A changelist is an array of objects in this format:
```javascript
[
  {
    action: 'insert',  // or 'delete'
    key: '0x76616c7565',  // hex-encoded "table|primaryKey"
    value: '0x7b22636164547275737450726f...'  // hex-encoded JSON record
  }
]
```

For example:
- Key: `0x70726f6772616d7c6162632d313233` = "program|abc-123"
- Value: `0x7b22636164547275737450726f6772616d49...` = '{"cadTrustProgramId":"abc-123","programName":"...",...}'

### How It Works:
- Each model (Project, Unit) has a `generateChangeListFromStagedData()` method
- These methods are called in parallel from staging.model.js
- All results are merged into one unified changelist
- The unified changelist is pushed to datalayer in one RPC call

## What V2 Needs

V2 needs the EXACT SAME process, but for 20+ tables instead of 2.

### What We Need to Build:

1. **`pushToDataLayer()` method in `staging-v2.model.js`**:
   - Read all unstaged records from staging table
   - For EACH v2 model (program, project, methodology, validation, etc.), call that model's `generateChangeListFromStagedData()` method
   - Merge all changelists
   - Push to datalayer

2. **`generateChangeListFromStagedData()` method in EACH v2 model**:
   - Extract staged records for that specific model
   - Convert to Excel format
   - Convert Excel to changelist
   - Return changelist

### Key Insight:
The commit process is **universal** - it doesn't matter which tables have data. The same process handles:
- One table with data
- Multiple tables with data
- All 20+ tables with data

The difference is just which model methods get called based on which tables have staged records.

## Corrected Implementation Plan

### Phase 1.2: Build Complete Commit System

**Goal**: Implement the complete commit system that works for all tables

**Steps**:
1. Add `generateChangeListFromStagedData()` to ALL v2 models
   - Program, Project, Methodology, Validation, Verification, Issuance, Unit, Location
   - Follow exact v1 pattern
2. Add `pushToDataLayer()` to staging-v2.model.js
   - Read unstaged records
   - Call each model's method (in parallel if possible)
   - Merge changelists
   - Push to datalayer
3. Handle special keys (comment, author) like v1 does
4. Write comprehensive tests

**This is NOT broken down by table** - we build the complete system all at once, it just handles whatever tables have staged data.
