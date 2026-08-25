import { getDb, initSchema } from './db';
import { fetchAllSites, fetchSiteUnitDetails, fetchSiteNotifications, fetchSiteMessages } from './api';

const START_DATE = '2025-01-01 00:00:00';

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

  const unitDetailMap = new Map<string, { install_date: string | null; ship_date: string | null }>();
  await Promise.all(
    activeSites.map(async (site) => {
      const details = await fetchSiteUnitDetails(site.id);
      unitDetailMap.set(site.id, details);
    })
  );

  const siteStatements = sites.map((s) => {
    const unit = unitDetailMap.get(s.id);
    return {
      sql: `
        INSERT INTO sites (id, name, location, format_name, most_recent_tx, install_date, ship_date, timezone)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          location = excluded.location,
          format_name = excluded.format_name,
          most_recent_tx = excluded.most_recent_tx,
          install_date = COALESCE(excluded.install_date, sites.install_date),
          ship_date = COALESCE(excluded.ship_date, sites.ship_date),
          timezone = COALESCE(excluded.timezone, sites.timezone)
      `,
      args: [
        s.id,
        s.attributes.name ?? null,
        s.attributes.location ?? null,
        s.attributes.format_name ?? null,
        s.attributes.most_recent_tx ?? null,
        unit?.install_date ?? null,
        unit?.ship_date ?? null,
        s.attributes.timezone ?? null,
      ],
    };
  });

  if (siteStatements.length > 0) {
    await db.batch(siteStatements, 'write');
    sitesUpdated = sites.length;
  }

  // Concurrent fetch per site (batch size 4)
  const batchSize = 4;
  for (let i = 0; i < activeSites.length; i += batchSize) {
    const batch = activeSites.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (site) => {
        try {
          const unit = unitDetailMap.get(site.id);
          const installDate = unit?.install_date;

          // 1. Sync Site Notifications/Warnings
          try {
            const notifs = await fetchSiteNotifications(site.id);
            if (notifs.length > 0) {
              const notifStatements = notifs.map((n) => {
                const a = n.attributes;
                return {
                  sql: `
                    INSERT INTO notifications (id, site_id, timestamp, notification_type_name, severity, unresolved, info)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                      timestamp = excluded.timestamp,
                      notification_type_name = excluded.notification_type_name,
                      severity = excluded.severity,
                      unresolved = excluded.unresolved,
                      info = excluded.info
                  `,
                  args: [
                    n.id,
                    site.id,
                    a.timestamp,
                    a.notification_type_name,
                    a.severity ?? 0,
                    a.unresolved ? 1 : 0,
                    JSON.stringify(a.info ?? []),
                  ],
                };
              });
              await db.batch(notifStatements, 'write');
            }
          } catch (notifErr) {
            console.error(`Error syncing notifications for ${site.id}:`, notifErr);
          }

          // 2. Sync Site Telemetry Messages
          const rangeRes = await db.execute({
            sql: `SELECT MIN(timestamp) as min_ts, MAX(timestamp) as max_ts FROM messages WHERE site_id = ?`,
            args: [site.id],
          });
          const minTs = rangeRes.rows[0]?.min_ts as string | undefined;
          const maxTs = rangeRes.rows[0]?.max_ts as string | undefined;

          let sinceDate = installDate ? `${installDate} 00:00:00` : START_DATE;

          if (minTs && minTs <= '2025-01-05' && maxTs && maxTs.length >= 10) {
            const d = new Date(maxTs.slice(0, 10) + 'T00:00:00');
            d.setDate(d.getDate() - 2);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            sinceDate = `${yyyy}-${mm}-${dd} 00:00:00`;
          }

          const messages = await fetchSiteMessages(site.id, sinceDate);

          const validMessages = messages.filter((msg) => {
            const ts = msg.attributes.timestamp;
            if (!ts) return false;
            if (installDate && ts.slice(0, 10) < installDate) {
              return false;
            }
            return true;
          });

          if (validMessages.length > 0) {
            const msgStatements = validMessages.map((msg) => {
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

            const chunkSize = 250;
            for (let j = 0; j < msgStatements.length; j += chunkSize) {
              const chunk = msgStatements.slice(j, j + chunkSize);
              await db.batch(chunk, 'write');
            }

            await db.execute({
              sql: `UPDATE sites SET last_synced_at = ? WHERE id = ?`,
              args: [new Date().toISOString(), site.id],
            });

            recordsAdded += validMessages.length;
          }
        } catch (err) {
          errors.push(`${site.id}: ${String(err)}`);
        }
      })
    );
  }

  return {
    sitesUpdated,
    recordsAdded,
    durationMs: Date.now() - start,
    errors,
  };
}
