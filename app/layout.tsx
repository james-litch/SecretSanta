import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/Header/Header';
import Sprig from '@/icons/sprig.svg'

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
          <Sprig className="pointer-events-none absolute bottom-0 left-0 -z-10 w-24 md:w-36 lg:w-44 opacity-65" />
          {children}
        </div>
      </body>
    </html>
  );
}
