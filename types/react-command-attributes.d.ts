import 'react';

declare module 'react' {
  type StandardCommand = 'show-modal' | 'close' | 'request-close';

  interface ButtonHTMLAttributes {
    command?: StandardCommand | `--${string}`;
    commandFor?: string;
  }
}
