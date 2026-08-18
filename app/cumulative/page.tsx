'use client';
import { useEffect, useState } from 'react';

interface CumulativeSiteRecord {
  site_id: string;
  name: string;
  location: string;
  format_name: string;
  total_gal: number;
  total_liters: number;
  record_count: number;
  first_tx: string;
  last_tx: string;
}

interface CumulativeApiResponse {
  startDate: string;
  endDate: string;
  totalSites: number;
  overallGal: number;
  overallLiters: number;
  sites: CumulativeSiteRecord[];
  error?: string;
}

type Unit = 'gal' | 'liters';

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDaysAgoStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function CumulativePage() {
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState(getTodayStr());

  const [data, setData] = useState<CumulativeApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [unit, setUnit] = useState<Unit>('gal');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/cumulative?startDate=${startDate}&endDate=${endDate}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
        } else {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  function exportCsv() {
    if (!data || !data.sites.length) return;

    const unitLabel = unit === 'gal' ? 'Gallons' : 'Liters';
    const valKey = unit === 'gal' ? 'total_gal' : 'total_liters';
    const overallTotal = unit === 'gal' ? data.overallGal : data.overallLiters;

    const headers = [
      'Site ID',
      'Project Name',
      'Location',
      'Hardware Format',
      'Filter Start Date',
      'Filter End Date',
      'First Telemetry Date in Window',
      'Last Telemetry Date in Window',
      `Cumulative Volume (${unitLabel})`,
      '% of Total System Volume',
    ];

    const rows = data.sites.map((s) => {
      const vol = s[valKey];
      const pct = overallTotal > 0 ? ((vol / overallTotal) * 100).toFixed(1) + '%' : '0%';
      return [
        s.site_id,
        s.name,
        s.location,
        s.format_name,
        data.startDate,
        data.endDate,
        s.first_tx,
        s.last_tx,
        vol.toString(),
        pct,
      ];
    });

    // Add totals row
    rows.push([
      'TOTAL ALL SITES',
      'All Monitored Projects',
      'All Locations',
      'N/A',
      data.startDate,
      data.endDate,
      'N/A',
      'N/A',
      overallTotal.toString(),
      '100%',
    ]);

    const csvContent = [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Master_Cumulative_Water_Volume_${data.startDate}_to_${data.endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const filteredSites = (data?.sites ?? []).filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.site_id.toLowerCase().includes(q) ||
      s.location.toLowerCase().includes(q)
    );
  });

  const daySpan = Math.max(
    1,
    Math.round(
      (new Date(endDate + 'T00:00:00').getTime() - new Date(startDate + 'T00:00:00').getTime()) /
        86400000
    ) + 1
  );

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Master Cumulative Volume</h1>
          <p className="page-subtitle">Export and filter total water volume produced by site for any custom date range</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={exportCsv}
          disabled={!data || !data.sites.length || loading}
          style={{ padding: '10px 20px', fontSize: '0.9rem' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export Master CSV
        </button>
      </div>

      {/* Date Filter Control Bar */}
      <div className="card" style={{ marginBottom: 24, padding: 20 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Start Date</label>
            <input
              type="date"
              className="search-input"
              style={{ width: 160, padding: '7px 10px' }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>End Date</label>
            <input
              type="date"
              className="search-input"
              style={{ width: 160, padding: '7px 10px' }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 8 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Quick Range Presets</label>
            <div className="toggle-group">
              <button
                className={`toggle-btn ${startDate === '2026-01-01' && endDate === getTodayStr() ? 'active' : ''}`}
                onClick={() => { setStartDate('2026-01-01'); setEndDate(getTodayStr()); }}
              >
                2026 to Present
              </button>
              <button
                className={`toggle-btn ${startDate === getDaysAgoStr(90) ? 'active' : ''}`}
                onClick={() => { setStartDate(getDaysAgoStr(90)); setEndDate(getTodayStr()); }}
              >
                Last 90 Days
              </button>
              <button
                className={`toggle-btn ${startDate === getDaysAgoStr(30) ? 'active' : ''}`}
                onClick={() => { setStartDate(getDaysAgoStr(30)); setEndDate(getTodayStr()); }}
              >
                Last 30 Days
              </button>
              <button
                className={`toggle-btn ${startDate === '2025-01-01' ? 'active' : ''}`}
                onClick={() => { setStartDate('2025-01-01'); setEndDate(getTodayStr()); }}
              >
                All Time (2025+)
              </button>
            </div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Units</label>
            <div className="toggle-group">
              <button className={`toggle-btn ${unit === 'gal' ? 'active' : ''}`} onClick={() => setUnit('gal')}>Gallons</button>
              <button className={`toggle-btn ${unit === 'liters' ? 'active' : ''}`} onClick={() => setUnit('liters')}>Liters</button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Metric Strip */}
      {data && (
        <div className="metric-strip" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div className="metric-card" style={{ borderLeft: '4px solid var(--teal-500)' }}>
            <div className="metric-label">Total System Volume</div>
            <div className="metric-value">
              {unit === 'gal'
                ? (data.overallGal / 1000 >= 1000 ? `${(data.overallGal / 1000000).toFixed(2)}M` : `${(data.overallGal / 1000).toFixed(0)}K`)
                : (data.overallLiters / 1000 >= 1000 ? `${(data.overallLiters / 1000000).toFixed(2)}M` : `${(data.overallLiters / 1000).toFixed(0)}K`)}
            </div>
            <div className="metric-unit">{unit === 'gal' ? 'Gallons' : 'Liters'} in window</div>
          </div>

          <div className="metric-card">
            <div className="metric-label">Active Sites Tracked</div>
            <div className="metric-value">{data.totalSites}</div>
            <div className="metric-unit">Projects reporting</div>
          </div>

          <div className="metric-card">
            <div className="metric-label">Date Window Span</div>
            <div className="metric-value">{daySpan}</div>
            <div className="metric-unit">Total days selected</div>
          </div>

          <div className="metric-card">
            <div className="metric-label">Avg Daily System Flow</div>
            <div className="metric-value">
              {unit === 'gal'
                ? Math.round(data.overallGal / daySpan).toLocaleString()
                : Math.round(data.overallLiters / daySpan).toLocaleString()}
            </div>
            <div className="metric-unit">{unit === 'gal' ? 'Gallons / day' : 'Liters / day'}</div>
          </div>
        </div>
      )}

      {/* Main Data Table Card */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="card-title">Cumulative Volume per Site</span>
            <span className="badge badge-teal">
              {startDate} → {endDate}
            </span>
          </div>

          <div className="search-input-wrapper" style={{ maxWidth: 280 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              className="search-input"
              style={{ padding: '6px 10px 6px 32px', fontSize: '0.8rem' }}
              placeholder="Search site name, location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="data-table-wrapper">
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-secondary)', padding: '60px 24px' }}>
              <span className="loading-spinner" />
              Calculating cumulative volumes across custom date range…
            </div>
          ) : error ? (
            <div className="empty-state">
              <div className="empty-state-title">Error loading cumulative data</div>
              <div className="empty-state-desc">{error}</div>
            </div>
          ) : filteredSites.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No matching sites found</div>
              <div className="empty-state-desc">Try adjusting your date range or search query.</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Site ID</th>
                  <th>Project Name</th>
                  <th>Location</th>
                  <th>First TX in Window</th>
                  <th>Last TX in Window</th>
                  <th style={{ textAlign: 'right' }}>Cumulative ({unit === 'gal' ? 'Gallons' : 'Liters'})</th>
                  <th style={{ textAlign: 'right' }}>% of Total Volume</th>
                </tr>
              </thead>
              <tbody>
                {filteredSites.map((s) => {
                  const vol = unit === 'gal' ? s.total_gal : s.total_liters;
                  const overallTotal = unit === 'gal' ? data!.overallGal : data!.overallLiters;
                  const pct = overallTotal > 0 ? ((vol / overallTotal) * 100).toFixed(1) : '0';

                  return (
                    <tr key={s.site_id}>
                      <td><span className="badge badge-teal">{s.site_id}</span></td>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td>{s.location}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{s.first_tx}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{s.last_tx}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--teal-700)', fontSize: '0.9rem' }}>
                        {vol.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        <span className="badge badge-default" style={{ fontSize: '0.78rem' }}>{pct}%</span>
                      </td>
                    </tr>
                  );
                })}

                {/* Summary Row */}
                <tr style={{ background: 'var(--teal-50)', fontWeight: 700 }}>
                  <td colSpan={3} style={{ color: 'var(--teal-800)', fontSize: '0.88rem' }}>
                    TOTAL — All {filteredSites.length} Projects
                  </td>
                  <td colSpan={2} style={{ fontSize: '0.78rem', color: 'var(--teal-700)' }}>
                    {startDate} to {endDate}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--teal-800)', fontSize: '0.95rem' }}>
                    {(unit === 'gal' ? data!.overallGal : data!.overallLiters).toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--teal-800)' }}>100%</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
