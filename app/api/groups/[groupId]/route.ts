import { NextRequest, NextResponse } from 'next/server';
import { getDb, initSchema } from '@/lib/db';

const GALLONS_TO_LITERS = 3.78541;

function getIsoWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    await initSchema();
    const { groupId } = await params;
    const db = getDb();

    // 1. Fetch group details
    const groupRes = await db.execute({
      sql: `SELECT * FROM groups WHERE id = ?`,
      args: [groupId],
    });
    const group = groupRes.rows[0];
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // 2. Fetch member sites with roles
    const sitesRes = await db.execute({
      sql: `
        SELECT gs.site_id, gs.role, s.name, s.location
        FROM group_sites gs
        LEFT JOIN sites s ON s.id = gs.site_id
        WHERE gs.group_id = ?
      `,
      args: [groupId],
    });

    const memberSites = sitesRes.rows as unknown as { site_id: string; role: 'production' | 'distribution'; name: string; location: string }[];
    const prodSiteIds = memberSites.filter((s) => s.role === 'production').map((s) => s.site_id);
    const distSiteIds = memberSites.filter((s) => s.role === 'distribution').map((s) => s.site_id);

    if (!prodSiteIds.length || !distSiteIds.length) {
      return NextResponse.json({
        group,
        memberSites,
        sharedStart: null,
        sharedEnd: null,
        daily: [],
        weekly: [],
        summary: null,
      });
    }

    const allMemberIds = [...prodSiteIds, ...distSiteIds];

    // 3. Auto-detect shared date window across ALL participating sites
    // sharedStart = MAX(min_date of each site)
    // sharedEnd   = MIN(max_date of each site)
    const minDates: string[] = [];
    const maxDates: string[] = [];

    for (const siteId of allMemberIds) {
      const rangeRes = await db.execute({
        sql: `SELECT MIN(substr(timestamp, 1, 10)) as min_d, MAX(substr(timestamp, 1, 10)) as max_d FROM messages WHERE site_id = ? AND timestamp >= '2025-01-01'`,
        args: [siteId],
      });
      const row = rangeRes.rows[0];
      if (row?.min_d) minDates.push(String(row.min_d));
      if (row?.max_d) maxDates.push(String(row.max_d));
    }

    if (!minDates.length) {
      return NextResponse.json({
        group,
        memberSites,
        sharedStart: null,
        sharedEnd: null,
        daily: [],
        weekly: [],
        summary: null,
      });
    }

    const sharedStart = minDates.reduce((a, b) => (a > b ? a : b));
    const sharedEnd = maxDates.reduce((a, b) => (a < b ? a : b));

    // 4. Fetch daily flow totals for production sites
    const prodPlaceholders = prodSiteIds.map(() => '?').join(',');
    const prodFlowRes = await db.execute({
      sql: `
        SELECT
          substr(timestamp, 1, 10) as date,
          SUM(COALESCE(flow_volume, 0) + COALESCE(flow2_volume, 0)) as gal
        FROM messages
        WHERE site_id IN (${prodPlaceholders})
          AND substr(timestamp, 1, 10) >= ?
          AND substr(timestamp, 1, 10) <= ?
        GROUP BY substr(timestamp, 1, 10)
        ORDER BY date ASC
      `,
      args: [...prodSiteIds, sharedStart, sharedEnd],
    });

    // 5. Fetch daily flow totals for distribution sites
    const distPlaceholders = distSiteIds.map(() => '?').join(',');
    const distFlowRes = await db.execute({
      sql: `
        SELECT
          substr(timestamp, 1, 10) as date,
          SUM(COALESCE(flow_volume, 0) + COALESCE(flow2_volume, 0)) as gal
        FROM messages
        WHERE site_id IN (${distPlaceholders})
          AND substr(timestamp, 1, 10) >= ?
          AND substr(timestamp, 1, 10) <= ?
        GROUP BY substr(timestamp, 1, 10)
        ORDER BY date ASC
      `,
      args: [...distSiteIds, sharedStart, sharedEnd],
    });

    const prodMap = new Map<string, number>();
    for (const r of prodFlowRes.rows) {
      prodMap.set(String(r.date), Number(r.gal ?? 0));
    }

    const distMap = new Map<string, number>();
    for (const r of distFlowRes.rows) {
      distMap.set(String(r.date), Number(r.gal ?? 0));
    }

    // Build date spine
    const allDates = Array.from(new Set([...prodMap.keys(), ...distMap.keys()])).sort();

    let cumulProdGal = 0;
    let cumulDistGal = 0;

    const daily = allDates.map((date, idx, arr) => {
      const prodGal = Math.round(prodMap.get(date) ?? 0);
      const distGal = Math.round(distMap.get(date) ?? 0);
      const balanceGal = prodGal - distGal;

      const prodLit = Math.round(prodGal * GALLONS_TO_LITERS);
      const distLit = Math.round(distGal * GALLONS_TO_LITERS);
      const balanceLit = prodLit - distLit;

      const pctAccounted = prodGal > 0 ? Number(((distGal / prodGal) * 100).toFixed(1)) : 0;

      cumulProdGal += prodGal;
      cumulDistGal += distGal;

      // 7-day rolling window
      const startIdx = Math.max(0, idx - 6);
      const windowSlice = arr.slice(startIdx, idx + 1);
      const roll7Prod = windowSlice.reduce((s, d) => s + (prodMap.get(d) ?? 0), 0);
      const roll7Dist = windowSlice.reduce((s, d) => s + (distMap.get(d) ?? 0), 0);
      const roll7Balance = roll7Prod - roll7Dist;
      const roll7Pct = roll7Prod > 0 ? Number(((roll7Dist / roll7Prod) * 100).toFixed(1)) : 0;

      return {
        date,
        prod_gal: prodGal,
        prod_liters: prodLit,
        dist_gal: distGal,
        dist_liters: distLit,
        balance_gal: balanceGal,
        balance_liters: balanceLit,
        pct_accounted: pctAccounted,

        roll7_prod_gal: Math.round(roll7Prod),
        roll7_dist_gal: Math.round(roll7Dist),
        roll7_balance_gal: Math.round(roll7Balance),
        roll7_pct_accounted: roll7Pct,

        cumul_prod_gal: Math.round(cumulProdGal),
        cumul_dist_gal: Math.round(cumulDistGal),
        cumul_balance_gal: Math.round(cumulProdGal - cumulDistGal),
      };
    });

    // 6. Build Weekly Rollup
    const weekMap = new Map<string, { week: string; prod_gal: number; dist_gal: number }>();
    for (const d of daily) {
      const w = getIsoWeek(d.date);
      if (!weekMap.has(w)) {
        weekMap.set(w, { week: w, prod_gal: 0, dist_gal: 0 });
      }
      const entry = weekMap.get(w)!;
      entry.prod_gal += d.prod_gal;
      entry.dist_gal += d.dist_gal;
    }

    const weekly = Array.from(weekMap.values()).map((w) => {
      const balanceGal = w.prod_gal - w.dist_gal;
      const prodLit = Math.round(w.prod_gal * GALLONS_TO_LITERS);
      const distLit = Math.round(w.dist_gal * GALLONS_TO_LITERS);
      const balanceLit = prodLit - distLit;
      const pct = w.prod_gal > 0 ? Number(((w.dist_gal / w.prod_gal) * 100).toFixed(1)) : 0;

      return {
        week: w.week,
        prod_gal: Math.round(w.prod_gal),
        prod_liters: prodLit,
        dist_gal: Math.round(w.dist_gal),
        dist_liters: distLit,
        balance_gal: Math.round(balanceGal),
        balance_liters: balanceLit,
        pct_accounted: pct,
      };
    });

    // 7. Overall Summary
    const totalProdGal = daily.reduce((s, r) => s + r.prod_gal, 0);
    const totalDistGal = daily.reduce((s, r) => s + r.dist_gal, 0);
    const netBalanceGal = totalProdGal - totalDistGal;
    const overallPctAccounted = totalProdGal > 0 ? Number(((totalDistGal / totalProdGal) * 100).toFixed(1)) : 0;

    const summary = {
      total_prod_gal: totalProdGal,
      total_prod_liters: Math.round(totalProdGal * GALLONS_TO_LITERS),
      total_dist_gal: totalDistGal,
      total_dist_liters: Math.round(totalDistGal * GALLONS_TO_LITERS),
      net_balance_gal: netBalanceGal,
      net_balance_liters: Math.round(netBalanceGal * GALLONS_TO_LITERS),
      pct_accounted: overallPctAccounted,
      days_tracked: daily.length,
    };

    return NextResponse.json({
      group,
      memberSites,
      sharedStart,
      sharedEnd,
      daily,
      weekly,
      summary,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    await initSchema();
    const { groupId } = await params;
    const db = getDb();

    await db.execute({
      sql: `DELETE FROM group_sites WHERE group_id = ?`,
      args: [groupId],
    });
    await db.execute({
      sql: `DELETE FROM groups WHERE id = ?`,
      args: [groupId],
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
