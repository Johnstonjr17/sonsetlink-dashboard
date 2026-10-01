import { NextRequest, NextResponse } from 'next/server';
import { getDb, initSchema } from '@/lib/db';
import { fillDailyGaps } from '@/lib/formatDate';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const IGNORED_ALERTS = "'DOSING_MISMATCH', 'DOSING_BROKEN', 'MODEM_ON'";
const GALLONS_TO_LITERS = 3.78541;

/**
 * Compute the UTC offset for a site's timezone as a SQLite datetime() modifier string.
 * e.g. America/Tijuana (UTC-7 PDT) → '-420 minutes'
 *      Asia/Kolkata   (UTC+5:30)   → '+330 minutes'
 * Uses minutes (not hours) to handle half-hour and quarter-hour offsets correctly.
 * Computed at request time so DST transitions are automatically accounted for.
 */
function getTzModifier(tz: string | null | undefined): string {
  if (!tz) return '+0 minutes';
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    }).formatToParts(now);
    const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0');
    // Treat local time components as if they were UTC to get apparent offset
    const localAsIfUtc = Date.UTC(
      get('year'), get('month') - 1, get('day'),
      get('hour') % 24, get('minute'), get('second')
    );
    const offsetMinutes = Math.round((localAsIfUtc - now.getTime()) / 60000);
    return `${offsetMinutes >= 0 ? '+' : ''}${offsetMinutes} minutes`;
  } catch {
    return '+0 minutes';
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    await initSchema();
    const { siteId } = await params;
    const db = getDb();

    const siteRes = await db.execute({
      sql: `SELECT * FROM sites WHERE id = ?`,
      args: [siteId],
    });
    const site = siteRes.rows[0];
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const installDate = site.install_date as string | undefined;
    // Compute timezone offset modifier for local-date grouping
    const tzMod = getTzModifier(site.timezone as string | null);

    const dailyFlowRes = await db.execute({
      sql: `
        SELECT
          substr(datetime(timestamp, ?), 1, 10) AS date,
          SUM(COALESCE(flow_volume, 0) + COALESCE(flow2_volume, 0)) AS total_gal,
          SUM(COALESCE(flow_volume, 0) + COALESCE(flow2_volume, 0)) * ${GALLONS_TO_LITERS} AS total_liters,
          SUM(COALESCE(flow_volume, 0)) AS flow1_gal,
          SUM(COALESCE(flow2_volume, 0)) AS flow2_gal,
          SUM(COALESCE(time_in_use, 0)) AS total_mins,
          CASE
            WHEN SUM(COALESCE(time_in_use, 0)) > 0
            THEN (SUM(COALESCE(flow_volume, 0) + COALESCE(flow2_volume, 0)) / SUM(COALESCE(time_in_use, 0)))
            ELSE 0
          END AS daily_avg_gpm,
          CASE
            WHEN SUM(COALESCE(time_in_use, 0)) > 0
            THEN ((SUM(COALESCE(flow_volume, 0) + COALESCE(flow2_volume, 0)) / SUM(COALESCE(time_in_use, 0))) * ${GALLONS_TO_LITERS})
            ELSE 0
          END AS daily_avg_lpm,
          AVG(NULLIF(battery_voltage, 0)) AS avg_battery,
          COUNT(*) AS transmissions
        FROM messages
        WHERE site_id = ?
          AND (? IS NULL OR substr(datetime(timestamp, ?), 1, 10) >= ?)
        GROUP BY substr(datetime(timestamp, ?), 1, 10)
        ORDER BY date ASC
      `,
      args: [tzMod, siteId, installDate ?? null, tzMod, installDate ?? null, tzMod],
    });

    const recentMessagesRes = await db.execute({
      sql: `
        SELECT
          id,
          timestamp,
          flow_volume,
          flow2_volume,
          (COALESCE(flow_volume, 0) + COALESCE(flow2_volume, 0)) AS total_volume,
          dosing_pump,
          time_in_use,
          CASE
            WHEN time_in_use > 0
            THEN ((COALESCE(flow_volume, 0) + COALESCE(flow2_volume, 0)) / time_in_use)
            ELSE 0
          END AS flow_rate_gpm,
          CASE
            WHEN time_in_use > 0
            THEN (((COALESCE(flow_volume, 0) + COALESCE(flow2_volume, 0)) / time_in_use) * ${GALLONS_TO_LITERS})
            ELSE 0
          END AS flow_rate_lpm,
          battery_voltage,
          slot,
          backfill
        FROM messages
        WHERE site_id = ?
          AND (? IS NULL OR substr(timestamp, 1, 10) >= ?)
        ORDER BY timestamp DESC
        LIMIT 200
      `,
      args: [siteId, installDate ?? null, installDate ?? null],
    });

    const batteryTrendRes = await db.execute({
      sql: `
        SELECT
          substr(datetime(timestamp, ?), 1, 10) AS date,
          AVG(NULLIF(battery_voltage, 0)) AS avg_battery
        FROM messages
        WHERE site_id = ?
          AND battery_voltage IS NOT NULL
          AND (? IS NULL OR substr(datetime(timestamp, ?), 1, 10) >= ?)
        GROUP BY substr(datetime(timestamp, ?), 1, 10)
        ORDER BY date DESC
        LIMIT 30
      `,
      args: [tzMod, siteId, installDate ?? null, tzMod, installDate ?? null, tzMod],
    });

    const notifsRes = await db.execute({
      sql: `
        SELECT
          id, site_id, timestamp, notification_type_name,
          severity, unresolved, info, dismissed, dismissed_at
        FROM notifications
        WHERE site_id = ?
          AND notification_type_name NOT IN (${IGNORED_ALERTS})
        ORDER BY unresolved DESC, (dismissed = 0 OR dismissed IS NULL) DESC, timestamp DESC
      `,
      args: [siteId],
    });

    const notifications = notifsRes.rows.map((r) => {
      let parsedInfo = null;
      try {
        parsedInfo = typeof r.info === 'string' ? JSON.parse(r.info) : r.info;
      } catch {
        parsedInfo = r.info;
      }
      return {
        id: String(r.id),
        site_id: String(r.site_id),
        timestamp: String(r.timestamp),
        notification_type_name: String(r.notification_type_name),
        severity: Number(r.severity ?? 0),
        unresolved: Boolean(r.unresolved),
        info: parsedInfo,
        dismissed: Boolean(r.dismissed),
        dismissed_at: r.dismissed_at ? String(r.dismissed_at) : null,
      };
    });

    return NextResponse.json({
      site,
      dailyFlow: fillDailyGaps(dailyFlowRes.rows),
      recentMessages: recentMessagesRes.rows,
      batteryTrend: [...batteryTrendRes.rows].reverse(),
      notifications,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    await initSchema();
    const { siteId } = await params;
    const db = getDb();
    const body = await req.json();

    const { discrepancy_flow1_gal, discrepancy_flow2_gal, discrepancy_date } = body;

    await db.execute({
      sql: `
        UPDATE sites
        SET discrepancy_flow1_gal = ?,
            discrepancy_flow2_gal = ?,
            discrepancy_date = ?
        WHERE id = ?
      `,
      args: [
        discrepancy_flow1_gal ?? 0,
        discrepancy_flow2_gal ?? 0,
        discrepancy_date ?? null,
        siteId,
      ],
    });

    const updated = await db.execute({ sql: `SELECT * FROM sites WHERE id = ?`, args: [siteId] });
    return NextResponse.json({ success: true, site: updated.rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
