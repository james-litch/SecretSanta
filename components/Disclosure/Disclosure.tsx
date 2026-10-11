import ChevronDown from '@/icons/chevron.svg';
import { clsx } from 'clsx';
import type { ComponentProps } from 'react';

interface Props extends ComponentProps<'details'> {
  question: string;
}

export function Disclosure({
  id,
  question,
  children,
  className,
  ...props
}: Props) {
  return (
    <details
      {...props}
      // Native fragment navigation may add `open` before React hydrates.
      suppressHydrationWarning
      className={clsx('disclosure', className)}
    >
      <summary>
        {question}
        <ChevronDown
          aria-hidden="true"
          size={20}
          className="shrink-0 stroke-2"
        />
      </summary>
      <div id={id} className="px-5 pb-1.5 text-green-muted">
        {children}
      </div>
    </details>
  );
}
