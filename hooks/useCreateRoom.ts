'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { normalizeName } from '@/lib/rooms/rules';
import type { PendingCreate } from '@/lib/rooms/types';
const pendingKey = 'secret-santa:pending-create';
export function useCreateRoom(onCreated: (code: string) => void) {
  const [name, setName] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState<PendingCreate | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    try {
      const saved = sessionStorage.getItem(pendingKey);
      if (saved) {
        const operation = JSON.parse(saved) as PendingCreate;
        if (
          typeof operation.name === 'string' &&
          typeof operation.secret === 'string'
        ) {
          // Browser-only saved state must be restored after hydration.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setPending(operation);
          setName(operation.name);
          setError(
            'A create attempt is unfinished. Try again to check that same room.',
          );
        }
      }
    } catch {
      setError('Enable saved browser data before creating a room.');
    }
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || !navigator.onLine) return;
    try {
      normalizeName(name);
    } catch (error) {
      setFieldError((error as Error).message);
      input.current?.focus();
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError('');
    setFieldError('');
    let operation = pending;
    try {
      if (!operation) {
        const prepared = await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phase: 'prepare', name }),
          signal: AbortSignal.timeout(10_000),
        });
        const data = await prepared.json();
        if (!prepared.ok) {
          setError(data.message);
          return;
        }
        operation = data as PendingCreate;
        sessionStorage.setItem(pendingKey, JSON.stringify(operation));
        setPending(operation);
      }
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(operation),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message);
        return;
      }
      sessionStorage.removeItem(pendingKey);
      setPending(null);
      onCreated(data.code);
    } catch {
      setError(
        operation
          ? 'We couldn’t confirm creation. Try again to check the same room; your name is saved.'
          : 'We couldn’t prepare your room. Try again; your name is saved.',
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  function startOver() {
    try {
      sessionStorage.removeItem(pendingKey);
    } catch {
      return;
    }
    setPending(null);
    setError('');
    input.current?.focus();
  }
  return {
    name,
    setName,
    fieldError,
    setFieldError,
    error,
    busy,
    online,
    pending,
    input,
    submit,
    startOver,
  };
}
