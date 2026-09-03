// Isolated layout for donor share pages — NO navbar, NO footer
// Donors cannot navigate anywhere else from this layout
export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        maxWidth: 1100,
        margin: '-32px auto 0',
        padding: '16px 0 64px',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      }}
    >
      {children}
    </div>
  );
}
