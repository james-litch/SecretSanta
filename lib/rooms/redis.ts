import { createClient } from 'redis';

// Global reuse also survives development module reloads. Never log connection URLs or commands.
const shared = globalThis as typeof globalThis & { roomRedis?: ReturnType<typeof createClient>; roomRedisConnecting?: Promise<unknown> };
export async function roomRedis() {
  if (!shared.roomRedis) {
    shared.roomRedis = createClient({
      url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
      disableOfflineQueue: true,
      socket: { connectTimeout: 2000, reconnectStrategy: retries => retries < 3 ? 200 * (retries + 1) : false },
    });
    shared.roomRedis.on('error', () => { /* Operations return a sanitized service failure. */ });
  }
  const client = shared.roomRedis;
  if (!client.isOpen && !shared.roomRedisConnecting) {
    shared.roomRedisConnecting = client.connect().finally(() => { shared.roomRedisConnecting = undefined; });
  }
  if (shared.roomRedisConnecting) await shared.roomRedisConnecting;
  if (!client.isReady) throw new Error('Redis unavailable');
  return client.withCommandOptions({ abortSignal: AbortSignal.timeout(3000) });
}
