'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomView } from '@/lib/rooms/types';
const checking = 'Checking whether the draw completed…';
const stale =
  'We couldn’t check your room. Any displayed information was last confirmed earlier. Try again.';

export function useRoom(code: string) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [error, setError] = useState('');
  const [terminal, setTerminal] = useState(false);
  const [busy, setBusy] = useState(true);
  const [offline, setOffline] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const uncertainRef = useRef(false);
  const inFlight = useRef(false);
  const alive = useRef(true);
  const expired = useRef(false);
  const request = useCallback(
    async (
      method: 'GET' | 'POST',
    ): Promise<RoomView | 'transient' | undefined> => {
      if (inFlight.current || expired.current) return;
      if (!navigator.onLine) {
        setBusy(false);
        setError(
          `${uncertainRef.current ? checking + ' ' : ''}You’re offline. Reconnect and try again. Any displayed room information was last confirmed earlier.`,
        );
        return;
      }
      inFlight.current = true;
      setBusy(true);
      if (method === 'POST') setError('Drawing names…');
      else if (uncertainRef.current) setError(checking);
      try {
        const response = await fetch(
          `/api/rooms/${code}${method === 'POST' ? '/draw' : ''}`,
          {
            method,
            cache: 'no-store',
            signal: AbortSignal.timeout(10_000),
          },
        );
        const data = await response.json();
        if (!alive.current || expired.current) return;
        if (
          (response.ok && data.expiresAt <= Date.now()) ||
          response.status === 401 ||
          response.status === 404
        ) {
          setRoom(null);
          setTerminal(true);
          expired.current = true;
          setError(
            response.ok
              ? 'This room doesn’t exist or has expired.'
              : data.message,
          );
        } else if (response.ok) {
          setRoom(data);
          if (data.state === 'drawn') {
            uncertainRef.current = false;
            setUncertain(false);
          }
          setError(
            uncertainRef.current
              ? 'No saved draw was found yet. Try again to check and complete the draw.'
              : '',
          );
          return data;
        } else if (response.status < 500) {
          uncertainRef.current = false;
          setUncertain(false);
          setError(data.message);
        } else throw new Error('Transient service failure');
      } catch {
        if (!alive.current || expired.current) return;
        if (method === 'POST') {
          uncertainRef.current = true;
          setUncertain(true);
        }
        setError(
          uncertainRef.current
            ? `${checking} Connection interrupted. Try again to check the saved outcome.`
            : stale,
        );
        return 'transient';
      } finally {
        inFlight.current = false;
        if (alive.current) setBusy(false);
      }
    },
    [code],
  );
  const load = useCallback(async () => {
    await request('GET');
  }, [request]);
  const draw = useCallback(async () => {
    if ((await request('POST')) === 'transient') await request('GET');
  }, [request]);
  const retry = useCallback(async () => {
    const result = await request('GET');
    if (
      uncertainRef.current &&
      result &&
      result !== 'transient' &&
      result.state === 'waiting'
    )
      await draw();
  }, [request, draw]);
  useEffect(() => {
    alive.current = true;
    // Synchronize the initial screen with the authenticated external room service.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const wentOffline = () => {
      setOffline(true);
      setError(
        `${uncertainRef.current ? checking + ' ' : ''}You’re offline. Any displayed room information was last confirmed earlier.`,
      );
    };
    const wentOnline = () => setOffline(false);
    if (!navigator.onLine) wentOffline();
    window.addEventListener('offline', wentOffline);
    window.addEventListener('online', wentOnline);
    return () => {
      alive.current = false;
      window.removeEventListener('offline', wentOffline);
      window.removeEventListener('online', wentOnline);
    };
  }, [load]);
  useEffect(() => {
    if (!room) return;
    const checkExpiry = () => {
      if (Date.now() >= room.expiresAt) {
        expired.current = true;
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
  return { room, error, terminal, busy, load, draw, retry, offline, uncertain };
}
