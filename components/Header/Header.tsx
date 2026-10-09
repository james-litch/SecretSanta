import Link from 'next/link';
import { Logo } from '../Logo/Logo';

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-cream-dark px-5 md:px-10 lg:px-20 py-5">
      <Link href="/" aria-label="Secret Santa home" className="no-underline">
        <Logo />
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/faq" className="inline-block p-2.5">
          FAQ
        </Link>
      </nav>
    </header>
  );
}
