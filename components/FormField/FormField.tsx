import { clsx } from 'clsx';
import type { ComponentProps, ReactNode } from 'react';

interface Props extends ComponentProps<'input'> {
  id: string;
  label: ReactNode;
  hint?: string;
  error?: string;
}

export function FormField({
  id,
  label,
  hint,
  error,
  className,
  ...props
}: Props) {
  const describedBy =
    [hint && `${id}-help`, error && `${id}-error`, props['aria-describedby']]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block">
        {label}
      </label>
      <input
        {...props}
        id={id}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={clsx(
          'w-full rounded-md border border-green-muted bg-cream-light px-3 py-2.5 text-green-dark read-only:bg-cream',
          error && 'border-2 border-cranberry',
        )}
      />

      {hint && (
        <p id={`${id}-help`} className="mb-4 mt-2.5 text-sm text-green-muted">
          {hint}
        </p>
      )}

      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="my-3 text-base text-cranberry"
        >
          {error}
        </p>
      )}
    </div>
  );
}
