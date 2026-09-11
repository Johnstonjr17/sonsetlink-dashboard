'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export default function Navbar() {
  const pathname = usePathname();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Completely hide navbar on donor share pages and login page
  if (pathname?.startsWith('/share') || pathname?.startsWith('/login')) {
    return null;
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setLastSync(`✓ Synced (+${data.recordsAdded} records)`);
        window.location.reload();
      } else {
        setLastSync(`Sync Error: ${data.error || 'Server error'}`);
      }
    } catch (err: any) {
      setLastSync(`Sync Error: ${err?.message || 'Network error'}`);
    } finally {
      setSyncing(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/login', { method: 'DELETE' });
    } finally {
      window.location.href = '/login';
    }
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="navbar-brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C6 8 4 12 4 15a8 8 0 0016 0c0-3-2-7-8-13z"/>
          </svg>
          SonSetLink Solar
        </Link>

        <nav className="navbar-nav">
          <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>
            Dashboard
          </Link>
          <Link href="/cumulative" className={`nav-link ${pathname === '/cumulative' ? 'active' : ''}`}>
            Cumulative Volume
          </Link>
          <Link href="/quarterly" className={`nav-link ${pathname === '/quarterly' ? 'active' : ''}`}>
            Quarterly Flow
          </Link>
          <Link href="/groups" className={`nav-link ${pathname === '/groups' ? 'active' : ''}`}>
            Flow Accounting
          </Link>
          <Link href="/admin" className={`nav-link ${pathname === '/admin' ? 'active' : ''}`}>
            Donor Links
          </Link>
        </nav>

        <div className="navbar-actions">
          {lastSync && (
            <span
              className={`badge ${lastSync.startsWith('✓') ? 'badge-teal' : 'badge-amber'}`}
              style={{ fontSize: '0.75rem' }}
            >
              {lastSync}
            </span>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSync}
            disabled={syncing}
            style={{ minWidth: 105 }}
          >
            {syncing ? (
              <>
                <span className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                Syncing…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0115-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 01-15 6.7L3 16"/>
                </svg>
                Sync Now
              </>
            )}
          </button>
          <button
            onClick={handleLogout}
            title="Log out (Lock Dashboard)"
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#64748b',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Lock
          </button>
        </div>
      </div>
    </nav>
  );
}
