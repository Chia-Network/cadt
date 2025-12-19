'use strict';

import { expect } from 'chai';
import { describe, it, before, after } from 'mocha';
import { StagingV2, OrganizationsV2 } from '../../../src/models/v2/index.js';
import {
  debugDeleteKey,
  compareDeleteKey,
  getAllDatalayerKeys,
} from '../../../src/utils/v2-debug-datalayer-keys.js';
import { loggerV2 } from '../../../src/config/logger.js';

describe('Debug DELETE Key Mismatches', () => {
  let homeOrg;

  before(async () => {
    homeOrg = await OrganizationsV2.getHomeOrg();
    if (!homeOrg) {
      throw new Error('No home organization found');
    }
    loggerV2.info(`Using home org: ${homeOrg.name} (${homeOrg.org_uid})`);
  });

  it('should debug all DELETE staging records and compare with datalayer keys', async function () {
    this.timeout(60000); // 60 second timeout

    // Get all DELETE staging records
    const deleteRecords = await StagingV2.findAll({
      where: {
        action: 'DELETE',
        committed: false,
      },
    });

    loggerV2.info(`Found ${deleteRecords.length} uncommitted DELETE staging records`);

    if (deleteRecords.length === 0) {
      loggerV2.info('No DELETE records to debug');
      return;
    }

    // Get all keys from datalayer
    loggerV2.info('Fetching all keys from datalayer...');
    const datalayerKeys = await getAllDatalayerKeys(homeOrg.registry_id);
    loggerV2.info(`Found ${datalayerKeys.length} keys in datalayer`);

    // Group datalayer keys by table prefix
    const keysByTable = {};
    datalayerKeys.forEach((k) => {
      const [tablePrefix] = k.decoded.split('|');
      if (!keysByTable[tablePrefix]) {
        keysByTable[tablePrefix] = [];
      }
      keysByTable[tablePrefix].push(k.decoded);
    });

    loggerV2.info('Keys by table:', Object.keys(keysByTable).map(table => ({
      table,
      count: keysByTable[table].length,
      sampleKeys: keysByTable[table].slice(0, 3),
    })));

    // Debug each DELETE record
    for (const record of deleteRecords) {
      loggerV2.info(`\n=== Debugging DELETE record: ${record.uuid} ===`);
      loggerV2.info(`Table: ${record.table}`);
      loggerV2.info(`Data: ${record.data}`);

      try {
        const debugInfo = await debugDeleteKey(record, homeOrg.registry_id);

        loggerV2.info('Generated key:', debugInfo.keyGeneration?.generatedKey);
        loggerV2.info('Comparison:', {
          exactMatch: debugInfo.comparison?.exactMatch,
          partialMatchesCount: debugInfo.comparison?.partialMatches?.length || 0,
          partialMatches: debugInfo.comparison?.partialMatches?.slice(0, 5),
        });

        // Show all keys for this table from datalayer
        const [tablePrefix] = debugInfo.keyGeneration?.generatedKey?.split('|') || [];
        if (tablePrefix && keysByTable[tablePrefix]) {
          loggerV2.info(`All ${keysByTable[tablePrefix].length} keys for table '${tablePrefix}' in datalayer:`);
          keysByTable[tablePrefix].forEach((key, idx) => {
            loggerV2.info(`  ${idx + 1}. ${key}`);
          });
        }
      } catch (error) {
        loggerV2.error(`Error debugging record ${record.uuid}: ${error.message}`);
        loggerV2.error(error.stack);
      }
    }
  });
});





