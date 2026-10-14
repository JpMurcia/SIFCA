import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDb } from '../../integration/support/postgres-harness.js';
import { entryBody } from '../../support/compose-pg.js';
import { startApp, type TestApp } from '../support/app.js';
import { validateRequest, validateResponse } from '../support/openapi.js';

/** T060 · US2: reversión y 405 ENTRY_IMMUTABLE cumplen el contrato. */
let db: TestDb;
let t: TestApp;
beforeAll(async () => {
  db = await createTestDatabase();
  t = await startApp(db);
});
afterAll(async () => {
  await t.close();
  await db.close();
});

const P = '/accounting/journal-entries';
const R = `${P}/{entryId}/reversal`;
const check = (method: string, path: string, res: { status: number; headers: Record<string, string>; body: unknown }) => {
  const v = validateResponse(method, path, res.status, res.headers['content-type'] ?? 'application/json', res.body);
  expect(v.errors, `${method} ${path} ${res.status}`).toBe('');
};
const create = async () => (await t.http().post('/api/v1' + P).set(await t.auth()).send(entryBody())).body.id as string;

describe('PUT / PATCH / DELETE sobre un comprobante → 405 ENTRY_IMMUTABLE', () => {
  for (const method of ['put', 'patch', 'delete'] as const) {
    it(`${method.toUpperCase()} responde 405 con application/problem+json`, async () => {
      const id = await create();
      const res = await t.http()[method](`/api/v1${P}/${id}`).set(await t.auth()).send({ description: 'cambio' });
      expect(res.status).toBe(405);
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body).toMatchObject({ code: 'ENTRY_IMMUTABLE', status: 405 });
      check(method, `${P}/{entryId}`, res);
      const unchanged = await t.http().get(`/api/v1${P}/${id}`).set(await t.auth());
      expect(unchanged.body.description).toBe('Venta de contado');
    });
  }
});

describe('POST …/reversal', () => {
  it('201: crea el contraasiento, cumple el contrato y deja visibles ambos comprobantes', async () => {
    const id = await create();
    const body = { reason: 'Error de digitación' };
    expect(validateRequest('post', R, body).errors).toBe('');
    const res = await t.http().post(`/api/v1${P}/${id}/reversal`).set(await t.auth()).send(body);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ reversalOf: id, sourceType: 'REVERSAL', reversalReason: 'Error de digitación' });
    expect(res.body.lines[0]).toMatchObject({ accountCode: '1105', debit: '0.00', credit: '100000.00' });
    check('post', R, res);
    const original = await t.http().get(`/api/v1${P}/${id}`).set(await t.auth());
    expect(original.body.reversedBy).toBe(res.body.id);
    check('get', `${P}/{entryId}`, original);
  });

  it('409 ALREADY_REVERSED al reversar dos veces', async () => {
    const id = await create();
    await t.http().post(`/api/v1${P}/${id}/reversal`).set(await t.auth()).send({ reason: 'Primera vez' });
    const res = await t.http().post(`/api/v1${P}/${id}/reversal`).set(await t.auth()).send({ reason: 'Segunda vez' });
    expect([res.status, res.body.code]).toEqual([409, 'ALREADY_REVERSED']);
    check('post', R, res);
  });

  it('409 PERIOD_CLOSED si la fecha de la reversión cae en un período cerrado', async () => {
    const id = await create();
    await db.withTenant(t.tenantId, (c) => c.query(`UPDATE acc.fiscal_period SET status='CLOSED', closed_at=now() WHERE year=2026 AND month=8`), db.owner);
    const res = await t.http().post(`/api/v1${P}/${id}/reversal`).set(await t.auth()).send({ reason: 'Corrección', accountingDate: '2026-08-15' });
    expect([res.status, res.body.code]).toEqual([409, 'PERIOD_CLOSED']);
    check('post', R, res);
  });

  it('404, 422 y 403', async () => {
    const id = await create();
    const nf = await t.http().post(`/api/v1${P}/0195f3a0-0000-7000-8000-00000000dead/reversal`).set(await t.auth()).send({ reason: 'No existe' });
    expect([nf.status, nf.body.code]).toEqual([404, 'NOT_FOUND']);
    check('post', R, nf);
    const bad = await t.http().post(`/api/v1${P}/${id}/reversal`).set(await t.auth()).send({ reason: 'x' });
    expect([bad.status, bad.body.code]).toEqual([422, 'VALIDATION_FAILED']);
    check('post', R, bad);
    const forbidden = await t.http().post(`/api/v1${P}/${id}/reversal`).set(await t.auth(['accounting.entry.post'])).send({ reason: 'Sin permiso' });
    expect([forbidden.status, forbidden.body.code]).toEqual([403, 'FORBIDDEN']);
    check('post', R, forbidden);
  });
});
