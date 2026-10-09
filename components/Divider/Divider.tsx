import { clsx } from 'clsx';
import { ComponentProps } from 'react';

type Props = Omit<ComponentProps<'div'>, 'children'>;

export function Divider({ className, ...props }: Props) {
  return (
    <div
      aria-hidden
      {...props}
      className={clsx(
        'mx-auto my-7 flex text-2xl leading-none max-w-md items-center gap-4 text-cranberry before:h-px before:grow before:bg-cream-dark after:h-px after:grow after:bg-cream-dark',
        className,
      )}
    >
      ✧
    </div>
  );
}
