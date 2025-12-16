import { getLiveApiRequest, clearStagingTable } from '../helpers/live-api-helpers.js';

async function main() {
  try {
    console.log('Connecting to API...');
    const request = await getLiveApiRequest();

    // First, reset committed records (committed: true)
    console.log('Resetting committed records...');
    try {
      const resetResponse = await request.post('/v2/staging/reset-committed');
      console.log('✓ Committed records reset:', resetResponse.body.message);
    } catch (error) {
      console.log('Note: Reset endpoint may not exist or no committed records to reset');
    }

    // Then clear uncommitted records (committed: false)
    console.log('Clearing staging table...');
    await clearStagingTable(request);
    console.log('✓ Staging table cleared successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
