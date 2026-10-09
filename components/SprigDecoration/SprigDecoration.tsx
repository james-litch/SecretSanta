import { clsx } from 'clsx';
import { ComponentProps } from 'react';
type Props = Omit<ComponentProps<'svg'>, 'children'>;

export function SprigDecoration({ className, ...props }: Props) {
  return (
    <svg
      {...props}
      viewBox="0 0 150 150"
      aria-hidden
      className={clsx(
        'pointer-events-none absolute bottom-0 left-0 -z-10 w-24 md:w-36 lg:w-44 opacity-65 fill-none stroke-green-soft stroke-1',
        className,
      )}
    >
      <path d="M0 140L120 25M0 140L135 92M0 140L38 20" />
      <path d="M28 112l0-36m0 36 42-7M45 97l1-39m-1 39 39-5M65 77l-1-36m1 36 37-6M87 56l-1-28m1 28 31-3M37 125l13-25m-13 25 34 4M63 116l11-25m-11 25 32 4M90 108l9-21m-9 21 29 5M11 104L2 81m9 23 16-18M19 75L8 49m11 26 19-17M29 48L18 28m11 20 14-18" />
      <circle cx="53" cy="107" r="5" className="fill-cranberry stroke-none" />
      <circle cx="63" cy="98" r="4" className="fill-cranberry stroke-none" />
      <circle cx="21" cy="69" r="4" className="fill-cranberry stroke-none" />
    </svg>
  );
}
