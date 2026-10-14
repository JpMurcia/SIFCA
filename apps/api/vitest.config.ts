import { defineConfig } from 'vitest/config';

// Proyectos de prueba (plan.md → Testing). Los de integración usan PostgreSQL real
// (Testcontainers o SIFCA_TEST_PG_ADMIN_URL; ver test/integration/support/postgres-harness.ts).
export default defineConfig({
  test: {
    projects: [
      {
        extends: false,
        test: { name: 'unit', include: ['test/unit/**/*.spec.ts'], environment: 'node' },
      },
      {
        extends: false,
        test: {
          name: 'integration',
          include: ['test/integration/**/*.spec.ts'],
          environment: 'node',
          hookTimeout: 180_000,
          testTimeout: 120_000,
          fileParallelism: false,
          globalSetup: ['test/integration/support/global-setup.ts'],
        },
      },
      {
        extends: false,
        test: {
          name: 'contract',
          include: ['test/contract/**/*.spec.ts'],
          environment: 'node',
          hookTimeout: 180_000,
          testTimeout: 60_000,
          fileParallelism: false,
          globalSetup: ['test/integration/support/global-setup.ts'],
        },
      },
      {
        extends: false,
        test: { name: 'architecture', include: ['test/architecture/**/*.spec.ts'], environment: 'node', testTimeout: 120_000 },
      },
      {
        extends: false,
        test: {
          name: 'performance',
          include: ['test/performance/**/*.perf.ts'],
          environment: 'node',
          hookTimeout: 300_000,
          testTimeout: 600_000,
          fileParallelism: false,
          globalSetup: ['test/integration/support/global-setup.ts'],
        },
      },
    ],
  },
});
