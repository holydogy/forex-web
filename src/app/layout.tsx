import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Forex Multi-Timeframe Confluence Scanner',
  description: 'Real-time Forex confluence scanner across M15, H1, H4, and D1 timeframes',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-cyan-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
