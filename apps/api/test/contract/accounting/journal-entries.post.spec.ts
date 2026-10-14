import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDb } from '../../integration/support/postgres-harness.js';
import { entryBody } from '../../support/compose-pg.js';
import { startApp, type TestApp } from '../support/app.js';
import { validateRequest, validateResponse } from '../support/openapi.js';

/** T046 · US1: la API real cumple contracts/accounting.v1.openapi.yaml. */
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
const check = (method: string, path: string, res: { status: number; headers: Record<string, string>; body: unknown }) => {
  const v = validateResponse(method, path, res.status, res.headers['content-type'] ?? 'application/json', res.body);
  expect(v.errors, `${method} ${path} ${res.status}`).toBe('');
  expect(v.ok).toBe(true);
};

describe('POST /accounting/journal-entries', () => {
  it('201: comprobante contabilizado, con Location y conforme al contrato', async () => {
    const body = entryBody();
    expect(validateRequest('post', P, body).errors).toBe('');
    const res = await t.http().post('/api/v1' + P).set(await t.auth()).send(body);
    expect(res.status).toBe(201);
    expect(res.headers.location).toMatch(/\/api\/v1\/accounting\/journal-entries\/[0-9a-f-]{36}/);
    expect(res.body).toMatchObject({ number: 1, status: 'POSTED', totalDebit: '100000.00', totalCredit: '100000.00', sourceType: 'MANUAL' });
    check('post', P, res);
  });

  it('200: reintento idempotente con la misma clave', async () => {
    const h = { ...(await t.auth()), 'Idempotency-Key': 'contract-idem-1' };
    const a = await t.http().post('/api/v1' + P).set(h).send(entryBody());
    const b = await t.http().post('/api/v1' + P).set(h).send(entryBody());
    expect([a.status, b.status]).toEqual([201, 200]);
    expect(b.body.id).toBe(a.body.id);
    check('post', P, b);
    const c = await t.http().post('/api/v1' + P).set(h).send(entryBody({ description: 'otro cuerpo' }));
    expect(c.status).toBe(422);
    expect(c.body.code).toBe('IDEMPOTENCY_CONFLICT');
    check('post', P, c);
  });

  it('422 ENTRY_NOT_BALANCED con application/problem+json', async () => {
    const res = await t.http().post('/api/v1' + P).set(await t.auth()).send(entryBody({ lines: [{ accountCode: '1105', debit: '100' }, { accountCode: '4135', credit: '99.99' }] }));
    expect(res.status).toBe(422);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.body).toMatchObject({ code: 'ENTRY_NOT_BALANCED', status: 422 });
    expect(res.body.errors[0].rule).toBe('R-CON-001');
    check('post', P, res);
  });

  it('422 VALIDATION_FAILED: esquema inválido y reglas de línea, con errors[]', async () => {
    for (const body of [
      entryBody({ lines: [{ accountCode: '1105', debit: '1' }] }),
      entryBody({ lines: [{ accountCode: '1105', debit: '1.005' }, { accountCode: '4135', credit: '1' }] }),
      entryBody({ lines: [{ accountCode: '13', debit: '100' }, { accountCode: '4135', credit: '100' }] }),
      entryBody({ lines: [{ accountCode: '130505', debit: '100' }, { accountCode: '4135', credit: '100' }] }),
      entryBody({ lines: [{ accountCode: '1105', debit: '100', credit: '100' }, { accountCode: '4135', credit: '100' }] }),
    ]) {
      const res = await t.http().post('/api/v1' + P).set(await t.auth()).send(body);
      expect(res.status, JSON.stringify(res.body)).toBe(422);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(res.body.errors.length).toBeGreaterThan(0);
      check('post', P, res);
    }
  });

  it('409 PERIOD_CLOSED y 422 PERIOD_NOT_FOUND', async () => {
    await db.withTenant(t.tenantId, (c) => c.query(`UPDATE acc.fiscal_period SET status='CLOSED', closed_at=now() WHERE year=2026 AND month=9`), db.owner);
    const closed = await t.http().post('/api/v1' + P).set(await t.auth()).send(entryBody({ accountingDate: '2026-09-30' }));
    expect([closed.status, closed.body.code]).toEqual([409, 'PERIOD_CLOSED']);
    check('post', P, closed);
    const none = await t.http().post('/api/v1' + P).set(await t.auth()).send(entryBody({ accountingDate: '2031-01-01' }));
    expect([none.status, none.body.code]).toEqual([422, 'PERIOD_NOT_FOUND']);
    check('post', P, none);
  });

  it('403 sin permiso y 401 sin token', async () => {
    const forbidden = await t.http().post('/api/v1' + P).set(await t.auth(['accounting.report.read'])).send(entryBody());
    expect([forbidden.status, forbidden.body.code]).toEqual([403, 'FORBIDDEN']);
    check('post', P, forbidden);
    const anon = await t.http().post('/api/v1' + P).send(entryBody());
    expect([anon.status, anon.body.code]).toEqual([401, 'UNAUTHENTICATED']);
  });
});

describe('lecturas', () => {
  it('GET por id y GET lista cumplen el contrato; 404 para un id inexistente', async () => {
    const created = await t.http().post('/api/v1' + P).set(await t.auth()).send(entryBody({ voucherType: 'FV' }));
    const one = await t.http().get(`/api/v1${P}/${created.body.id}`).set(await t.auth());
    expect(one.status).toBe(200);
    expect(one.body.lines).toHaveLength(2);
    check('get', `${P}/{entryId}`, one);

    const list = await t.http().get(`/api/v1${P}?limit=2&voucherType=AJ`).set(await t.auth());
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeLessThanOrEqual(2);
    check('get', P, list);

    const missing = await t.http().get(`/api/v1${P}/0195f3a0-0000-7000-8000-00000000dead`).set(await t.auth());
    expect([missing.status, missing.body.code]).toEqual([404, 'NOT_FOUND']);
    check('get', `${P}/{entryId}`, missing);
  });

  it('GET /accounting/accounts y /accounting/voucher-types cumplen el contrato', async () => {
    const accounts = await t.http().get('/api/v1/accounting/accounts?postableOnly=true&limit=5').set(await t.auth());
    expect(accounts.status).toBe(200);
    expect(accounts.body.data.length).toBeGreaterThan(0);
    check('get', '/accounting/accounts', accounts);
    const types = await t.http().get('/api/v1/accounting/voucher-types').set(await t.auth());
    expect(types.status).toBe(200);
    check('get', '/accounting/voucher-types', types);
  });
});

describe('el validador de contrato detecta incumplimientos (prueba de la prueba)', () => {
  it('rechaza un cuerpo que no cumple y una respuesta no definida', () => {
    expect(validateResponse('post', P, 201, 'application/json', { id: 'no-es-uuid' }).ok).toBe(false);
    expect(validateResponse('post', P, 201, 'application/json', { foo: 1 }).ok).toBe(false);
    expect(validateResponse('post', P, 418, 'application/json', {}).ok).toBe(false);
    expect(validateRequest('post', P, { voucherType: 'aj', lines: [] }).ok).toBe(false);
  });
});
