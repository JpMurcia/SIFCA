import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDb } from '../../integration/support/postgres-harness.js';
import { entryBody } from '../../support/compose-pg.js';
import { postReferenceLedger } from '../../support/reference-ledger.js';
import { startApp, type TestApp } from '../support/app.js';
import { validateRequest, validateResponse } from '../support/openapi.js';

/** T074 · US3: períodos, borradores, cierre anual y reportes cumplen el contrato. */
let db: TestDb;
let t: TestApp;
beforeAll(async () => {
  db = await createTestDatabase();
  t = await startApp(db);
  await postReferenceLedger(async (b) => {
    const r = await t.http().post('/api/v1/accounting/journal-entries').set(await t.auth()).send(b);
    if (r.status !== 201) throw new Error(JSON.stringify(r.body));
  });
});
afterAll(async () => {
  await t.close();
  await db.close();
});

const A = '/api/v1/accounting';
const check = (method: string, path: string, res: { status: number; headers: Record<string, string>; body: unknown }) => {
  const v = validateResponse(method, path, res.status, res.headers['content-type'] ?? 'application/json', res.body);
  expect(v.errors, `${method} ${path} ${res.status}`).toBe('');
};

describe('años fiscales y períodos', () => {
  it('POST /fiscal-years crea 12 períodos y 409 si el año ya existe', async () => {
    const res = await t.http().post(`${A}/fiscal-years`).set(await t.auth()).send({ year: 2027 });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(12);
    check('post', '/accounting/fiscal-years', res);
    const dup = await t.http().post(`${A}/fiscal-years`).set(await t.auth()).send({ year: 2027 });
    expect([dup.status, dup.body.code]).toEqual([409, 'CONFLICT']);
    check('post', '/accounting/fiscal-years', dup);
  });

  it('GET /periods', async () => {
    const res = await t.http().get(`${A}/periods?year=2026`).set(await t.auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(12);
    check('get', '/accounting/periods', res);
  });

  it('cierre y reapertura: 200, 409 (ya cerrado), 403 y 422 sin motivo', async () => {
    const periods = (await t.http().get(`${A}/periods?year=2026`).set(await t.auth())).body.data as Array<{ id: string; month: number }>;
    const aug = periods.find((p) => p.month === 8)!;
    const closed = await t.http().post(`${A}/periods/${aug.id}/close`).set(await t.auth());
    expect([closed.status, closed.body.status]).toEqual([200, 'CLOSED']);
    check('post', '/accounting/periods/{periodId}/close', closed);
    const again = await t.http().post(`${A}/periods/${aug.id}/close`).set(await t.auth());
    expect([again.status, again.body.code]).toEqual([409, 'CONFLICT']);
    check('post', '/accounting/periods/{periodId}/close', again);
    const noPerm = await t.http().post(`${A}/periods/${aug.id}/reopen`).set(await t.auth(['accounting.period.close'])).send({ reason: 'Corrección de una factura omitida' });
    expect([noPerm.status, noPerm.body.code]).toEqual([403, 'FORBIDDEN']);
    check('post', '/accounting/periods/{periodId}/reopen', noPerm);
    const noReason = await t.http().post(`${A}/periods/${aug.id}/reopen`).set(await t.auth()).send({});
    expect([noReason.status, noReason.body.code]).toEqual([422, 'VALIDATION_FAILED']);
    check('post', '/accounting/periods/{periodId}/reopen', noReason);
    const reopen = { reason: 'Corrección de una factura omitida' };
    expect(validateRequest('post', '/accounting/periods/{periodId}/reopen', reopen).errors).toBe('');
    const ok = await t.http().post(`${A}/periods/${aug.id}/reopen`).set(await t.auth()).send(reopen);
    expect([ok.status, ok.body.status]).toEqual([200, 'OPEN']);
    check('post', '/accounting/periods/{periodId}/reopen', ok);
  });

  it('409 PERIOD_CLOSE_BLOCKED con las causas cuando hay borradores [001-12]', async () => {
    const periods = (await t.http().get(`${A}/periods?year=2026`).set(await t.auth())).body.data as Array<{ id: string; month: number }>;
    const sep = periods.find((p) => p.month === 9)!;
    const draft = await t.http().post(`${A}/journal-drafts`).set(await t.auth()).send({ voucherType: 'AJ', accountingDate: '2026-09-10', lines: [{ accountCode: '1105', debit: '10' }] });
    expect(draft.status).toBe(201);
    const blocked = await t.http().post(`${A}/periods/${sep.id}/close`).set(await t.auth());
    expect([blocked.status, blocked.body.code]).toEqual([409, 'PERIOD_CLOSE_BLOCKED']);
    expect(blocked.body.errors[0].message).toMatch(/borrador/);
    check('post', '/accounting/periods/{periodId}/close', blocked);
    expect((await t.http().delete(`${A}/journal-drafts/${draft.body.id}`).set(await t.auth())).status).toBe(204);
    const ok = await t.http().post(`${A}/periods/${sep.id}/close`).set(await t.auth());
    expect(ok.status).toBe(200);
  });
});

describe('borradores', () => {
  it('POST, GET, PUT con versión, 409 por versión vieja y DELETE 204', async () => {
    const body = { voucherType: 'AJ', accountingDate: '2026-10-22', description: 'Borrador', lines: [{ accountCode: '1105', debit: '100' }] };
    expect(validateRequest('post', '/accounting/journal-drafts', body).errors).toBe('');
    const created = await t.http().post(`${A}/journal-drafts`).set(await t.auth()).send(body);
    expect(created.status).toBe(201);
    check('post', '/accounting/journal-drafts', created);
    const list = await t.http().get(`${A}/journal-drafts`).set(await t.auth());
    expect(list.status).toBe(200);
    check('get', '/accounting/journal-drafts', list);
    const put = await t.http().put(`${A}/journal-drafts/${created.body.id}`).set(await t.auth()).send({ ...body, description: 'Cambio', version: 1 });
    expect([put.status, put.body.version]).toEqual([200, 2]);
    check('put', '/accounting/journal-drafts/{draftId}', put);
    const stale = await t.http().put(`${A}/journal-drafts/${created.body.id}`).set(await t.auth()).send({ ...body, version: 1 });
    expect([stale.status, stale.body.code]).toEqual([409, 'CONFLICT']);
    const del = await t.http().delete(`${A}/journal-drafts/${created.body.id}`).set(await t.auth());
    expect(del.status).toBe(204);
    const missing = await t.http().delete(`${A}/journal-drafts/${created.body.id}`).set(await t.auth());
    expect([missing.status, missing.body.code]).toEqual([404, 'NOT_FOUND']);
    check('delete', '/accounting/journal-drafts/{draftId}', missing);
  });
});

describe('reportes', () => {
  it('GET /reports/trial-balance cumple el contrato y da 2.152.000 [SC-004]', async () => {
    const res = await t.http().get(`${A}/reports/trial-balance?from=2026-10-01&to=2026-10-31`).set(await t.auth());
    expect(res.status).toBe(200);
    expect(res.body.totals).toMatchObject({ closingDebit: '2152000.00', closingCredit: '2152000.00' });
    expect(res.body.balanced).toBe(true);
    check('get', '/accounting/reports/trial-balance', res);
    const lvl = await t.http().get(`${A}/reports/trial-balance?from=2026-10-01&to=2026-10-31&level=1`).set(await t.auth());
    expect(lvl.status).toBe(200);
    check('get', '/accounting/reports/trial-balance', lvl);
    const bad = await t.http().get(`${A}/reports/trial-balance?from=2026-10-31&to=2026-10-01`).set(await t.auth());
    expect([bad.status, bad.body.code]).toEqual([422, 'VALIDATION_FAILED']);
    check('get', '/accounting/reports/trial-balance', bad);
  });

  it('GET /reports/journal y /reports/general-ledger cumplen el contrato', async () => {
    const j = await t.http().get(`${A}/reports/journal?from=2026-10-01&to=2026-10-31&limit=5`).set(await t.auth());
    expect(j.status).toBe(200);
    expect(j.body.page.hasMore).toBe(true);
    check('get', '/accounting/reports/journal', j);
    const l = await t.http().get(`${A}/reports/general-ledger?accountCode=1110&from=2026-10-01&to=2026-10-31`).set(await t.auth());
    expect(l.status).toBe(200);
    expect(l.body.closingBalance).toBe('952000.00');
    check('get', '/accounting/reports/general-ledger', l);
    const nf = await t.http().get(`${A}/reports/general-ledger?accountCode=999999&from=2026-10-01&to=2026-10-31`).set(await t.auth());
    expect([nf.status, nf.body.code]).toEqual([404, 'NOT_FOUND']);
  });
});

describe('cierre anual', () => {
  it('POST /fiscal-years/{year}/closing: 201, cumple el contrato y es reversible; 409 si se repite', async () => {
    const accounts = (await t.http().get(`${A}/accounts?q=5905`).set(await t.auth())).body.data as Array<{ id: string; code: string }>;
    const results = (await t.http().get(`${A}/accounts?q=3605`).set(await t.auth())).body.data as Array<{ id: string; code: string }>;
    const body = { profitAndLossAccountId: accounts[0]!.id, yearResultAccountId: results[0]!.id, accountingDate: '2026-12-31', voucherType: 'CI' };
    expect(validateRequest('post', '/accounting/fiscal-years/{year}/closing', body).errors).toBe('');
    const res = await t.http().post(`${A}/fiscal-years/2026/closing`).set(await t.auth()).send(body);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.sourceType).toBe('YEAR_CLOSING');
    check('post', '/accounting/fiscal-years/{year}/closing', res);
    const again = await t.http().post(`${A}/fiscal-years/2026/closing`).set(await t.auth()).send(body);
    expect([again.status, again.body.code]).toEqual([409, 'CONFLICT']);
    check('post', '/accounting/fiscal-years/{year}/closing', again);
    const rev = await t.http().post(`${A}/journal-entries/${res.body.id}/reversal`).set(await t.auth()).send({ reason: 'Reabrir ejercicio', accountingDate: '2026-12-31' });
    expect(rev.status).toBe(201);
  });
});

void entryBody;
