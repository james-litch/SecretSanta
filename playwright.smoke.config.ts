import { defineConfig } from '@playwright/test';
import local from './playwright.config';

const cloudFree = process.env.SMOKE_LOCAL === '1';
const target = process.env.SMOKE_ORIGIN;
if (!cloudFree && process.env.SMOKE_HTTP_ONLY !== '1') {
  let secureRedis = false;
  try {
    secureRedis =
      new URL(process.env.SMOKE_REDIS_URL ?? '').protocol === 'rediss:';
  } catch {}
  if (!secureRedis)
    throw new Error(
      'Set SMOKE_REDIS_URL to the same disposable database, using rediss://.',
    );
}
if (cloudFree && target)
  throw new Error('Do not combine SMOKE_LOCAL and SMOKE_ORIGIN.');
if (!cloudFree && !target)
  throw new Error('Set SMOKE_ORIGIN to the disposable HTTPS deployment.');
const origin = new URL(cloudFree ? 'http://127.0.0.1:3100' : target!);
if (
  origin.username ||
  origin.password ||
  origin.search ||
  origin.hash ||
  origin.pathname !== '/'
)
  throw new Error(
    'SMOKE_ORIGIN must be an origin without credentials, path, query or fragment.',
  );
if (!cloudFree && origin.protocol !== 'https:')
  throw new Error('Hosted smoke requires HTTPS.');

export default defineConfig({
  testDir: './tests/smoke',
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: 'list',
  outputDir: 'test-results/smoke',
  use: {
    baseURL: origin.origin,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: cloudFree ? local.webServer : undefined,
});
