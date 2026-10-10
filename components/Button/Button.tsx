import { clsx } from 'clsx';
import type { ComponentProps } from 'react';

const Variants = {
  primary: 'button',
  secondary: 'button-secondary',
  text: 'button-text',
} as const;

interface Props extends ComponentProps<'button'> {
  variant?: keyof typeof Variants;
  command?: 'show-modal' | 'close' | 'request-close';
  commandFor?: string;
}

export function Button({
  variant = 'primary',
  className,
  command,
  commandFor,
  ...props
}: Props) {
  return (
    <button
      {...props}
      {...{ command, commandfor: commandFor }}
      className={clsx(Variants[variant], className)}
    />
  );
}
