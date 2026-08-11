import { getDb, initSchema } from './db';
import { fetchAllSites, fetchSiteMessages } from './api';

const START_DATE = '2026-01-01 00:00:00';

export interface SyncResult {
  sitesUpdated: number;
  recordsAdded: number;
  durationMs: number;
  errors: string[];
}

export async function syncAll(): Promise<SyncResult> {
  const start = Date.now();
  await initSchema();
  const db = getDb();
  const errors: string[] = [];
  let sitesUpdated = 0;
  let recordsAdded = 0;

  const sites = await fetchAllSites();

  const activeSites = sites.filter((s) => {
    const tx = s.attributes.most_recent_tx ?? '';
    return tx >= '2025-01-01';
  });

  const siteStatements = sites.map((s) => ({
    sql: `
      INSERT INTO sites (id, name, location, format_name, most_recent_tx)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        location = excluded.location,
        format_name = excluded.format_name,
        most_recent_tx = excluded.most_recent_tx
    `,
    args: [
      s.id,
      s.attributes.name ?? null,
      s.attributes.location ?? null,
      s.attributes.format_name ?? null,
      s.attributes.most_recent_tx ?? null,
    ],
  }));

  if (siteStatements.length > 0) {
    await db.batch(siteStatements, 'write');
    sitesUpdated = sites.length;
  }

  for (const site of activeSites) {
    try {
      const lastSyncRes = await db.execute({
        sql: `SELECT last_synced_at FROM sites WHERE id = ?`,
        args: [site.id],
      });
      const lastSyncRow = lastSyncRes.rows[0];
      const sinceDate = (lastSyncRow?.last_synced_at as string) ?? START_DATE;

      const messages = await fetchSiteMessages(site.id, sinceDate);

      if (messages.length > 0) {
        const msgStatements = messages.map((msg) => {
          const a = msg.attributes;
          return {
            sql: `
              INSERT OR IGNORE INTO messages
                (id, site_id, timestamp, flow_volume, flow2_volume, dosing_pump, time_in_use, battery_voltage, slot, backfill)
              VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
              msg.id,
              site.id,
              a.timestamp ?? null,
              a.flow_volume ?? 0,
              a.flow2_volume ?? 0,
              a.dosing_pump ?? null,
              a.time_in_use ?? 0,
              a.battery_voltage ?? null,
              a.slot ?? null,
              a.backfill ?? null,
            ],
          };
        });

        const chunkSize = 500;
        for (let i = 0; i < msgStatements.length; i += chunkSize) {
          const chunk = msgStatements.slice(i, i + chunkSize);
          await db.batch(chunk, 'write');
        }

        await db.execute({
          sql: `UPDATE sites SET last_synced_at = ? WHERE id = ?`,
          args: [new Date().toISOString(), site.id],
        });

        recordsAdded += messages.length;
      }
    } catch (err) {
      errors.push(`${site.id}: ${String(err)}`);
    }
  }

  return {
    sitesUpdated,
    recordsAdded,
    durationMs: Date.now() - start,
    errors,
  };
}
