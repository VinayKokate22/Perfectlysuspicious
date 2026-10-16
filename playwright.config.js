import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false, workers: 1, retries: 0,
  timeout: 45000, expect: { timeout: 7000 }, reporter: [['list'], ['json', { outputFile: 'test-results/browser.json' }]],
  // Assertions use DOM, protocol and geometry data. Video frame capture adds
  // repeated software GPU readbacks without contributing to those checks.
  use: { baseURL: 'http://127.0.0.1:3911', browserName: 'chromium', trace: {mode:'retain-on-failure',screenshots:false,snapshots:true,sources:true} },
  webServer: { command: 'node tests/browser-server.js', url: 'http://127.0.0.1:3911/health', reuseExistingServer: false }
});
