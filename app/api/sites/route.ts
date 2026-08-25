import { NextResponse } from 'next/server';
import { getDb, initSchema } from '@/lib/db';

const IGNORED_ALERTS = "'DOSING_MISMATCH', 'DOSING_BROKEN', 'MODEM_ON'";

export async function GET() {
  try {
    await initSchema();
    const db = getDb();

    const result = await db.execute(`
      SELECT
        s.id,
        s.name,
        s.location,
        s.format_name,
        s.most_recent_tx,
        s.last_synced_at,
        s.install_date,
        s.ship_date,
        s.timezone,
        COUNT(DISTINCT m.id) AS record_count,
        MAX(m.battery_voltage) AS latest_battery,
        SUM(COALESCE(m.flow_volume, 0) + COALESCE(m.flow2_volume, 0)) AS total_flow_gal,
        COUNT(DISTINCT CASE WHEN n.unresolved = 1 AND (n.dismissed = 0 OR n.dismissed IS NULL) AND n.notification_type_name NOT IN (${IGNORED_ALERTS}) THEN n.id END) AS active_alerts_count,
        GROUP_CONCAT(DISTINCT CASE WHEN n.unresolved = 1 AND (n.dismissed = 0 OR n.dismissed IS NULL) AND n.notification_type_name NOT IN (${IGNORED_ALERTS}) THEN n.notification_type_name END) AS active_alert_types
      FROM sites s
      LEFT JOIN messages m ON m.site_id = s.id
        AND (s.install_date IS NULL OR substr(m.timestamp, 1, 10) >= s.install_date)
      LEFT JOIN notifications n ON n.site_id = s.id
      WHERE s.most_recent_tx >= '2025-01-01'
      GROUP BY s.id, s.name, s.location, s.format_name, s.most_recent_tx, s.last_synced_at, s.install_date, s.ship_date, s.timezone
      ORDER BY s.name ASC
    `);

    return NextResponse.json({ sites: result.rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
