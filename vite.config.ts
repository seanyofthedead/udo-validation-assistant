import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/  +  https://vitest.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Default to the fast Node environment. The domain engine, state, and export
    // layers are pure logic and need no DOM. Component tests (SPEC §7 screens,
    // Wave 3) opt into a browser-like DOM per file with a docblock:
    //
    //   // @vitest-environment jsdom
    //   import '@testing-library/jest-dom/vitest';  // matchers (see src/test/setup.ts)
    //
    // jsdom is heavy to initialize; keeping it off the hot path keeps the loop's
    // verification gate fast and reliable.
    environment: 'node',
  },
});
