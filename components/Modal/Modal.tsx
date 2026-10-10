import { IconX } from '@tabler/icons-react';
import { clsx } from 'clsx';
import type { DialogHTMLAttributes } from 'react';

type Props = DialogHTMLAttributes<HTMLDialogElement>;

export function Modal({
  id,
  title,
  closedby = 'any',
  className,
  children,
  ...props
}: Props) {
  return (
    <dialog
      {...props}
      closedby={closedby}
      id={id}
      aria-labelledby={`${id}-title`}
      className={clsx('modal relative', className)}
    >
      <button
        type="button"
        className="absolute top-2 right-2 inline-flex size-10 items-center justify-center rounded-md hover:bg-cream cursor-pointer"
        aria-label="Close modal"
        command="close"
        commandFor={id}
      >
        <IconX aria-hidden="true" size={20} />
      </button>
      <h2 id={`${id}-title`} className="mb-4 pr-10 font-display text-3xl">
        {title}
      </h2>
      {children}
    </dialog>
  );
}
