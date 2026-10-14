import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildOpenApiDocument } from '../../../src/platform/http/openapi.js';
import { createTestDatabase, type TestDb } from '../../integration/support/postgres-harness.js';
import { startApp, type TestApp } from '../support/app.js';
import { contract } from '../support/openapi.js';

/** T087 · el OpenAPI generado por NestJS (rutas reales) coincide con el contrato de diseño en rutas y métodos. */
let db: TestDb;
let t: TestApp;
beforeAll(async () => {
  db = await createTestDatabase();
  t = await startApp(db, { seed: false });
});
afterAll(async () => {
  await t.close();
  await db.close();
});

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const ops = (paths: Record<string, Record<string, unknown>>, norm: (p: string) => string) =>
  Object.entries(paths).flatMap(([p, item]) => Object.keys(item).filter((m) => METHODS.includes(m)).map((m) => `${m.toUpperCase()} ${norm(p)}`)).sort();

describe('paridad del contrato con la API real', () => {
  it('las mismas rutas y métodos (el generado lleva el prefijo /api/v1 y :param)', () => {
    const generated = buildOpenApiDocument(t.app);
    const real = ops(generated.paths as never, (p) => p.replace(/^\/api\/v1/, '').replace(/\{(\w+)\}/g, '{$1}'));
    const designed = ops(contract.paths, (p) => p);
    expect(real.filter((r) => !designed.includes(r)), 'rutas implementadas que el contrato no declara').toEqual([]);
    expect(designed.filter((d) => !real.includes(d)), 'rutas del contrato sin implementar').toEqual([]);
  });

  it('los parámetros de ruta del contrato existen en la ruta implementada', () => {
    const generated = buildOpenApiDocument(t.app);
    for (const path of Object.keys(contract.paths)) {
      const params = [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      const real = Object.keys(generated.paths).find((p) => p.replace(/^\/api\/v1/, '') === path);
      expect(real, path).toBeDefined();
      for (const prm of params) expect(real).toContain(`{${prm}}`);
    }
  });
});
