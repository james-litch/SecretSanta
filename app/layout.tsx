import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/Header/Header';
import { SprigDecoration } from '@/components/SprigDecoration/SprigDecoration';

export const metadata: Metadata = {
  title: 'Secret Santa',
  description:
    'A little mystery. A lot of joy. A private gift exchange for friends and family.',
};
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body>
        <div className="relative isolate min-h-screen overflow-clip">
          <Header />
          <SprigDecoration />
          {children}
        </div>
      </body>
    </html>
  );
}
