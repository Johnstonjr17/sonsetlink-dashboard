import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'SonSetLink Solar Dashboard',
  description: 'Water flow monitoring dashboard for SonSetLink Solar sites',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main className="page-content">
          <div className="page-container">{children}</div>
        </main>
      </body>
    </html>
  );
}
