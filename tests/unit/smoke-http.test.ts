import { createServer } from 'node:http';
import { request } from '@playwright/test';
import { expect, it } from 'vitest';
import { privateClient } from '../smoke/private-client';

it('does not expose identity cookies when a smoke HTTP request loses its connection', async () => {
  const server = createServer((incoming) => incoming.socket.destroy());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing test address');
  const client = await request.newContext({
    extraHTTPHeaders: { Cookie: 'room_access=synthetic-private-cookie' },
    timeout: 2000,
  });
  try {
    for (const method of ['get', 'post'] as const) {
      let failure: unknown;
      try {
        await privateClient(client)[method](`http://127.0.0.1:${address.port}`);
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).message).toBe(
        'Smoke HTTP transport failed; request details withheld.',
      );
      expect(String((failure as Error).stack)).not.toContain(
        'synthetic-private-cookie',
      );
      expect((failure as Error).cause).toBeUndefined();
    }
  } finally {
    await client.dispose();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
