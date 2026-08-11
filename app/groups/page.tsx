'use client';
import { useEffect, useState } from 'react';
import { ProductionVsDistributionChart, CumulativeBalanceChart } from '@/components/WaterBalanceCharts';

interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  productionSites: { id: string; name: string; location: string }[];
  distributionSites: { id: string; name: string; location: string }[];
}

interface SiteOption {
  id: string;
  name: string;
  location: string;
}

interface GroupAccountingData {
  group: GroupSummary;
  memberSites: { site_id: string; role: 'production' | 'distribution'; name: string; location: string }[];
  sharedStart: string | null;
  sharedEnd: string | null;
  daily: {
    date: string;
    prod_gal: number;
    prod_liters: number;
    dist_gal: number;
    dist_liters: number;
    balance_gal: number;
    balance_liters: number;
    pct_accounted: number;
    roll7_pct_accounted: number;
    cumul_balance_gal: number;
  }[];
  weekly: {
    week: string;
    prod_gal: number;
    prod_liters: number;
    dist_gal: number;
    dist_liters: number;
    balance_gal: number;
    balance_liters: number;
    pct_accounted: number;
  }[];
  summary: {
    total_prod_gal: number;
    total_prod_liters: number;
    total_dist_gal: number;
    total_dist_liters: number;
    net_balance_gal: number;
    net_balance_liters: number;
    pct_accounted: number;
    days_tracked: number;
  } | null;
}

