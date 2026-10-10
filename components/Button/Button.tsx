import { clsx } from 'clsx';
import type { ComponentProps } from 'react';

const Variants = {
  primary: 'button',
  secondary: 'button-secondary',
  text: 'button-text',
} as const;

interface Props extends ComponentProps<'button'> {
  variant?: keyof typeof Variants;
}

export function Button({ variant = 'primary', className, ...props }: Props) {
  return <button {...props} className={clsx(Variants[variant], className)} />;
}
