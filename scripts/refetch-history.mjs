/**
 * Historical Data Re-fetch Script
 * 
 * Re-fetches usage3 messages for all active sites from 2025 to present,
 * saving the new `original_timestamp` field and updating existing records.
 * 
 * Runs sequentially, site-by-site, against the dashboard API to avoid
 * serverless execution timeouts and strictly respect API rate limits.
 * 
 * Usage:
 *   node scripts/refetch-history.mjs [siteId]
 *   node scripts/refetch-history.mjs           # syncs all active sites
 *   node scripts/refetch-history.mjs SL-018    # syncs only SL-018
 */

const BASE_URL = process.env.DASHBOARD_URL || 'https://sonsetlink-dashboard.vercel.app';

async function main() {
  const targetSiteId = process.argv[2];

  console.log(`\n======================================================`);
  console.log(`   SonSetLink Historical Data Re-fetch Script`);
  console.log(`   Target: ${BASE_URL}`);
  console.log(`======================================================\n`);

  const SONSET_TOKEN = 'NhIZQ4PpIow6DWvj9w6Q9VBw9QLz8H6B7UOZ3gwyec1ee111';
  let sitesToSync = [];

  if (targetSiteId) {
    console.log(`Targeting single site: ${targetSiteId}`);
    sitesToSync = [{ id: targetSiteId, name: targetSiteId }];
  } else {
    console.log(`Fetching active site list from SonSetLink API ...`);
    const sitesRes = await fetch('https://app.sonsetlink.org/api/v1/sites?page[size]=100', {
      headers: { Authorization: `Bearer ${SONSET_TOKEN}`, Accept: 'application/vnd.api+json' }
    });
    if (!sitesRes.ok) {
      throw new Error(`Failed to fetch sites list: ${sitesRes.status} ${sitesRes.statusText}`);
    }
    const sitesData = await sitesRes.json();
    const allSites = sitesData.data || [];
    sitesToSync = allSites
      .filter((s) => (s.attributes?.most_recent_tx || '') >= '2025-01-01')
      .map((s) => ({ id: s.id, name: s.attributes?.name || s.id }));
    console.log(`Found ${sitesToSync.length} active sites to re-fetch.\n`);
  }

  let totalRecords = 0;
  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < sitesToSync.length; i++) {
    const site = sitesToSync[i];
    const indexStr = `[${i + 1}/${sitesToSync.length}]`;
    console.log(`${indexStr} Re-fetching ${site.id} (${site.name || 'Unknown'})...`);

    try {
      const syncUrl = `${BASE_URL}/api/sync?site=${encodeURIComponent(site.id)}&full=true`;
      const res = await fetch(syncUrl, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        totalRecords += data.recordsAdded || 0;
        successCount++;
        const durationSec = ((data.durationMs || 0) / 1000).toFixed(1);
        console.log(`  ✓ Success: ${data.recordsAdded || 0} messages synced (${durationSec}s)`);
      } else {
        failCount++;
        console.error(`  ✗ Error syncing ${site.id}:`, data.error || data.errors || 'Unknown error');
      }
    } catch (err) {
      failCount++;
      console.error(`  ✗ Network error for ${site.id}:`, err.message);
    }

    // Friendly delay between sites
    if (i < sitesToSync.length - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  const totalTimeSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n======================================================`);
  console.log(`   Re-fetch Completed in ${totalTimeSec}s`);
  console.log(`   Successful Sites: ${successCount}`);
  console.log(`   Failed Sites:     ${failCount}`);
  console.log(`   Total Records:    ${totalRecords}`);
  console.log(`======================================================\n`);
}

main().catch((err) => {
  console.error('\nFatal error in re-fetch script:', err);
  process.exit(1);
});
