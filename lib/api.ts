const API_TOKEN = 'NhIZQ4PpIow6DWvj9w6Q9VBw9QLz8H6B7UOZ3gwyec1ee111';
const BASE_URL = 'https://app.sonsetlink.org/api/v1';

const defaultHeaders = {
  Authorization: `Bearer ${API_TOKEN}`,
  Accept: 'application/vnd.api+json',
};

export interface SiteAttributes {
  name: string;
  location: string;
  format_name: string;
  most_recent_tx: string;
  timezone: string | null;
}

export interface SiteRecord {
  id: string;
  attributes: SiteAttributes;
}

export interface MessageAttributes {
  timestamp: string;
  flow_volume: number | null;
  flow2_volume: number | null;
  dosing_pump: number | null;
  time_in_use: number | null;
  battery_voltage: number | null;
  slot: number | null;
  backfill: number | null;
}

export interface MessageRecord {
  id: string;
  attributes: MessageAttributes;
}

export interface UnitDetails {
  install_date: string | null;
  ship_date: string | null;
}

export interface NotificationAttributes {
  site_identifier: string;
  timestamp: string;
  notification_type_name: string;
  info: any;
  severity: number;
  unresolved: boolean;
}

export interface NotificationRecord {
  id: string;
  attributes: NotificationAttributes;
}

export async function fetchAllSites(): Promise<SiteRecord[]> {
  const res = await fetch(`${BASE_URL}/sites?page[size]=100`, {
    headers: defaultHeaders,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch sites: ${res.status}`);
  const json = await res.json();
  return json.data ?? [];
}

export async function fetchAllUnits(): Promise<Map<string, UnitDetails>> {
  const unitMap = new Map<string, UnitDetails>();
  try {
    const res = await fetch(`${BASE_URL}/units?page[size]=100`, {
      headers: defaultHeaders,
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json();
      const units: any[] = json.data ?? [];
      for (const u of units) {
        const siteId = u.attributes?.site_identifier || u.id;
        unitMap.set(siteId, {
          install_date: u.attributes?.install_date ?? null,
          ship_date: u.attributes?.ship_date ?? null,
        });
      }
    }
  } catch (e) {
    console.error('Error fetching units:', e);
  }
  return unitMap;
}

export async function fetchAllNotifications(): Promise<NotificationRecord[]> {
  try {
    const res = await fetch(`${BASE_URL}/notifications?page[size]=100&sort=-timestamp`, {
      headers: defaultHeaders,
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data ?? [];
  } catch {
    return [];
  }
}

export async function fetchSiteMessages(
  siteId: string,
  sinceDate: string = '2025-01-01 00:00:00'
): Promise<MessageRecord[]> {
  const allRecords: MessageRecord[] = [];
  let page = 1;

  while (true) {
    const encodedDate = encodeURIComponent(sinceDate);
    const url = `${BASE_URL}/sites/${siteId}/usage3-messages?filter[timestamp-gte]=${encodedDate}&page[number]=${page}&page[size]=1000&sort=timestamp`;
    
    let res = await fetch(url, {
      headers: defaultHeaders,
      cache: 'no-store',
    });

    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2000));
      res = await fetch(url, {
        headers: defaultHeaders,
        cache: 'no-store',
      });
    }

    if (!res.ok) break;

    const json = await res.json();
    const records: MessageRecord[] = json.data ?? [];
    const meta = json.meta?.page ?? {};

    allRecords.push(...records);

    if (page >= (meta.lastPage ?? 1)) break;
    page++;
  }

  return allRecords;
}
