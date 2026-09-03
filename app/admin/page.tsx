'use client';
import { useEffect, useState } from 'react';

interface TokenRow {
  token: string;
  site_id: string;
  site_name: string | null;
  site_location: string | null;
  label: string | null;
  created_at: string;
  revoked: number;
}

interface SiteOption {
  id: string;
  name: string | null;
}

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

export default function AdminPage() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newSiteId, setNewSiteId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [showRevoked, setShowRevoked] = useState(false);

  function loadTokens() {
    fetch('/api/share')
      .then((r) => r.json())
      .then((d) => setTokens(d.tokens ?? []))
      .finally(() => setLoading(false));
  }

  function loadSites() {
    fetch('/api/sites')
      .then((r) => r.json())
      .then((d) => {
        const opts = (d.sites ?? []).map((s: any) => ({ id: s.id, name: s.name }));
        setSites(opts);
        if (opts.length > 0) setNewSiteId(opts[0].id);
      });
  }

  useEffect(() => {
    loadTokens();
    loadSites();
  }, []);

  async function createToken() {
    if (!newSiteId) return;
    setCreating(true);
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_id: newSiteId, label: newLabel || null }),
      });
      const data = await res.json();
      if (data.success) {
        setNewLabel('');
        loadTokens();
      }
    } finally {
      setCreating(false);
    }
  }

  async function revokeToken(token: string) {
    if (!confirm('Revoke this share link? The donor will no longer be able to access it.')) return;
    await fetch(`/api/share/${token}/revoke`, { method: 'POST' });
    loadTokens();
  }

  function handleCopy(token: string) {
    const url = `${BASE_URL}/share/${token}`;
    copyToClipboard(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  const activeTokens = tokens.filter((t) => !t.revoked);
  const revokedTokens = tokens.filter((t) => t.revoked);
  const visibleTokens = showRevoked ? revokedTokens : activeTokens;

  const card: React.CSSProperties = {
    background: '#ffffff',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    marginBottom: 24,
    overflow: 'hidden',
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px 64px', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
          🔗 Donor Share Links
        </h1>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
          Generate and manage private share links for specific sites. Donors can only see the site linked to their token.
        </p>
      </div>

      {/* Create New Token */}
      <div style={card}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
          Generate New Share Link
        </div>
        <div style={{ padding: '20px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>Site</label>
            <select
              value={newSiteId}
              onChange={(e) => setNewSiteId(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: '0.85rem' }}
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.id} — {s.name ?? 'Unknown'}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: '2 1 240px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Label / Note <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional, internal only)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Sent to John Smith — Sep 2026"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: '0.85rem', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <button
              onClick={createToken}
              disabled={creating || !newSiteId}
              style={{
                padding: '9px 20px',
                borderRadius: 6,
                border: 'none',
                background: creating ? '#94a3b8' : '#14b8a6',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: creating ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {creating ? 'Generating…' : '+ Generate Link'}
            </button>
          </div>
        </div>
      </div>

      {/* Token List */}
      <div style={card}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
            {showRevoked ? `Revoked Links (${revokedTokens.length})` : `Active Links (${activeTokens.length})`}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setShowRevoked(false)}
              style={{
                padding: '5px 12px', fontSize: '0.8rem', borderRadius: 6, cursor: 'pointer',
                border: `1px solid ${!showRevoked ? '#14b8a6' : '#e2e8f0'}`,
                background: !showRevoked ? '#14b8a6' : '#fff',
                color: !showRevoked ? '#fff' : '#64748b',
                fontWeight: !showRevoked ? 600 : 400,
              }}
            >
              Active
            </button>
            <button
              onClick={() => setShowRevoked(true)}
              style={{
                padding: '5px 12px', fontSize: '0.8rem', borderRadius: 6, cursor: 'pointer',
                border: `1px solid ${showRevoked ? '#ef4444' : '#e2e8f0'}`,
                background: showRevoked ? '#ef4444' : '#fff',
                color: showRevoked ? '#fff' : '#64748b',
                fontWeight: showRevoked ? 600 : 400,
              }}
            >
              Revoked
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
        ) : visibleTokens.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
            {showRevoked ? 'No revoked links.' : 'No active share links yet. Generate one above.'}
          </div>
        ) : (
          <div>
            {visibleTokens.map((t) => {
              const shareUrl = `${BASE_URL}/share/${t.token}`;
              const copied = copiedToken === t.token;
              return (
                <div
                  key={t.token}
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid #f8fafc',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 16,
                    flexWrap: 'wrap',
                    opacity: t.revoked ? 0.6 : 1,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 250 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>
                        {t.site_name ?? t.site_id}
                      </span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4,
                        background: '#f0fdfa', color: '#0d9488',
                        fontSize: '0.72rem', fontWeight: 600
                      }}>
                        {t.site_id}
                      </span>
                      {t.revoked ? (
                        <span style={{ padding: '2px 8px', borderRadius: 4, background: '#fee2e2', color: '#dc2626', fontSize: '0.72rem', fontWeight: 600 }}>
                          Revoked
                        </span>
                      ) : (
                        <span style={{ padding: '2px 8px', borderRadius: 4, background: '#dcfce7', color: '#16a34a', fontSize: '0.72rem', fontWeight: 600 }}>
                          Active
                        </span>
                      )}
                    </div>
                    {t.label && (
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 4 }}>📝 {t.label}</div>
                    )}
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      Created {formatDate(t.created_at)}
                    </div>
                    <div style={{
                      marginTop: 8, padding: '6px 10px',
                      background: '#f8fafc', borderRadius: 6,
                      fontFamily: 'monospace', fontSize: '0.75rem',
                      color: '#475569', wordBreak: 'break-all',
                    }}>
                      {shareUrl}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {!t.revoked && (
                      <>
                        <button
                          onClick={() => handleCopy(t.token)}
                          style={{
                            padding: '7px 14px', borderRadius: 6, cursor: 'pointer',
                            border: '1px solid #e2e8f0',
                            background: copied ? '#dcfce7' : '#fff',
                            color: copied ? '#16a34a' : '#475569',
                            fontSize: '0.8rem', fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {copied ? '✓ Copied!' : '📋 Copy Link'}
                        </button>
                        <button
                          onClick={() => window.open(shareUrl, '_blank')}
                          style={{
                            padding: '7px 14px', borderRadius: 6, cursor: 'pointer',
                            border: '1px solid #e2e8f0', background: '#fff',
                            color: '#475569', fontSize: '0.8rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          🔗 Preview
                        </button>
                        <button
                          onClick={() => revokeToken(t.token)}
                          style={{
                            padding: '7px 14px', borderRadius: 6, cursor: 'pointer',
                            border: '1px solid #fecaca', background: '#fff',
                            color: '#ef4444', fontSize: '0.8rem', fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          ✕ Revoke
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
