import { getLiveApiRequest, clearStagingTable } from '../helpers/live-api-helpers.js';

/**
 * Format current timestamp as YYYY-MM-DD HH:mm:ss
 * @returns {string} - Formatted timestamp
 */
const getTimestamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

async function main() {
  try {
    console.log('Connecting to API...');
    const request = await getLiveApiRequest();

    // First, reset committed records (committed: true)
    console.log('Resetting committed records...');
    try {
      console.log(`[${getTimestamp()}] POST /v2/staging/reset-committed`);
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
