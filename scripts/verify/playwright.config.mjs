import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './suites',
  testMatch: '**/*.spec.mjs',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    colorScheme: 'dark',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/verify/lib/serve.mjs',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: true,
    cwd: new URL('../..', import.meta.url).pathname,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      // Chromium at phone size: the site on a small touch screen, not the iPhone engine.
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      },
    },
    {
      name: 'reduced',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' },
    },
    {
      // iOS reports reduced motion in Low Power Mode, so phones take this path too.
      name: 'reduced-phone',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
        reducedMotion: 'reduce',
      },
    },
    {
      // Every iOS browser is WebKit. Spread unmodified so defaultBrowserType 'webkit' is honoured.
      // No collapsing URL bar here, so 100vh behaves as on a desktop.
      name: 'webkit-phone',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
    },
  ],
})
