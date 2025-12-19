#!/usr/bin/env node
/**
 * Cleanup script to remove records with 'undefined' keys from datalayer and database
 *
 * This script:
 * 1. Finds all keys in datalayer that contain 'undefined'
 * 2. Deletes those keys from datalayer
 * 3. Optionally deletes corresponding records from the database
 *
 * Usage: node cleanup-undefined-keys.js <STORE_ID> [--dry-run] [--delete-from-db]
 *
 * Example: node cleanup-undefined-keys.js 0ec34d45e12b902238d27bf9ddaacf308eac3a640a222ceffa1cf86b08cd6399 --dry-run
 */

import { execSync } from 'child_process';

const DRY_RUN = process.argv.includes('--dry-run');
const DELETE_FROM_DB = process.argv.includes('--delete-from-db');

function execChiaRpc(method, params) {
  const cmd = `chia rpc data_layer ${method} '${JSON.stringify(params)}'`;
  const result = execSync(cmd, { encoding: 'utf-8' });
  return JSON.parse(result);
}

function encodeHex(str) {
  return Buffer.from(str).toString('hex');
}

function decodeHex(hexStr) {
  const hexClean = hexStr.replace('0x', '');
  return Buffer.from(hexClean, 'hex').toString('utf-8');
}

async function main() {
  console.log('=== Cleanup Script for Undefined Keys ===\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Get store ID from command line argument (required)
  const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  const storeId = args[0];

  if (!storeId) {
    console.error('❌ Error: Store ID is required');
    console.error('\nUsage: node cleanup-undefined-keys.js <STORE_ID> [--dry-run] [--delete-from-db]');
    console.error('\nExample:');
    console.error('  node cleanup-undefined-keys.js 0ec34d45e12b902238d27bf9ddaacf308eac3a640a222ceffa1cf86b08cd6399 --dry-run');
    console.error('\nTo find your store ID, check your home organization registry_id field in the database.');
    process.exit(1);
  }

  console.log(`📦 Store ID: ${storeId}\n`);

  // Get all keys from datalayer
  console.log('🔍 Fetching keys from datalayer...');
  const keysResponse = execChiaRpc('get_keys_values', { id: storeId });

  if (!keysResponse.success) {
    console.error('❌ Error fetching keys:', keysResponse);
    process.exit(1);
  }

  // Find keys with 'undefined'
  const undefinedKeys = [];
  for (const kv of keysResponse.keys_values || []) {
    const decodedKey = decodeHex(kv.key);
    if (decodedKey && decodedKey.includes('undefined')) {
      undefinedKeys.push({
        hexKey: kv.key,
        decodedKey: decodedKey,
        value: kv.value ? decodeHex(kv.value) : null,
      });
    }
  }

  if (undefinedKeys.length === 0) {
    console.log('✅ No keys with "undefined" found in datalayer');
    return;
  }

  console.log(`\n⚠️  Found ${undefinedKeys.length} key(s) with "undefined":\n`);
  undefinedKeys.forEach((key, idx) => {
    console.log(`${idx + 1}. ${key.decodedKey}`);
    if (key.value) {
      try {
        const valueObj = JSON.parse(key.value);
        console.log(`   Value: ${JSON.stringify(valueObj).substring(0, 100)}...`);
      } catch {
        console.log(`   Value: ${key.value.substring(0, 100)}...`);
      }
    }
  });

  if (DRY_RUN) {
    console.log('\n🔍 DRY RUN: Would delete these keys from datalayer');
    if (DELETE_FROM_DB) {
      console.log('🔍 DRY RUN: Would also delete corresponding records from database');
    }
    return;
  }

  // Delete keys from datalayer
  console.log('\n🗑️  Deleting keys from datalayer...');
  const changelist = undefinedKeys.map(key => ({
    action: 'delete',
    key: key.hexKey,
  }));

  try {
    const deleteResponse = execChiaRpc('batch_update', {
      id: storeId,
      changelist: changelist,
    });

    if (deleteResponse.success) {
      console.log('✅ Successfully deleted keys from datalayer');
      console.log(`   Transaction ID: ${deleteResponse.tx_id || 'N/A'}`);
    } else {
      console.error('❌ Error deleting keys:', deleteResponse);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error executing datalayer delete:', error.message);
    process.exit(1);
  }

  // Optionally delete from database
  if (DELETE_FROM_DB) {
    console.log('\n🗑️  Deleting records from database...');
    console.log('⚠️  Note: Database cleanup requires manual SQL queries');
    console.log('   The records should be removed automatically by the sync process');
    console.log('   after the datalayer keys are deleted.');

    // Extract table names and IDs from the keys
    for (const key of undefinedKeys) {
      const [table] = key.decodedKey.split('|');
      console.log(`\n   Table: ${table}`);
      console.log(`   Key: ${key.decodedKey}`);

      if (key.value) {
        try {
          const valueObj = JSON.parse(key.value);
          console.log(`   Record data:`, JSON.stringify(valueObj, null, 2));

          // Provide SQL hints for manual deletion
          if (table === 'project_methodology') {
            const projectId = valueObj.cad_trust_project_id || valueObj.cadTrustProjectId;
            const methodologyId = valueObj.cad_trust_methodology_id || valueObj.cadTrustMethodologyId;
            if (projectId && methodologyId) {
              console.log(`   SQL: DELETE FROM project_methodology WHERE cad_trust_project_id = '${projectId}' AND cad_trust_methodology_id = '${methodologyId}';`);
            }
          } else if (table === 'stakeholder_projects') {
            const id = valueObj.cad_trust_stakeholder_project_id || valueObj.cadTrustStakeholderProjectId;
            if (id) {
              console.log(`   SQL: DELETE FROM stakeholder_projects WHERE cad_trust_stakeholder_project_id = '${id}';`);
            }
          }
        } catch {
          console.log(`   Could not parse value for SQL generation`);
        }
      }
    }
  }

  console.log('\n✅ Cleanup complete!');
  console.log('\n📝 Next steps:');
  console.log('   1. Wait for the datalayer sync process to remove records from database');
  console.log('   2. Or manually delete records from database using the SQL queries above');
  console.log('   3. Reset the committed staging records if needed');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});





