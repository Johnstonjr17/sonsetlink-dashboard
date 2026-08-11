import { NextRequest, NextResponse } from 'next/server';
import { getDb, initSchema } from '@/lib/db';

export async function GET() {
  try {
    await initSchema();
    const db = getDb();

    const groupsRes = await db.execute(`
      SELECT id, name, description, created_at
      FROM groups
      ORDER BY name ASC
    `);

    const groupSitesRes = await db.execute(`
      SELECT gs.group_id, gs.site_id, gs.role, s.name as site_name, s.location
      FROM group_sites gs
      LEFT JOIN sites s ON s.id = gs.site_id
    `);

    const siteMap = new Map<string, { id: string; name: string; role: string; location: string }[]>();
    for (const row of groupSitesRes.rows) {
      const gId = String(row.group_id);
      if (!siteMap.has(gId)) siteMap.set(gId, []);
      siteMap.get(gId)!.push({
        id: String(row.site_id),
        name: String(row.site_name || row.site_id),
        role: String(row.role),
        location: String(row.location || ''),
      });
    }

    const groups = groupsRes.rows.map((g) => {
      const gId = String(g.id);
      const members = siteMap.get(gId) || [];
      return {
        id: gId,
        name: g.name,
        description: g.description,
        created_at: g.created_at,
        productionSites: members.filter((m) => m.role === 'production'),
        distributionSites: members.filter((m) => m.role === 'distribution'),
      };
    });

    return NextResponse.json({ groups });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const db = getDb();
    const body = await req.json();

    const { name, description, productionSites, distributionSites } = body;

    if (!name || !productionSites?.length || !distributionSites?.length) {
      return NextResponse.json(
        { error: 'Group name, at least 1 Production site, and at least 1 Distribution site are required.' },
        { status: 400 }
      );
    }

    const groupId = 'group-' + Date.now();
    await db.execute({
      sql: `INSERT INTO groups (id, name, description, created_at) VALUES (?, ?, ?, ?)`,
      args: [groupId, name.trim(), description?.trim() || null, new Date().toISOString()],
    });

    const siteStatements: { sql: string; args: (string | null)[] }[] = [];

    for (const siteId of productionSites) {
      siteStatements.push({
        sql: `INSERT INTO group_sites (group_id, site_id, role) VALUES (?, ?, ?)`,
        args: [groupId, siteId, 'production'],
      });
    }

    for (const siteId of distributionSites) {
      siteStatements.push({
        sql: `INSERT INTO group_sites (group_id, site_id, role) VALUES (?, ?, ?)`,
        args: [groupId, siteId, 'distribution'],
      });
    }

    await db.batch(siteStatements, 'write');

    return NextResponse.json({ success: true, groupId });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
