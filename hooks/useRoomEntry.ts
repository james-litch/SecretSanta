'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { normalizeName } from '@/lib/rooms/rules';
import type { PendingCreate } from '@/lib/rooms/types';

type PendingEntry = PendingCreate & { code?: string };
const storageKey = (operation: PendingEntry) =>
  operation.code ? 'secret-santa:pending-join' : 'secret-santa:pending-create';
export function useRoomEntry(onEntered: (code: string) => void) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [error, setError] = useState('');
  const [help, setHelp] = useState('connection');
  const [action, setAction] = useState<'create' | 'join'>('create');
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(false);
  const [pending, setPending] = useState<PendingEntry | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    try {
      const saved =
        sessionStorage.getItem('secret-santa:pending-join') ??
        sessionStorage.getItem('secret-santa:pending-create');
      if (saved) {
        const operation = JSON.parse(saved) as PendingEntry;
        if (
          typeof operation.name === 'string' &&
          typeof operation.secret === 'string'
        ) {
          // Restore browser-only saved state after hydration.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setPending(operation);
          setName(operation.name);
          setCode(operation.code ?? '');
          setAction(operation.code ? 'join' : 'create');
          setError(
            `A ${operation.code ? 'join' : 'create'} attempt is unfinished. Try again to check that same room.`,
          );
        }
      }
    } catch {
      setError('Enable saved browser data before creating or joining a room.');
    }
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  async function submit(
    event: FormEvent,
    requestedAction: 'create' | 'join' = 'create',
  ) {
    event.preventDefault();
    if (submitting.current || !navigator.onLine) return;
    const nextAction = pending
      ? pending.code
        ? 'join'
        : 'create'
      : requestedAction;
    setAction(nextAction);
    setFieldError('');
    setCodeError('');
    setError('');
    setHelp('connection');
    try {
      normalizeName(name);
    } catch (error) {
      setFieldError((error as Error).message);
      input.current?.focus();
      return;
    }
    const normalizedCode = code.trim().toUpperCase();
    if (nextAction === 'join' && !/^[A-F0-9]{24}$/.test(normalizedCode)) {
      setCodeError('Enter the complete room code shared with you.');
      codeInput.current?.focus();
      return;
    }
    submitting.current = true;
    setBusy(true);
    let operation = pending;
    try {
      if (!operation) {
        if (nextAction === 'join') {
          const bytes = crypto.getRandomValues(new Uint8Array(32));
          operation = {
            name,
            code: normalizedCode,
            secret: Array.from(bytes, (byte) =>
              byte.toString(16).padStart(2, '0'),
            ).join(''),
          };
        } else {
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
          operation = data as PendingEntry;
        }
        sessionStorage.setItem(
          storageKey(operation),
          JSON.stringify(operation),
        );
        setPending(operation);
      }
      const response = await fetch(
        operation.code ? `/api/rooms/${operation.code}/join` : '/api/rooms',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(operation),
          signal: AbortSignal.timeout(10_000),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        // Definitive join rejection made no membership; allow correction. A
        // timeout/service failure keeps the exact operation and payload locked.
        if (operation.code && response.status < 500) {
          sessionStorage.removeItem(storageKey(operation));
          setPending(null);
          if (
            data.error === 'duplicate_name' ||
            data.error === 'invalid_name'
          ) {
            setFieldError(data.message);
            input.current?.focus();
          } else if (data.error === 'invalid_code') {
            setCodeError(data.message);
            codeInput.current?.focus();
          } else {
            setError(data.message);
            setHelp(
              data.error === 'room_full'
                ? 'capacity'
                : data.error === 'unavailable'
                  ? 'expiry'
                  : 'browser',
            );
          }
        } else setError(data.message);
        return;
      }
      sessionStorage.removeItem(storageKey(operation));
      setPending(null);
      onEntered(data.code);
    } catch {
      setError(
        nextAction === 'join'
          ? 'We couldn’t confirm joining. Try again to check the same attempt; your name and code are saved.'
          : operation
            ? 'We couldn’t confirm creation. Try again to check the same room; your name is saved.'
            : 'We couldn’t prepare your room. Try again; your name is saved.',
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  function startOver() {
    if (!pending || pending.code) return;
    try {
      sessionStorage.removeItem(storageKey(pending));
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
    code,
    setCode,
    fieldError,
    setFieldError,
    codeError,
    setCodeError,
    error,
    help,
    action,
    busy,
    online,
    pending,
    input,
    codeInput,
    submit,
    startOver,
  };
}
