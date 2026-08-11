import { NextRequest, NextResponse } from 'next/server';
import { getDb, initSchema } from '@/lib/db';

const GALLONS_TO_LITERS = 3.78541;

function getQuarter(dateStr: string): string {
  const month = parseInt(dateStr.slice(5, 7), 10);
  const year = dateStr.slice(0, 4);
  const q = Math.ceil(month / 3);
  return `Q${q} ${year}`;
}

export async function GET(req: NextRequest) {
  try {
    await initSchema();
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year') ?? '2026';

    const rowsRes = await db.execute({
      sql: `
        SELECT
          s.id AS site_id,
          s.name,
          s.location,
          substr(m.timestamp, 1, 10) AS date,
          SUM(COALESCE(m.flow_volume, 0) + COALESCE(m.flow2_volume, 0)) AS total_gal
        FROM messages m
        JOIN sites s ON s.id = m.site_id
        WHERE m.timestamp >= ? AND m.timestamp < ?
        GROUP BY s.id, s.name, s.location, substr(m.timestamp, 1, 10)
        ORDER BY s.name, date
      `,
      args: [`${year}-01-01`, `${parseInt(year) + 1}-01-01`],
    });

    const rows = rowsRes.rows as unknown as {
      site_id: string;
      name: string | null;
      location: string | null;
      date: string;
      total_gal: number;
    }[];

    const siteMap = new Map<string, {
      site_id: string;
      name: string;
      location: string;
      quarters: Record<string, number>;
    }>();

    for (const row of rows) {
      const q = getQuarter(row.date);
      if (!siteMap.has(row.site_id)) {
        siteMap.set(row.site_id, {
          site_id: row.site_id,
          name: row.name || row.site_id || 'Unnamed Site',
          location: row.location || 'N/A',
          quarters: {},
        });
      }
      const entry = siteMap.get(row.site_id)!;
      entry.quarters[q] = (entry.quarters[q] ?? 0) + row.total_gal;
    }

    const quarters = [`Q1 ${year}`, `Q2 ${year}`, `Q3 ${year}`, `Q4 ${year}`];

    const data = Array.from(siteMap.values())
      .filter((s) => Object.values(s.quarters).some((v) => v > 0))
      .map((s) => {
        const result: Record<string, unknown> = {
          site_id: s.site_id,
          name: s.name,
          location: s.location,
        };
        let totalGal = 0;
        for (const q of quarters) {
          const gal = Math.round(s.quarters[q] ?? 0);
          result[`${q}_gal`] = gal;
          result[`${q}_liters`] = Math.round(gal * GALLONS_TO_LITERS);
          totalGal += gal;
        }
        result.total_gal = Math.round(totalGal);
        result.total_liters = Math.round(totalGal * GALLONS_TO_LITERS);
        return result;
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    return NextResponse.json({ year, quarters, data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
