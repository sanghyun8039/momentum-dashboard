import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ETF Momentum Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-slate-900 min-h-screen">{children}</body>
    </html>
  );
}
