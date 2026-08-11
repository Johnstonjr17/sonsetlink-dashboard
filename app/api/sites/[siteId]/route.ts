import { NextRequest, NextResponse } from 'next/server';
import { getDb, initSchema } from '@/lib/db';

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

    const dailyFlowRes = await db.execute({
      sql: `
        SELECT
          substr(timestamp, 1, 10) AS date,
          SUM(COALESCE(flow_volume, 0) + COALESCE(flow2_volume, 0)) AS total_gal,
          SUM(COALESCE(flow_volume, 0) + COALESCE(flow2_volume, 0)) * 3.78541 AS total_liters,
          SUM(COALESCE(flow_volume, 0)) AS flow1_gal,
          SUM(COALESCE(flow2_volume, 0)) AS flow2_gal,
          AVG(NULLIF(battery_voltage, 0)) AS avg_battery,
          COUNT(*) AS transmissions
        FROM messages
        WHERE site_id = ?
          AND timestamp >= '2026-01-01'
        GROUP BY substr(timestamp, 1, 10)
        ORDER BY date ASC
      `,
      args: [siteId],
    });

    const recentMessagesRes = await db.execute({
      sql: `
        SELECT
          id, timestamp, flow_volume, flow2_volume, dosing_pump,
          time_in_use, battery_voltage, slot, backfill
        FROM messages
        WHERE site_id = ?
        ORDER BY timestamp DESC
        LIMIT 200
      `,
      args: [siteId],
    });

    const batteryTrendRes = await db.execute({
      sql: `
        SELECT
          substr(timestamp, 1, 10) AS date,
          AVG(NULLIF(battery_voltage, 0)) AS avg_battery
        FROM messages
        WHERE site_id = ?
          AND battery_voltage IS NOT NULL
        GROUP BY substr(timestamp, 1, 10)
        ORDER BY date DESC
        LIMIT 30
      `,
      args: [siteId],
    });

    return NextResponse.json({
      site,
      dailyFlow: dailyFlowRes.rows,
      recentMessages: recentMessagesRes.rows,
      batteryTrend: [...batteryTrendRes.rows].reverse(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
