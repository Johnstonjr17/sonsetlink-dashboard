import { NextRequest, NextResponse } from 'next/server';
import { getDb, initSchema } from '@/lib/db';

const GALLONS_TO_LITERS = 3.78541;

export async function GET(req: NextRequest) {
  try {
    await initSchema();
    const db = getDb();
    const { searchParams } = new URL(req.url);

    const todayStr = new Date().toISOString().slice(0, 10);
    const startDate = searchParams.get('startDate') || '2025-01-01';
    const endDate = searchParams.get('endDate') || todayStr;

    const result = await db.execute({
      sql: `
        SELECT
          s.id AS site_id,
          s.name,
          s.location,
          s.format_name,
          SUM(COALESCE(m.flow_volume, 0)) AS flow1_gal,
          SUM(COALESCE(m.flow2_volume, 0)) AS flow2_gal,
          SUM(COALESCE(m.flow_volume, 0) + COALESCE(m.flow2_volume, 0)) AS total_gal,
          COUNT(m.id) AS record_count,
          MIN(substr(m.timestamp, 1, 10)) AS first_tx,
          MAX(substr(m.timestamp, 1, 10)) AS last_tx
        FROM sites s
        LEFT JOIN messages m ON m.site_id = s.id
          AND substr(m.timestamp, 1, 10) >= ?
          AND substr(m.timestamp, 1, 10) <= ?
        WHERE s.most_recent_tx >= '2025-01-01'
        GROUP BY s.id, s.name, s.location, s.format_name
        ORDER BY s.name ASC
      `,
      args: [startDate, endDate],
    });

    const sites = result.rows.map((r) => {
      const flow1Gal = Math.round(Number(r.flow1_gal ?? 0));
      const flow2Gal = Math.round(Number(r.flow2_gal ?? 0));
      const totalGal = Math.round(Number(r.total_gal ?? 0));

      const flow1Liters = Math.round(flow1Gal * GALLONS_TO_LITERS);
      const flow2Liters = Math.round(flow2Gal * GALLONS_TO_LITERS);
      const totalLiters = Math.round(totalGal * GALLONS_TO_LITERS);

      return {
        site_id: String(r.site_id),
        name: String(r.name || r.site_id || 'Unnamed Site'),
        location: String(r.location || 'N/A'),
        format_name: String(r.format_name || 'N/A'),
        flow1_gal: flow1Gal,
        flow1_liters: flow1Liters,
        flow2_gal: flow2Gal,
        flow2_liters: flow2Liters,
        total_gal: totalGal,
        total_liters: totalLiters,
        record_count: Number(r.record_count ?? 0),
        first_tx: r.first_tx ? String(r.first_tx) : 'N/A',
        last_tx: r.last_tx ? String(r.last_tx) : 'N/A',
      };
    });

    const overallFlow1Gal = sites.reduce((s, r) => s + r.flow1_gal, 0);
    const overallFlow2Gal = sites.reduce((s, r) => s + r.flow2_gal, 0);
    const overallGal = sites.reduce((s, r) => s + r.total_gal, 0);

    const overallFlow1Liters = Math.round(overallFlow1Gal * GALLONS_TO_LITERS);
    const overallFlow2Liters = Math.round(overallFlow2Gal * GALLONS_TO_LITERS);
    const overallLiters = Math.round(overallGal * GALLONS_TO_LITERS);

    return NextResponse.json({
      startDate,
      endDate,
      totalSites: sites.length,
      overallFlow1Gal,
      overallFlow1Liters,
      overallFlow2Gal,
      overallFlow2Liters,
      overallGal,
      overallLiters,
      sites,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
