import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Worker pool is selectable so a memory-constrained dev box can opt out of the
// default `threads` pool. Root cause (measured): on a low-RAM host, constructing
// the jsdom environment takes ~40s. With `threads`/`forks` that work happens
// while Vitest waits for the worker's start handshake, which it caps at a
// *hardcoded* 60s ("Timeout waiting for worker to respond"), so under memory
// pressure the jsdom test files never boot and the run fails non-deterministically.
// `vmThreads` sets the environment up AFTER the handshake (and, with isolate:false,
// once per worker), so jsdom stays under the cap — the full suite then runs green.
// CI has ample RAM, leaves VITEST_POOL unset, and keeps the faster, proven
// `threads` pool. Set VITEST_POOL=vmThreads locally on a low-memory machine.
const pool = (process.env.VITEST_POOL ?? 'threads') as 'threads' | 'forks' | 'vmThreads';

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
    // On this (slow, Windows) machine the default many-workers-in-parallel setup
    // floods the CPU: workers miss the startup handshake ("Timeout waiting for
    // worker to respond") and, worse, the affected test file's tests silently
    // don't run, so the gate is non-deterministic about what it actually checks.
    //
    // `isolate: false` reuses a single long-lived worker per environment instead
    // of spawning (and re-spawning) one per test file, so the startup storm — and
    // the repeated, very slow jsdom environment setup — disappears. The domain,
    // state, and export layers are pure (no module-level mutable singletons; state
    // lives in React context), and RTL's afterEach cleanup resets the DOM between
    // tests, so sharing a worker across files is safe here.
    pool,
    fileParallelism: false,
    isolate: false,
  },
});