type Unit = 'gal' | 'liters';
type Tab = 'daily' | 'weekly';

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [accounting, setAccounting] = useState<GroupAccountingData | null>(null);
  const [allSites, setAllSites] = useState<SiteOption[]>([]);

  const [unit, setUnit] = useState<Unit>('gal');
  const [tab, setTab] = useState<Tab>('daily');
  const [loading, setLoading] = useState(true);
  const [accountingLoading, setAccountingLoading] = useState(false);

  // Create Group Form Modal State
  const [showModal, setShowModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [selectedProdSites, setSelectedProdSites] = useState<string[]>([]);
  const [selectedDistSites, setSelectedDistSites] = useState<string[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);

  // Load Groups and Sites
  useEffect(() => {
    Promise.all([
      fetch('/api/groups').then((r) => r.json()),
      fetch('/api/sites').then((r) => r.json()),
    ])
      .then(([gData, sData]) => {
        const loadedGroups = gData.groups ?? [];
        setGroups(loadedGroups);
        setAllSites(sData.sites ?? []);
        if (loadedGroups.length > 0) {
          setSelectedGroupId(loadedGroups[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Load accounting data for selected group
  useEffect(() => {
    if (!selectedGroupId) return;
    setAccountingLoading(true);
    fetch(`/api/groups/${selectedGroupId}`)
      .then((r) => r.json())
      .then((d) => setAccounting(d))
      .finally(() => setAccountingLoading(false));
  }, [selectedGroupId]);

  function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim()) {
      setCreateError('Please enter a group name');
      return;
    }
    if (selectedProdSites.length === 0) {
      setCreateError('Please select at least 1 Production site');
      return;
    }
    if (selectedDistSites.length === 0) {
      setCreateError('Please select at least 1 Distribution site');
      return;
    }

    setCreateError(null);
    fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newGroupName,
        description: newGroupDesc,
        productionSites: selectedProdSites,
        distributionSites: selectedDistSites,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setShowModal(false);
          setNewGroupName('');
          setNewGroupDesc('');
          setSelectedProdSites([]);
          setSelectedDistSites([]);
          // Reload groups
          fetch('/api/groups')
            .then((r) => r.json())
            .then((gData) => {
              setGroups(gData.groups ?? []);
              setSelectedGroupId(d.groupId);
            });
        } else {
          setCreateError(d.error || 'Failed to create group');
        }
      })
      .catch((err) => setCreateError(String(err)));
  }

  function exportCsv() {
    if (!accounting || !accounting.daily.length) return;
    const unitLabel = unit === 'gal' ? 'Gal' : 'L';
    const prodKey = unit === 'gal' ? 'prod_gal' : 'prod_liters';
    const distKey = unit === 'gal' ? 'dist_gal' : 'dist_liters';
    const balKey = unit === 'gal' ? 'balance_gal' : 'balance_liters';

    const headers = ['Date', `Production (${unitLabel})`, `Distribution (${unitLabel})`, `Net Variance (${unitLabel})`, '% Accounted', '7-Day Rolling %'];
    const rows = accounting.daily.map((r) => [
      r.date,
      r[prodKey],
      r[distKey],
      r[balKey],
      `${r.pct_accounted}%`,
      `${r.roll7_pct_accounted}%`,
    ]);

    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${accounting.group.name.replace(/\s+/g, '_')}_Water_Balance.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const currentGroup = groups.find((g) => g.id === selectedGroupId);
  const summary = accounting?.summary;

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Flow Accounting & Water Balance</h1>
          <p className="page-subtitle">Track production vs. distribution losses across custom site networks</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          + Create New Group
        </button>
      </div>

      {/* Group Selector bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Selected Group:</span>
          <select
            className="search-input"
            style={{ padding: '7px 14px', width: 'auto', minWidth: 220, cursor: 'pointer' }}
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        {accounting?.sharedStart && (
          <span className="badge badge-teal" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            📅 Shared Window: {accounting.sharedStart} to {accounting.sharedEnd} ({summary?.days_tracked} days)
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <div className="toggle-group">
            <button className={`toggle-btn ${unit === 'gal' ? 'active' : ''}`} onClick={() => setUnit('gal')}>Gallons</button>
            <button className={`toggle-btn ${unit === 'liters' ? 'active' : ''}`} onClick={() => setUnit('liters')}>Liters</button>
          </div>
          <button className="btn btn-outline btn-sm" onClick={exportCsv} disabled={!accounting?.daily.length}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {currentGroup && (
        <div style={{ background: 'var(--gray-100)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 24, fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
          <strong>Network Configuration: </strong>
          <span style={{ color: 'var(--teal-700)', fontWeight: 600 }}>Production: </span>
          {currentGroup.productionSites.map((s) => s.name || s.id).join(', ')}
          <span style={{ margin: '0 12px', color: 'var(--gray-300)' }}>|</span>
          <span style={{ color: '#6366f1', fontWeight: 600 }}>Distribution: </span>
          {currentGroup.distributionSites.map((s) => s.name || s.id).join(', ')}
        </div>
      )}

      {accountingLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-secondary)', padding: '60px 0' }}>
          <span className="loading-spinner" />
          Calculating flow accounting across shared date range…
        </div>
      ) : summary ? (
        <>
          {/* Summary Metric Strip */}
          <div className="metric-strip" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div className="metric-card" style={{ borderLeft: '4px solid #0d9488' }}>
              <div className="metric-label">Total Produced</div>
              <div className="metric-value">
                {unit === 'gal'
                  ? `${(summary.total_prod_gal / 1000).toFixed(1)}K`
                  : `${(summary.total_prod_liters / 1000).toFixed(1)}K`}
              </div>
              <div className="metric-unit">{unit === 'gal' ? 'Gallons' : 'Liters'}</div>
            </div>

            <div className="metric-card" style={{ borderLeft: '4px solid #6366f1' }}>
              <div className="metric-label">Total Distributed</div>
              <div className="metric-value">
                {unit === 'gal'
                  ? `${(summary.total_dist_gal / 1000).toFixed(1)}K`
                  : `${(summary.total_dist_liters / 1000).toFixed(1)}K`}
              </div>
              <div className="metric-unit">{unit === 'gal' ? 'Gallons' : 'Liters'}</div>
            </div>

            <div className="metric-card" style={{ borderLeft: '4px solid #10b981' }}>
              <div className="metric-label">Net Variance / Storage</div>
              <div className="metric-value">
                {unit === 'gal'
                  ? `${(summary.net_balance_gal / 1000).toFixed(1)}K`
                  : `${(summary.net_balance_liters / 1000).toFixed(1)}K`}
              </div>
              <div className="metric-unit">{unit === 'gal' ? 'Gallons (Produced - Dist)' : 'Liters'}</div>
            </div>

            <div className="metric-card" style={{ borderLeft: `4px solid ${summary.pct_accounted >= 90 ? '#16a34a' : '#d97706'}` }}>
              <div className="metric-label">% Water Accounted For</div>
              <div className="metric-value" style={{ color: summary.pct_accounted >= 90 ? '#16a34a' : '#d97706' }}>
                {summary.pct_accounted}%
              </div>
              <div className="metric-unit">Overall network efficiency</div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <span className="card-title">Daily Water Balance — Production vs Distribution</span>
              <span className="badge badge-teal">Shared Date Window</span>
            </div>
            <div className="card-body">
              <div className="chart-container-tall" style={{ height: 380 }}>
                <ProductionVsDistributionChart data={accounting.daily} unit={unit} />
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <span className="card-title">Cumulative Water Balance Trend</span>
              <span className="badge badge-default">Storage Accumulation</span>
            </div>
            <div className="card-body">
              <div className="chart-container" style={{ height: 280 }}>
                <CumulativeBalanceChart data={accounting.daily} unit={unit} />
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Flow Accounting Data Table</span>
              <div className="toggle-group">
                <button className={`toggle-btn ${tab === 'daily' ? 'active' : ''}`} onClick={() => setTab('daily')}>Daily Breakdown</button>
                <button className={`toggle-btn ${tab === 'weekly' ? 'active' : ''}`} onClick={() => setTab('weekly')}>Weekly Rollup</button>
              </div>
            </div>
            <div className="data-table-wrapper">
              {tab === 'daily' ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th style={{ textAlign: 'right' }}>Production ({unit === 'gal' ? 'Gal' : 'L'})</th>
                      <th style={{ textAlign: 'right' }}>Distribution ({unit === 'gal' ? 'Gal' : 'L'})</th>
                      <th style={{ textAlign: 'right' }}>Variance / Loss ({unit === 'gal' ? 'Gal' : 'L'})</th>
                      <th style={{ textAlign: 'right' }}>Daily % Accounted</th>
                      <th style={{ textAlign: 'right' }}>7-Day Rolling %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounting.daily.map((r) => (
                      <tr key={r.date}>
                        <td style={{ fontWeight: 500 }}>{r.date}</td>
                        <td style={{ textAlign: 'right', color: '#0d9488', fontWeight: 600 }}>
                          {(unit === 'gal' ? r.prod_gal : r.prod_liters).toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', color: '#6366f1', fontWeight: 600 }}>
                          {(unit === 'gal' ? r.dist_gal : r.dist_liters).toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', color: r.balance_gal >= 0 ? '#10b981' : '#dc2626', fontWeight: 600 }}>
                          {(unit === 'gal' ? r.balance_gal : r.balance_liters).toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={`badge ${r.pct_accounted >= 90 ? 'badge-green' : r.pct_accounted >= 75 ? 'badge-amber' : 'badge-red'}`}>
                            {r.pct_accounted}%
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {r.roll7_pct_accounted}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Week</th>
                      <th style={{ textAlign: 'right' }}>Production ({unit === 'gal' ? 'Gal' : 'L'})</th>
                      <th style={{ textAlign: 'right' }}>Distribution ({unit === 'gal' ? 'Gal' : 'L'})</th>
                      <th style={{ textAlign: 'right' }}>Net Variance ({unit === 'gal' ? 'Gal' : 'L'})</th>
                      <th style={{ textAlign: 'right' }}>Weekly % Accounted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounting.weekly.map((w) => (
                      <tr key={w.week}>
                        <td style={{ fontWeight: 600 }}>{w.week}</td>
                        <td style={{ textAlign: 'right', color: '#0d9488', fontWeight: 600 }}>
                          {(unit === 'gal' ? w.prod_gal : w.prod_liters).toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', color: '#6366f1', fontWeight: 600 }}>
                          {(unit === 'gal' ? w.dist_gal : w.dist_liters).toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', color: w.balance_gal >= 0 ? '#10b981' : '#dc2626', fontWeight: 600 }}>
                          {(unit === 'gal' ? w.balance_gal : w.balance_liters).toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={`badge ${w.pct_accounted >= 90 ? 'badge-green' : w.pct_accounted >= 75 ? 'badge-amber' : 'badge-red'}`}>
                            {w.pct_accounted}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-state-title">No accounting data for this group yet</div>
          <div className="empty-state-desc">Sync site telemetry data or check member sites.</div>
        </div>
      )}

      {/* CREATE GROUP MODAL */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', maxWidth: 540, width: '100%', padding: 24, boxShadow: 'var(--shadow-lg)' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 4 }}>Create Flow Accounting Group</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
              Group production sites against distribution sites to track network water balance.
            </p>

            {createError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '8px 12px', borderRadius: 6, fontSize: '0.82rem', marginBottom: 16 }}>
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Group Name *</label>
                <input
                  className="search-input"
                  style={{ width: '100%', padding: '8px 12px' }}
                  placeholder="e.g. Rosalbali System"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Description (Optional)</label>
                <input
                  className="search-input"
                  style={{ width: '100%', padding: '8px 12px' }}
                  placeholder="e.g. Main production pump to distribution lines"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                />
              </div>

              {/* Select Production Sites */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0d9488', marginBottom: 6 }}>
                  Select Production Sites (Water Sources) *
                </label>
                <div style={{ maxHeight: 130, overflowY: 'auto', border: '1px solid var(--border-default)', borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {allSites.map((s) => (
                    <label key={`prod-${s.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedProdSites.includes(s.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedProdSites([...selectedProdSites, s.id]);
                          else setSelectedProdSites(selectedProdSites.filter((id) => id !== s.id));
                        }}
                      />
                      <span style={{ fontWeight: 600 }}>{s.id}</span> — {s.name} ({s.location || 'N/A'})
                    </label>
                  ))}
                </div>
              </div>

              {/* Select Distribution Sites */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#6366f1', marginBottom: 6 }}>
                  Select Distribution Sites (Network Outlets) *
                </label>
                <div style={{ maxHeight: 130, overflowY: 'auto', border: '1px solid var(--border-default)', borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {allSites.map((s) => (
                    <label key={`dist-${s.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedDistSites.includes(s.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedDistSites([...selectedDistSites, s.id]);
                          else setSelectedDistSites(selectedDistSites.filter((id) => id !== s.id));
                        }}
                      />
                      <span style={{ fontWeight: 600 }}>{s.id}</span> — {s.name} ({s.location || 'N/A'})
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Group</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
