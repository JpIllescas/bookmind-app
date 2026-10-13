import { defineConfig } from '@playwright/test';

// Corre contra el stack levantado en local (frontend, backend y ml-service), no contra mocks.
export default defineConfig({
  testDir: './e2e',
  // Un solo estudiante y un solo libro: los pasos van en orden.
  workers: 1,
  timeout: 5 * 60_000,
  expect: { timeout: 30_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_URL ?? 'http://localhost:4200',
    // El Chrome instalado: no hace falta descargar navegadores.
    channel: 'chrome',
    storageState: 'e2e/.auth/sesion.json',
    viewport: { width: 1600, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
