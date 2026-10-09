'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomView } from '@/lib/rooms/types';
export function useRoom(code: string) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [error, setError] = useState('');
  const [terminal, setTerminal] = useState(false);
  const [busy, setBusy] = useState(true);
  const inFlight = useRef(false);
  const alive = useRef(true);
  const load = useCallback(async () => {
    if (inFlight.current) return;
    if (!navigator.onLine) {
      setBusy(false);
      setError(
        'You’re offline. Reconnect and try again. Any displayed room information was last confirmed earlier.',
      );
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const response = await fetch(`/api/rooms/${code}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      });
      const data = await response.json();
      if (!alive.current) return;
      if (response.ok && data.expiresAt <= Date.now()) {
        setRoom(null);
        setTerminal(true);
        setError('This room doesn’t exist or has expired.');
      } else if (response.ok) {
        setRoom(data);
        setError('');
      } else if (response.status === 401 || response.status === 404) {
        setRoom(null);
        setTerminal(true);
        setError(data.message);
      } else
        setError(
          'We couldn’t check your room. Any displayed information was last confirmed earlier. Try again.',
        );
    } catch {
      if (alive.current)
        setError(
          'We couldn’t check your room. Any displayed information was last confirmed earlier. Try again.',
        );
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }, [code]);
  useEffect(() => {
    alive.current = true;
    // Synchronize the initial screen with the authenticated external room service.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const offline = () =>
      setError(
        'You’re offline. Any displayed room information was last confirmed earlier.',
      );
    window.addEventListener('offline', offline);
    return () => {
      alive.current = false;
      window.removeEventListener('offline', offline);
    };
  }, [load]);
  useEffect(() => {
    if (!room) return;
    const checkExpiry = () => {
      if (Date.now() >= room.expiresAt) {
        setRoom(null);
        setTerminal(true);
        setError('This room doesn’t exist or has expired.');
      }
    };
    checkExpiry();
    const timer = window.setInterval(checkExpiry, 1000);
    window.addEventListener('visibilitychange', checkExpiry);
    return () => {
      clearInterval(timer);
      window.removeEventListener('visibilitychange', checkExpiry);
    };
  }, [room]);
  return { room, error, terminal, busy, load };
}
