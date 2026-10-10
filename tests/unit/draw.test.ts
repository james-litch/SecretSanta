import { expect, it, vi } from 'vitest';
import { generateDraw } from '../../lib/rooms/draw';
import { randomInt } from 'node:crypto';
vi.mock('node:crypto', async (original) => {
  const actual = await original<typeof import('node:crypto')>();
  return {
    ...actual,
    randomInt: vi.fn((max: number) => actual.randomInt(max)),
  };
});

it('permits reciprocal pairs and rejects ineligible rosters', () => {
  const random = vi.mocked(randomInt as (max: number) => number);
  // Fisher–Yates choices produce B,A,D,C, a pair of reciprocal pairs.
  random.mockReturnValueOnce(2).mockReturnValueOnce(2).mockReturnValueOnce(0);
  expect(generateDraw(['A', 'B', 'C', 'D'])).toEqual({
    A: 'B',
    B: 'A',
    C: 'D',
    D: 'C',
  });

  expect(() => generateDraw(['A', 'B'])).toThrow();
  expect(() => generateDraw(['A', 'B', 'A'])).toThrow();
});

it('assigns everyone exactly one other recipient', () => {
  for (const size of [3, 4, 12, 30]) {
    const ids = Array.from({ length: size }, (_, i) => String(i));
    for (let attempt = 0; attempt < 50; attempt++) {
      const draw = generateDraw(ids);
      expect(Object.keys(draw).sort()).toEqual([...ids].sort());
      expect(Object.values(draw).sort()).toEqual([...ids].sort());
      for (const id of ids) expect(draw[id]).not.toBe(id);
    }
  }
});
