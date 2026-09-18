export function formatSiteTime(
  utcTimestampStr: string | null | undefined,
  timeZone?: string | null
): string {
  if (!utcTimestampStr) return 'N/A';

  // Normalize string for Date constructor
  const cleanStr = utcTimestampStr.replace(' ', 'T') + (utcTimestampStr.includes('Z') ? '' : 'Z');
  const d = new Date(cleanStr);
  if (isNaN(d.getTime())) return utcTimestampStr;

  const targetTz = timeZone || 'UTC';

  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: targetTz,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }).format(d);

    return formatted;
  } catch {
    return `${utcTimestampStr} (UTC)`;
  }
}

export function fillDailyGaps(rawRows: any[]): any[] {
  if (!rawRows || rawRows.length === 0) return [];

  const rowMap = new Map<string, any>();
  for (const r of rawRows) {
    rowMap.set(String(r.date), r);
  }

  const startDate = new Date(String(rawRows[0].date) + 'T00:00:00Z');
  const endDate = new Date(String(rawRows[rawRows.length - 1].date) + 'T00:00:00Z');

  const filled: any[] = [];
  const curr = new Date(startDate);

  while (curr <= endDate) {
    const dateStr = curr.toISOString().slice(0, 10);
    const existing = rowMap.get(dateStr);
    if (existing) {
      filled.push(existing);
    } else {
      filled.push({
        date: dateStr,
        total_gal: 0,
        total_liters: 0,
        flow1_gal: 0,
        flow2_gal: 0,
        total_mins: 0,
        daily_avg_gpm: 0,
        daily_avg_lpm: 0,
        avg_battery: null,
        transmissions: 0,
      });
    }
    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  return filled;
}
