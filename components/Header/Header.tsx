import Link from 'next/link';
import Logo from '@/icons/logo.svg';

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-cream-dark px-5 md:px-10 lg:px-20 py-5">
      <Link href="/" aria-label="Secret Santa home" className="no-underline">
        <span className="flex items-center gap-3 font-display text-2xl md:text-3xl leading-normal">
          <Logo aria-hidden />
          <span>Secret Santa</span>
        </span>
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/faq" className="inline-block p-2.5">
          FAQ
        </Link>
      </nav>
    </header>
  );
}
