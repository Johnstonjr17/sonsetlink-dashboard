import { NextResponse } from 'next/server';
import { getDb, initSchema } from '@/lib/db';

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
        COUNT(m.id) AS record_count,
        MAX(m.battery_voltage) AS latest_battery,
        SUM(COALESCE(m.flow_volume, 0) + COALESCE(m.flow2_volume, 0)) AS total_flow_gal
      FROM sites s
      LEFT JOIN messages m ON m.site_id = s.id
      WHERE s.most_recent_tx >= '2025-01-01'
      GROUP BY s.id
      ORDER BY s.name ASC
    `);

    return NextResponse.json({ sites: result.rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
