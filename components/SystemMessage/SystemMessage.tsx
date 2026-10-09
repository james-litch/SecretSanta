import { clsx } from 'clsx';
import type { ComponentProps } from 'react';

export function SystemMessage({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      className={clsx(
        'rounded-lg bg-cranberry-muted p-4 text-cranberry',
        className,
      )}
    />
  );
}
