// Isolated layout for donor share pages — NO navbar, NO footer
// Donors cannot navigate anywhere else from this layout
export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '32px 24px 64px',
        }}
      >
        {children}
      </div>
    </div>
  );
}
