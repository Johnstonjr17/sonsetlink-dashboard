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
