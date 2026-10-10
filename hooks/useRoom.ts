'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomView } from '@/lib/rooms/types';
const checking = 'Checking whether the draw completed…';
const offlineMessage =
  'You’re offline. Any displayed room information was last confirmed earlier.';
const stale =
  'We couldn’t check your room. Any displayed information was last confirmed earlier. Reconnecting automatically.';

export function useRoom(code: string) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [error, setError] = useState('');
  const [terminal, setTerminal] = useState<'unavailable' | 'access' | null>(
    null,
  );
  const [busy, setBusy] = useState(true);
  const [offline, setOffline] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const uncertainRef = useRef(false);
  const [announcement, setAnnouncement] = useState('');
  const currentRoom = useRef<RoomView | null>(null);
  const failures = useRef(0);
  const interrupted = useRef(false);
  const schedule = useRef<(delay?: number) => void>(() => {});
  const cancelTimer = useRef(() => {});
  const resumePending = useRef(false);
  const foreground = useRef(false);
  const inFlight = useRef<Promise<void> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const expired = useRef(false);
  const request = useCallback(
    async (
      method: 'GET' | 'POST',
      background = false,
    ): Promise<RoomView | 'transient' | undefined> => {
      if (!background && foreground.current) return;
      if (!background) {
        foreground.current = true;
        setBusy(true);
        if (method === 'POST') setError('Drawing names…');
      }
      try {
        while (inFlight.current) {
          if (background) return;
          await inFlight.current;
        }
        if (
          !alive.current ||
          expired.current ||
          currentRoom.current?.state === 'drawn'
        )
          return;
        if (background && document.visibilityState !== 'visible') return;
        cancelTimer.current();
        if (!navigator.onLine) {
          setError(
            `${uncertainRef.current ? checking + ' ' : ''}You’re offline. Reconnect and try again. Any displayed room information was last confirmed earlier.`,
          );
          return;
        }
        let release!: () => void;
        inFlight.current = new Promise<void>((resolve) => {
          release = resolve;
        });
        const activeController = new AbortController();
        controller.current = activeController;
        if (method === 'POST') setError('Drawing names…');
        else if (uncertainRef.current && !background) setError(checking);
        try {
          const response = await fetch(
            `/api/rooms/${code}${method === 'POST' ? '/draw' : ''}`,
            {
              method,
              cache: 'no-store',
              signal: AbortSignal.any([
                activeController.signal,
                AbortSignal.timeout(10_000),
              ]),
            },
          );
          const data = await response.json();
          if (
            !alive.current ||
            expired.current ||
            activeController.signal.aborted
          )
            return;
          if (
            (response.ok && data.expiresAt <= Date.now()) ||
            response.status === 401 ||
            response.status === 404
          ) {
            setRoom(null);
            setTerminal(response.status === 401 ? 'access' : 'unavailable');
            expired.current = true;
            setError(
              response.ok
                ? 'This room doesn’t exist or has expired.'
                : data.message,
            );
          } else if (response.ok) {
            const restored = interrupted.current && navigator.onLine;
            if (navigator.onLine) interrupted.current = false;
            failures.current = 0;
            if (restored)
              setAnnouncement('Connection restored. Your room is up to date.');
            const previous = currentRoom.current;
            if (previous && data.state === 'waiting') {
              const joined = (data as RoomView).participants.filter(
                (participant) =>
                  !previous.participants.some(
                    (known) => known.id === participant.id,
                  ),
              );
              if (joined.length)
                setAnnouncement(
                  `${restored ? 'Connection restored. ' : ''}${joined.map((participant) => participant.name).join(', ')} joined the room.`,
                );
            }
            currentRoom.current = data;
            setRoom(data);
            if (data.state === 'drawn') {
              uncertainRef.current = false;
              setUncertain(false);
            }
            setError(
              !navigator.onLine
                ? offlineMessage
                : uncertainRef.current
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
          if (
            !alive.current ||
            expired.current ||
            activeController.signal.aborted
          )
            return;
          interrupted.current = true;
          failures.current = Math.min(failures.current + 1, 4);
          if (method === 'POST') {
            uncertainRef.current = true;
            setUncertain(true);
          }
          setError(
            !navigator.onLine
              ? offlineMessage
              : uncertainRef.current
                ? `${checking} Connection interrupted. Try again to check the saved outcome.`
                : stale,
          );
          return 'transient';
        } finally {
          inFlight.current = null;
          release();
          if (alive.current && !activeController.signal.aborted) {
            schedule.current(resumePending.current ? 0 : undefined);
            resumePending.current = false;
          }
        }
      } finally {
        if (!background) {
          foreground.current = false;
          if (alive.current) setBusy(false);
        }
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
    let timer: ReturnType<typeof setTimeout> | undefined;
    const canRefresh = () =>
      alive.current &&
      !expired.current &&
      currentRoom.current?.state !== 'drawn' &&
      navigator.onLine &&
      document.visibilityState === 'visible';
    cancelTimer.current = () => clearTimeout(timer);
    schedule.current = (
      delay = failures.current
        ? Math.min(3000 * 2 ** failures.current, 30_000)
        : 3000,
    ) => {
      clearTimeout(timer);
      if (canRefresh())
        timer = setTimeout(() => {
          void request('GET', true);
        }, delay);
    };
    const resume = () => {
      clearTimeout(timer);
      if (!canRefresh()) return;
      if (inFlight.current && controller.current?.signal.aborted) {
        void inFlight.current.then(resume);
      } else if (inFlight.current) resumePending.current = true;
      else void request('GET', !!currentRoom.current);
    };
    const wentOffline = () => {
      if (expired.current) return;
      clearTimeout(timer);
      resumePending.current = false;
      interrupted.current = true;
      setOffline(true);
      setError(
        `${uncertainRef.current ? checking + ' ' : ''}${offlineMessage}`,
      );
    };
    const wentOnline = () => {
      if (expired.current) return;
      setOffline(false);
      if (currentRoom.current?.state === 'drawn' && !expired.current) {
        setError('');
        setAnnouncement('You’re back online. Your saved result is shown.');
        interrupted.current = false;
      }
      resume();
    };
    if (!navigator.onLine) wentOffline();
    // Initial synchronization with the authenticated room service.
    resume();
    window.addEventListener('offline', wentOffline);
    window.addEventListener('online', wentOnline);
    document.addEventListener('visibilitychange', resume);
    return () => {
      alive.current = false;
      clearTimeout(timer);
      controller.current?.abort();
      window.removeEventListener('offline', wentOffline);
      window.removeEventListener('online', wentOnline);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [request]);
  useEffect(() => {
    if (!room) return;
    let timer: ReturnType<typeof setTimeout>;
    const checkExpiry = () => {
      clearTimeout(timer);
      if (Date.now() >= room.expiresAt) {
        expired.current = true;
        cancelTimer.current();
        controller.current?.abort();
        currentRoom.current = null;
        setRoom(null);
        setTerminal('unavailable');
        setBusy(false);
        setError('This room doesn’t exist or has expired.');
      } else {
        // Recheck the wall clock after clock adjustments, with the final
        // wakeup at the deadline rather than the next whole second.
        timer = setTimeout(
          checkExpiry,
          Math.min(room.expiresAt - Date.now(), 1000),
        );
      }
    };
    checkExpiry();
    document.addEventListener('visibilitychange', checkExpiry);
    window.addEventListener('pageshow', checkExpiry);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', checkExpiry);
      window.removeEventListener('pageshow', checkExpiry);
    };
  }, [room]);
  return {
    room,
    error,
    terminal,
    busy,
    load,
    draw,
    retry,
    offline,
    uncertain,
    announcement,
  };
}
