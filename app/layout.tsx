import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Claims NL Query POC',
  description: 'Natural language query over claims data with Excel export',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
