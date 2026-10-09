'use client';
import { useState } from 'react';

type status = 'success' | 'failed' | null;

export function useClipboard(value: string) {
  const [status, setStatus] = useState<status>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus('success');
    } catch {
      setStatus('failed');
    }
  }
  return { copy, status };
}
