import { clsx } from 'clsx';
import { ComponentProps } from 'react';

type Props = Omit<ComponentProps<'span'>, 'children'>;

export function Logo({ className, ...props }: Props) {
  return (
    <span
      {...props}
      className={clsx(
        'flex items-center gap-3 font-display text-2xl md:text-3xl leading-normal',
        className,
      )}
    >
      <svg width="40" height="44" viewBox="0 0 40 44" aria-hidden="true">
        <path className="fill-green" d="M4 17h32v24H4zM2 12h36v9H2z" />
        <path className="fill-cranberry" d="M17 12h6v29h-6z" />
        <path
          d="M20 12C2 12 9-4 17 7l3 5c18 0 11-16 3-5z"
          fill="none"
          className="stroke-cranberry"
          strokeWidth="2.5"
        />
      </svg>
      <span>Secret Santa</span>
    </span>
  );
}
