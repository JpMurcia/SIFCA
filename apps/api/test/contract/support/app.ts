import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SignJWT } from 'jose';
import request from 'supertest';
import { AppModule } from '../../../src/app.module.js';
import { ProblemDetailsFilter } from '../../../src/platform/http/problem-details.filter.js';
import { seedFiscalYear, seedTestChart } from '../../fixtures/plan-de-cuentas-de-prueba.js';
import { ALL_PERMISSIONS } from '../../support/compose-pg.js';
import type { TestDb } from '../../integration/support/postgres-harness.js';

export const JWT_SECRET = 'contract-test-secret-0123456789';

export interface TestApp {
  app: INestApplication;
  tenantId: string;
  userId: string;
  http(): ReturnType<typeof request>;
  token(perms?: string[], tenant?: string): Promise<string>;
  auth(perms?: string[]): Promise<{ Authorization: string }>;
  close(): Promise<void>;
}

/** Arranca la API real (Nest) contra una base de pruebas y siembra un tenant con plan de cuentas y año 2026. */
export async function startApp(db: TestDb): Promise<TestApp> {
  process.env.DATABASE_URL = db.urls.app;
  process.env.JWT_DEV_SECRET = JWT_SECRET;
  process.env.NODE_ENV = 'test';
  process.env.TX_MAX_WAIT_MS = '30000';
  process.env.TX_TIMEOUT_MS = '60000';
  const tenantId = randomUUID();
  const userId = randomUUID();
  await db.withTenant(tenantId, async (c) => {
    await seedTestChart(c, tenantId);
    await seedFiscalYear(c, tenantId, 2026);
  }, db.owner);
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = mod.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ProblemDetailsFilter());
  await app.init();
  const key = new TextEncoder().encode(JWT_SECRET);
  const token = (perms: string[] = ALL_PERMISSIONS, tenant = tenantId) =>
    new SignJWT({ tid: tenant, perms }).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime('1h').sign(key);
  return {
    app, tenantId, userId,
    http: () => request(app.getHttpServer()),
    token,
    auth: async (perms) => ({ Authorization: `Bearer ${await token(perms)}` }),
    close: () => app.close(),
  };
}
