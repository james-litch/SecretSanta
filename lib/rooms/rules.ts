export function normalizeName(value: unknown) {
  if (typeof value !== 'string' || /[\p{Cc}\p{Cs}\u2028\u2029]/u.test(value)) {
    throw new Error('Use a name without line breaks or control characters.');
  }
  const display = value.normalize('NFC').trim();
  if ([...display].length < 1 || [...display].length > 40) {
    throw new Error('Enter a name between 1 and 40 characters.');
  }
  return { display, key: display.toLowerCase() };
}

export function roomConfig(env: Record<string, string | undefined>) {
  function integer(key: string, fallback: number, minimum: number) {
    const raw = env[key];
    const value = raw === undefined ? fallback : Number(raw);
    if ((raw !== undefined && !/^\d+$/.test(raw)) || !Number.isSafeInteger(value) || value < minimum) {
      throw new Error(`${key} must be an integer of at least ${minimum}.`);
    }
    return value;
  }
  const capacity = integer('ROOM_MAX_PARTICIPANTS', 30, 3);
  const lifetimeDays = integer('ROOM_LIFETIME_DAYS', 7, 1);
  // JavaScript Date, Redis's integer deadline, and JSON must all represent it.
  if (!Number.isSafeInteger(lifetimeDays * 86_400_000) || !Number.isFinite(new Date(Date.now() + lifetimeDays * 86_400_000).getTime())) {
    throw new Error('ROOM_LIFETIME_DAYS exceeds the representable deadline.');
  }
  return { capacity, lifetimeDays };
}

export function lifetimeCopy(days: number) {
  return `This room will be deleted after ${days} ${days === 1 ? 'day' : 'days'}.`;
}
