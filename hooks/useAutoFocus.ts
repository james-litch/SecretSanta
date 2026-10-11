'use client';
import { useCallback } from 'react';

export function useAutoFocus<T extends HTMLElement>(preventScroll = false) {
  const ref = useCallback(
    (element: T | null) => {
      element?.focus({ preventScroll });
    },
    [preventScroll],
  );
  return { ref, tabIndex: -1 };
}
