import { randomInt } from 'node:crypto';

// Fisher–Yates gives every permutation probability 1/n!. Rejecting precisely
// those with fixed points makes every remaining derangement equally likely.
// Reciprocal pairs are retained. Acceptance tends to 1/e (at least 1/3 for n>=3).
export function generateDraw(ids: string[]): Record<string, string> {
  if (ids.length < 3 || new Set(ids).size !== ids.length)
    throw new Error('A draw needs at least three distinct participants.');
  for (;;) {
    const recipients = [...ids];
    for (let i = recipients.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [recipients[i], recipients[j]] = [recipients[j], recipients[i]];
    }
    if (recipients.every((id, i) => id !== ids[i]))
      return Object.fromEntries(ids.map((id, i) => [id, recipients[i]]));
  }
}
