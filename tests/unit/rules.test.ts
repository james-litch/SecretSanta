import { describe, expect, it } from 'vitest';
import { normalizeName, roomConfig, lifetimeCopy } from '../../lib/rooms/rules';

describe('participant names', () => {
  it('normalizes NFC and trims while preserving display capitalization, punctuation and emoji', () => {
    expect(normalizeName('  E\u0301lodie O’Neil 🎁  ')).toEqual({ display: 'Élodie O’Neil 🎁', key: 'élodie o’neil 🎁' });
  });
  it('counts Unicode code points rather than UTF-16 units', () => {
    expect(normalizeName('🎁'.repeat(40)).display).toBe('🎁'.repeat(40));
    expect(() => normalizeName('🎁'.repeat(41))).toThrow();
  });
  it.each(['', '  ', '\nJames', 'James\r', 'A\tB', 'A\u0000B', 'A\u0085B', 'A\u2028B', 'A\u2029B', '\ud800'])('rejects blank, control, line break or malformed names: %j', name => {
    expect(() => normalizeName(name)).toThrow();
  });
});

describe('room configuration', () => {
  it('defaults to thirty participants and seven days', () => {
    expect(roomConfig({})).toEqual({ capacity: 30, lifetimeDays: 7 });
  });
  it.each(['0', '-1', '2', '3.5', '', 'Infinity', '9007199254740992'])('rejects invalid capacity %j', value => {
    expect(() => roomConfig({ ROOM_MAX_PARTICIPANTS: value })).toThrow();
  });
  it.each(['0', '-1', '1.2', '', 'Infinity', '100000001', '9007199254740992'])('rejects invalid or unrepresentable lifetime %j', value => {
    expect(() => roomConfig({ ROOM_LIFETIME_DAYS: value })).toThrow();
  });
  it('accepts configuration and uses singular/plural lifetime copy', () => {
    expect(roomConfig({ ROOM_MAX_PARTICIPANTS: '12', ROOM_LIFETIME_DAYS: '1' })).toEqual({ capacity: 12, lifetimeDays: 1 });
    expect(lifetimeCopy(1)).toBe('This room will be deleted after 1 day.');
    expect(lifetimeCopy(9)).toBe('This room will be deleted after 9 days.');
  });
});
