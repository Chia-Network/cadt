# V1 to V2 Upgrade Test – Pending Root Log Analysis

Analysis of GitHub Actions run [21736232770](https://github.com/Chia-Network/cadt/actions/runs/21736232770) job [62701738548](https://github.com/Chia-Network/cadt/actions/runs/21736232770/job/62701738548?pr=1492) (v1 to v2 upgrade test).

## Timeline (CADT logs)

| Time (UTC) | Event |
|------------|--------|
| **02:24:51** | Data model version store created: `4e19c250...` |
| **02:25:51** | Store `4e19c250...` confirmed (root hash `0x00...`) |
| **02:26:21** | Mirror added for `4e19c250...`; "Created dataModelVersion store" |
| **02:27:36** | DATA_PUSHING: "Pushing data to dataModelVersion store 4e19c250...", "Syncing 4e19c250...", "pushing to datalayer 4e19c250..." |
| **02:27:51** | **Two batch_update RPCs sent:** (1) Org store `7ecd0ea1...` (4 keys) → **Success!** (2) Data model version store `4e19c250...` (1 key: v1 → registry) → **Fails: "Can't select amount higher than our spendable balance. Amount: 3000, spendable: 0"** |
| **02:27:51** | CADT: "RPC failed when pushing to store 4e19c250..., attempting retry", "Retrying pushing to store 4e19c250...: 0" |
| **02:27:58** | Creation status: "Writing organization data **(2/2 stores updated)**" (state still DATA_PUSHING) |
| **02:28:21** | Retry 1: getRoot(4e19c250) → confirmed, "pushing to datalayer 4e19c250..." (no RPC log in snippet; next attempt is 02:29:21) |
| **02:29:21** | Retry 2: "pushing to datalayer 4e19c250...", then **02:29:36** batch_update to 4e19c250 → **"Already have a pending root waiting for confirmation."** |
| **02:29:36** | "RPC failed... attempting retry", "Retrying pushing to store 4e19c250...: 3" |
| **02:30:06** | Mirror check for 4e19c250, "pushing to datalayer 4e19c250..." |
| **02:30:21** | batch_update to 4e19c250 again → **"Already have a pending root waiting for confirmation."** |
| **02:29:40** | Creation status: **FINALIZING**; test sees org "Test V1 Upgrade Org 1770344495429" but "singleton data not yet written (dataModelVersionStoreHash=0x00...)" |
| **02:29:50–02:30:10+** | Test keeps polling; org synced=true but dataModelVersionStoreHash still 0x00... → timeout |

## What the “pending root” is

- **Store:** Data model version (singleton) store **`4e19c250cd018c53d27c9159f111292e4460e8070ea53fe9b70984b0e7d6e93a`**.
- **Meaning:** Chia DataLayer has accepted a root update for this store (a `batch_update` that inserts the v1 key) and that root is **waiting for blockchain confirmation**. Until it confirms, Chia will not accept another `batch_update` for this store and returns: *"Already have a pending root waiting for confirmation."*

So the “pending root” is the **unconfirmed root** for the **data model version store** `4e19c250...`, i.e. the singleton that should hold the v1 → registry mapping.

## Why it recurs

1. **First attempt (02:27:51)**
   - Org store push **succeeds** (Success! for `7ecd0ea1...`).
   - Data model version store push **fails** with **"Amount: 3000, spendable: 0"** (wallet has no XCH for the fee).
   - CADT schedules a retry in 30s and **returns without throwing**, so creation still marks **2/2 stores updated** and moves on.

2. **Retries (02:28:21, 02:28:51, 02:29:21, …)**
   - On a later retry, the wallet has spendable balance again (e.g. after the org-store tx confirms).
   - CADT sends `batch_update` to store `4e19c250...`. Chia **accepts** it and creates a **pending root** for that store.
   - CADT’s `pushChangeListToDataLayer` still returns `false` (e.g. due to how the response is handled), so CADT treats it as failure and schedules another retry in 30s.

3. **Every 30s after that**
   - CADT sends another `batch_update` to `4e19c250...`.
   - Chia again responds: *"Already have a pending root waiting for confirmation."*
   - So the error **recurs** on every retry until that pending root confirms. During that time the singleton never gets a **confirmed** non-zero root, so `dataModelVersionStoreHash` stays `0x00...` and the test times out waiting for “singleton data written.”

So the recurrence is: **same store, same error on every retry**, because we retry **without waiting for the pending root to confirm**.

## Why we have a pending root at that point

- We have a pending root because **one of the retries** successfully submitted a `batch_update` for store `4e19c250...` (the singleton). That call was accepted by Chia and created a new root for that store; that root is then “pending” until it is confirmed on-chain.
- The **first** push to `4e19c250...` did **not** create that pending root (it failed with spendable: 0). So the pending root was created by a **later** push attempt (one of the 30s retries) after the wallet had balance again.

## Chia vs CADT logs

- **CADT:** Logs “Sending changelist to storeId: 4e19c250...”, “DataLayer response: Already have a pending root…”, “Retrying pushing to store 4e19c250...: N”.
- **Chia:** The run logs are from the job (single log stream); Chia data_layer logs would show `batch_update` requests and the “Already have a pending root” / `batch_insert` path. The traceback in the CADT log (`data_layer_rpc_api.py`, `batch_update`, `data_layer.py`, `batch_insert`) is from Chia’s RPC layer. So the “pending root” is **Chia’s** state for store `4e19c250...`.

## Root causes (summary)

1. **Wallet had 0 spendable** on the first push to the data model version store, so the first push failed and we never wrote the v1 key in that attempt.
2. **Retries don’t wait for confirmation:** When Chia returns “Already have a pending root”, we schedule another retry in 30s instead of waiting for that root to confirm, so we keep sending the same update and keep getting the same error.
3. **Creation still marks 2/2:** When the data model version push fails, we schedule a retry and return without throwing, so `_pushDataInParallel` marks both stores as “data written” and creation moves to FINALIZING even though the singleton push did not complete successfully from the client’s perspective. That’s why the test sees “2/2 stores updated” but “singleton data not yet written”.

## Fixes (implemented)

1. **persistance.js:** When the DataLayer response is “Already have a pending root waiting for confirmation”, wait for confirmation (e.g. `waitForAllTransactionsToConfirm` + short delay) and retry the **same** push inside `pushChangeListToDataLayer` instead of returning false immediately. 2. **writeService.js:** Optionally, make `pushChangesWhenStoreIsAvailable` resolve only when the push has actually succeeded (or we’ve given up after 60 retries), so we don’t mark “data written” and move to FINALIZING when the push failed and only a retry was scheduled.
