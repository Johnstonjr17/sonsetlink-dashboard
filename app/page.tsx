'use client';
import { useEffect, useState } from 'react';
import SiteCard from '@/components/SiteCard';

interface Site {
  id: string;
  name: string;
  location: string;
  format_name: string;
  most_recent_tx: string | null;
  latest_battery: number | null;
  record_count: number;
  total_flow_gal: number | null;
  last_synced_at: string | null;
}

export default function HomePage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/sites')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); } else { setSites(d.sites ?? []); }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = sites.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.id?.toLowerCase().includes(q) ||
      s.location?.toLowerCase().includes(q)
    );
  });

  const lastSync = sites.find((s) => s.last_synced_at)?.last_synced_at;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Water Flow Dashboard</h1>
        <p className="page-subtitle">
          {lastSync
            ? `Last synced ${new Date(lastSync).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · ${sites.length} monitored sites`
            : 'Click "Sync Now" in the top right to load data from SonSetLink API'}
        </p>
      </div>

      {error && (
        <div className="sync-bar" style={{ marginBottom: 20, background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {error.includes('no such table') ? 'No data yet — click "Sync Now" to pull data from the API.' : error}
        </div>
      )}

      {!loading && !error && sites.length === 0 && (
        <div className="sync-bar" style={{ marginBottom: 20 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          No sites yet. Click <strong>"Sync Now"</strong> in the top bar to load your sites.
        </div>
      )}

      <div className="search-row">
        <div className="search-input-wrapper">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className="search-input"
            placeholder="Search by site name, ID, or location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="sites-count">
          {loading ? 'Loading…' : `${filtered.length} sites`}
        </span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-secondary)', padding: '40px 0' }}>
          <span className="loading-spinner" />
          Loading sites…
        </div>
      ) : (
        <div className="sites-grid">
          {filtered.map((site) => (
            <SiteCard key={site.id} {...site} />
          ))}
        </div>
      )}
    </>
  );
}
