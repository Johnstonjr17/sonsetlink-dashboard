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
          s.install_date,
          s.ship_date,
          COALESCE(s.discrepancy_flow1_gal, 0) AS discrepancy_flow1_gal,
          COALESCE(s.discrepancy_flow2_gal, 0) AS discrepancy_flow2_gal,
          s.discrepancy_date,
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
          AND (s.install_date IS NULL OR substr(m.timestamp, 1, 10) >= s.install_date)
        WHERE s.most_recent_tx >= '2025-01-01'
        GROUP BY s.id, s.name, s.location, s.format_name, s.install_date, s.ship_date,
                 s.discrepancy_flow1_gal, s.discrepancy_flow2_gal, s.discrepancy_date
        ORDER BY s.name ASC
      `,
      args: [startDate, endDate],
    });

    const sites = result.rows.map((r) => {
      const flow1Gal = Math.round(Number(r.flow1_gal ?? 0));
      const flow2Gal = Math.round(Number(r.flow2_gal ?? 0));
      const totalGal = Math.round(Number(r.total_gal ?? 0));

      const discFlow1Gal = Number(r.discrepancy_flow1_gal ?? 0);
      const discFlow2Gal = Number(r.discrepancy_flow2_gal ?? 0);

      const adjustedFlow1Gal = flow1Gal + discFlow1Gal;
      const adjustedFlow2Gal = flow2Gal + discFlow2Gal;
      const adjustedTotalGal = adjustedFlow1Gal + adjustedFlow2Gal;

      return {
        site_id: String(r.site_id),
        name: String(r.name || r.site_id || 'Unnamed Site'),
        location: String(r.location || 'N/A'),
        format_name: String(r.format_name || 'N/A'),
        install_date: r.install_date ? String(r.install_date) : 'N/A',
        ship_date: r.ship_date ? String(r.ship_date) : 'N/A',
        discrepancy_flow1_gal: discFlow1Gal,
        discrepancy_flow2_gal: discFlow2Gal,
        discrepancy_date: r.discrepancy_date ? String(r.discrepancy_date) : null,
        // Raw reported values
        flow1_gal: flow1Gal,
        flow1_liters: Math.round(flow1Gal * GALLONS_TO_LITERS),
        flow2_gal: flow2Gal,
        flow2_liters: Math.round(flow2Gal * GALLONS_TO_LITERS),
        total_gal: totalGal,
        total_liters: Math.round(totalGal * GALLONS_TO_LITERS),
        // Adjusted values (with discrepancy applied)
        adjusted_flow1_gal: adjustedFlow1Gal,
        adjusted_flow1_liters: Math.round(adjustedFlow1Gal * GALLONS_TO_LITERS),
        adjusted_flow2_gal: adjustedFlow2Gal,
        adjusted_flow2_liters: Math.round(adjustedFlow2Gal * GALLONS_TO_LITERS),
        adjusted_total_gal: adjustedTotalGal,
        adjusted_total_liters: Math.round(adjustedTotalGal * GALLONS_TO_LITERS),
        record_count: Number(r.record_count ?? 0),
        first_tx: r.first_tx ? String(r.first_tx) : 'N/A',
        last_tx: r.last_tx ? String(r.last_tx) : 'N/A',
      };
    });

    const overallFlow1Gal = sites.reduce((s, r) => s + r.flow1_gal, 0);
    const overallFlow2Gal = sites.reduce((s, r) => s + r.flow2_gal, 0);
    const overallGal = sites.reduce((s, r) => s + r.total_gal, 0);
    const overallAdjustedFlow1Gal = sites.reduce((s, r) => s + r.adjusted_flow1_gal, 0);
    const overallAdjustedFlow2Gal = sites.reduce((s, r) => s + r.adjusted_flow2_gal, 0);
    const overallAdjustedGal = sites.reduce((s, r) => s + r.adjusted_total_gal, 0);

    return NextResponse.json({
      startDate,
      endDate,
      totalSites: sites.length,
      overallFlow1Gal,
      overallFlow1Liters: Math.round(overallFlow1Gal * GALLONS_TO_LITERS),
      overallFlow2Gal,
      overallFlow2Liters: Math.round(overallFlow2Gal * GALLONS_TO_LITERS),
      overallGal,
      overallLiters: Math.round(overallGal * GALLONS_TO_LITERS),
      overallAdjustedFlow1Gal,
      overallAdjustedFlow1Liters: Math.round(overallAdjustedFlow1Gal * GALLONS_TO_LITERS),
      overallAdjustedFlow2Gal,
      overallAdjustedFlow2Liters: Math.round(overallAdjustedFlow2Gal * GALLONS_TO_LITERS),
      overallAdjustedGal,
      overallAdjustedLiters: Math.round(overallAdjustedGal * GALLONS_TO_LITERS),
      sites,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
