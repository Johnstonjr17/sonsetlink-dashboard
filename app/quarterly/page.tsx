'use client';
import { useEffect, useState } from 'react';
import { QuarterlyGroupedBar, QuarterlyAreaChart } from '@/components/QuarterlyCharts';

interface QuarterlySiteData {
  site_id: string;
  name: string;
  location: string;
  total_gal: number;
  total_liters: number;
  [key: string]: unknown;
}

type Unit = 'gal' | 'liters';
type ChartType = 'bar' | 'area';

const GALLONS_TO_LITERS = 3.78541;

export default function QuarterlyPage() {
  const [data, setData] = useState<QuarterlySiteData[]>([]);
  const [quarters, setQuarters] = useState<string[]>([]);
  const [year, setYear] = useState('2026');
  const [unit, setUnit] = useState<Unit>('gal');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/quarterly?year=${year}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); } else {
          setData(d.data ?? []);
          setQuarters(d.quarters ?? []);
          setError(null);
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [year]);

  const totalGal = data.reduce((s, r) => s + (r.total_gal ?? 0), 0);
  const totalLiters = Math.round(totalGal * GALLONS_TO_LITERS);

  function exportCsv() {
    if (!data.length) return;
    const suffix = unit === 'gal' ? '_gal' : '_liters';
    const unitLabel = unit === 'gal' ? 'Gallons' : 'Liters';
    const headers = ['Site ID', 'Project Name', 'Location', ...quarters.map((q) => `${q} (${unitLabel})`), `Total (${unitLabel})`];
    const rows = data.map((s) => [
      s.site_id,
      s.name,
      s.location,
      ...quarters.map((q) => String(s[`${q}${suffix}`] ?? 0)),
      String(unit === 'gal' ? s.total_gal : s.total_liters),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Quarterly_Flow_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Quarterly Water Flow</h1>
        <p className="page-subtitle">Total volumetric flow per quarter across all monitored project sites</p>
      </div>

      {/* Metric Strip */}
      <div className="metric-strip" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="metric-card">
          <div className="metric-label">Total Flow {year} (Gal)</div>
          <div className="metric-value">{(totalGal / 1000).toFixed(0)}K</div>
          <div className="metric-unit">Gallons across all sites</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total Flow {year} (L)</div>
          <div className="metric-value">{(totalLiters / 1000).toFixed(0)}K</div>
          <div className="metric-unit">Liters across all sites</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Active Sites</div>
          <div className="metric-value">{data.length}</div>
          <div className="metric-unit">Sites with flow data</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Quarters Tracked</div>
          <div className="metric-value">{quarters.filter((q) => data.some((s) => (s[`${q}_gal`] as number) > 0)).length}</div>
          <div className="metric-unit">Of {quarters.length} in {year}</div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div className="toggle-group">
          <button className={`toggle-btn ${year === '2025' ? 'active' : ''}`} onClick={() => setYear('2025')}>2025</button>
          <button className={`toggle-btn ${year === '2026' ? 'active' : ''}`} onClick={() => setYear('2026')}>2026</button>
        </div>
        <div className="toggle-group">
          <button className={`toggle-btn ${unit === 'gal' ? 'active' : ''}`} onClick={() => setUnit('gal')}>Gallons</button>
          <button className={`toggle-btn ${unit === 'liters' ? 'active' : ''}`} onClick={() => setUnit('liters')}>Liters</button>
        </div>
        <div className="toggle-group">
          <button className={`toggle-btn ${chartType === 'bar' ? 'active' : ''}`} onClick={() => setChartType('bar')}>Bar Chart</button>
          <button className={`toggle-btn ${chartType === 'area' ? 'active' : ''}`} onClick={() => setChartType('area')}>Area Chart</button>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-outline btn-sm" onClick={exportCsv}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">
            {chartType === 'bar' ? 'Flow by Site per Quarter' : 'Quarterly Trend by Site'} ({year})
          </span>
          <span className="badge badge-teal">{unit === 'gal' ? 'Gallons' : 'Liters'}</span>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-secondary)', padding: '40px 0' }}>
              <span className="loading-spinner" />
              Loading quarterly data…
            </div>
          ) : error ? (
            <div className="empty-state">
              <div className="empty-state-title">No data yet</div>
              <div className="empty-state-desc">Click "Sync Now" to pull data from the API first.</div>
            </div>
          ) : data.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">💧</div>
              <div className="empty-state-title">No flow data for {year}</div>
              <div className="empty-state-desc">Try syncing or selecting a different year.</div>
            </div>
          ) : (
            <div className="chart-container-tall" style={{ height: 420 }}>
              {chartType === 'bar'
                ? <QuarterlyGroupedBar data={data} quarters={quarters} unit={unit} />
                : <QuarterlyAreaChart data={data} quarters={quarters} unit={unit} />
              }
            </div>
          )}
        </div>
      </div>

      {/* Summary Table */}
      {data.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Site Summary — {year}</span>
            <span className="badge badge-default">{data.length} sites</span>
          </div>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Site ID</th>
                  <th>Project Name</th>
                  <th>Location</th>
                  {quarters.map((q) => <th key={q}>{q}</th>)}
                  <th>Total (Gal)</th>
                  <th>Total (L)</th>
                </tr>
              </thead>
              <tbody>
                {data.map((s) => (
                  <tr key={s.site_id}>
                    <td><span className="badge badge-teal">{s.site_id}</span></td>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td>{s.location || '—'}</td>
                    {quarters.map((q) => (
                      <td key={q} style={{ textAlign: 'right' }}>
                        {((s[`${q}_gal`] as number) > 0 || (s[`${q}_liters`] as number) > 0)
                          ? unit === 'gal'
                            ? (s[`${q}_gal`] as number)?.toLocaleString()
                            : (s[`${q}_liters`] as number)?.toLocaleString()
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>
                        }
                      </td>
                    ))}
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{s.total_gal.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{s.total_liters.toLocaleString()}</td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr style={{ background: 'var(--teal-50)', fontWeight: 700 }}>
                  <td colSpan={3} style={{ color: 'var(--teal-700)' }}>TOTAL — All Sites</td>
                  {quarters.map((q) => (
                    <td key={q} style={{ textAlign: 'right', color: 'var(--teal-700)' }}>
                      {unit === 'gal'
                        ? data.reduce((s, r) => s + ((r[`${q}_gal`] as number) ?? 0), 0).toLocaleString()
                        : data.reduce((s, r) => s + ((r[`${q}_liters`] as number) ?? 0), 0).toLocaleString()
                      }
                    </td>
                  ))}
                  <td style={{ textAlign: 'right', color: 'var(--teal-700)' }}>{totalGal.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', color: 'var(--teal-700)' }}>{totalLiters.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
