import { defineConfig } from '@playwright/test';

// Solo para las capturas del video de lanzamiento; no corre con `npm run e2e`.
export default defineConfig({
  testDir: './e2e-video',
  workers: 1,
  timeout: 5 * 60_000,
  expect: { timeout: 30_000 },
  reporter: [['list']],
  use: { channel: 'chrome' },
});
