'use client';
import { useCallback } from 'react';

export function useAutoFocus<T extends HTMLElement>() {
  const ref = useCallback((element: T | null) => {
    element?.focus();
  }, []);
  return { ref, tabIndex: -1 };
}
