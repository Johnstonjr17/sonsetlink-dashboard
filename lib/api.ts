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

export async function fetchAllSites(): Promise<SiteRecord[]> {
  const res = await fetch(`${BASE_URL}/sites`, { headers: defaultHeaders });
  if (!res.ok) throw new Error(`Failed to fetch sites: ${res.status}`);
  const json = await res.json();
  return json.data ?? [];
}

export async function fetchSiteUnitDetails(siteId: string): Promise<UnitDetails> {
  try {
    const res = await fetch(`${BASE_URL}/sites/${siteId}/unit`, { headers: defaultHeaders });
    if (!res.ok) return { install_date: null, ship_date: null };
    const json = await res.json();
    const attrs = json.data?.attributes ?? {};
    return {
      install_date: attrs.install_date ?? null,
      ship_date: attrs.ship_date ?? null,
    };
  } catch {
    return { install_date: null, ship_date: null };
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
    const res = await fetch(url, { headers: defaultHeaders });
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
