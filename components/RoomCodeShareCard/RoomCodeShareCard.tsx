'use client';
import { clsx } from 'clsx';
import { Button } from '../Button/Button';
import { useClipboard } from '../../hooks/useClipboard';
import { ComponentProps } from 'react';

interface Props extends Omit<ComponentProps<'div'>, 'children'> {
  code: string;
}

export function RoomCodeShareCard({ code, className }: Props) {
  const { status, copy } = useClipboard(code);

  return (
    <div className={clsx('text-center', className)}>
      <div className="flex flex-wrap items-center justify-center gap-3 rounded-lg border border-cream-dark bg-cream-light p-4">
        <span aria-hidden="true" className="text-gold">
          ✧
        </span>
        <span
          aria-label="Room code"
          className="font-body text-sm sm:text-xl font-semibold tracking-wider wrap-anywhere select-all"
        >
          {code}
        </span>
        <Button variant="secondary" onClick={copy}>
          Copy
        </Button>
      </div>
      {status && (
        <p
          role="status"
          className="mt-2.5 mb-1 min-h-6 text-sm text-green-muted"
        >
          {status === 'success'
            ? 'Room code copied.'
            : 'Couldn’t copy automatically. Select and copy the room code above.'}
        </p>
      )}
    </div>
  );
}
