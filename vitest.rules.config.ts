import { defineConfig } from 'vitest/config';

/**
 * Rules tests are separate from the domain tests: they need the Firestore
 * emulator running, so they must not be part of the fast `npm test` loop.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/rules/**/*.test.ts'],
    testTimeout: 15000,
    hookTimeout: 30000,
    // The emulator is shared mutable state; parallel files would fight.
    fileParallelism: false,
  },
});
