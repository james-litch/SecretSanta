import type { APIRequestContext } from '@playwright/test';

export type PrivateClient = Pick<
  APIRequestContext,
  'get' | 'post' | 'storageState'
>;

async function transport<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    // Playwright's original exception includes outgoing Cookie headers.
    // Never retain it as a cause or attach it to the failure reporter.
    throw new Error('Smoke HTTP transport failed; request details withheld.');
  }
}

export function privateClient(client: APIRequestContext): PrivateClient {
  return {
    get: (...args) => transport(() => client.get(...args)),
    post: (...args) => transport(() => client.post(...args)),
    storageState: (...args) => transport(() => client.storageState(...args)),
  };
}
