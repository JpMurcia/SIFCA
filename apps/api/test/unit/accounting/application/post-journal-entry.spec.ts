import { describe, expect, it } from 'vitest';
import { PostJournalEntry } from '../../../../src/modules/accounting/application/use-cases/post-journal-entry.js';
import { EntryNotBalanced, IdempotencyConflict, PeriodClosed, PeriodNotFound, ValidationFailed } from '../../../../src/modules/accounting/domain/errors/accounting-errors.js';
import { Forbidden } from '../../../../src/shared-kernel/index.js';
import { makeUnit, ZodError, type Unit } from '../../../support/compose-unit.js';

const make = (u: Unit) =>
  new PostJournalEntry({
    uow: u.uow, permissions: u.permissions, requestContext: u.requestContext, clock: u.clock, ids: u.ids, accounts: u.accounts,
    costCenters: u.costCenters, voucherTypes: u.voucherTypes, periods: u.periods, entries: u.entries, sequence: u.sequence, events: u.publisher,
  });

const base = (over: Record<string, unknown> = {}) => ({
  voucherType: 'AJ', accountingDate: '2026-10-14', description: 'Venta de contado',
  lines: [{ accountCode: '1105', debit: '100000.00' }, { accountCode: '4135', credit: '100000.00' }], ...over,
});

describe('PostJournalEntry', () => {
  it('contabiliza un comprobante cuadrado con consecutivo 1 y publica el evento [001-01]', async () => {
    const u = makeUnit();
    const { entry, created } = await make(u).execute(base());
    expect(created).toBe(true);
    expect(entry.number.value).toBe(1);
    expect(entry.totalDebit.toString()).toBe('100000.00');
    expect(u.db.entries.size).toBe(1);
    expect(u.publisher.events.map((e) => e.name)).toEqual(['accounting.journal_entry.posted.v1']);
  });

  it('asigna consecutivos contiguos por tipo', async () => {
    const u = makeUnit();
    const uc = make(u);
    const a = await uc.execute(base());
    const b = await uc.execute(base());
    const c = await uc.execute(base({ voucherType: 'FV' }));
    expect([a.entry.number.value, b.entry.number.value, c.entry.number.value]).toEqual([1, 2, 1]);
  });

  it('rechaza el descuadre y NO consume consecutivo [001-02]', async () => {
    const u = makeUnit();
    const uc = make(u);
    await expect(uc.execute(base({ lines: [{ accountCode: '1105', debit: '100000.00' }, { accountCode: '4135', credit: '99999.99' }] }))).rejects.toThrow(EntryNotBalanced);
    const ok = await uc.execute(base());
    expect(ok.entry.number.value).toBe(1);
  });

  it('rechaza línea con ambos lados [001-03], cuenta acumuladora [001-04] y falta de tercero [001-09] con VALIDATION_FAILED', async () => {
    const u = makeUnit();
    const uc = make(u);
    await expect(uc.execute(base({ lines: [{ accountCode: '1105', debit: '100', credit: '100' }, { accountCode: '4135', credit: '100' }] }))).rejects.toThrow(ValidationFailed);
    await expect(uc.execute(base({ lines: [{ accountCode: '13', debit: '100' }, { accountCode: '4135', credit: '100' }] }))).rejects.toThrow(ValidationFailed);
    await expect(uc.execute(base({ lines: [{ accountCode: '130505', debit: '100' }, { accountCode: '4135', credit: '100' }] }))).rejects.toThrow(ValidationFailed);
    expect(u.db.entries.size).toBe(0);
  });

  it('rechaza cuenta, centro de costo o tipo de comprobante inexistentes', async () => {
    const u = makeUnit();
    const uc = make(u);
    await expect(uc.execute(base({ lines: [{ accountCode: '999999', debit: '1' }, { accountCode: '4135', credit: '1' }] }))).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(uc.execute(base({ lines: [{ accountCode: '5105', debit: '1', costCenterCode: 'XX' }, { accountCode: '4135', credit: '1' }] }))).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(uc.execute(base({ voucherType: 'ZZ' }))).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('rechaza un período cerrado [001-05] y una fecha sin período', async () => {
    const u = makeUnit();
    u.closePeriod(2026, 9);
    const uc = make(u);
    await expect(uc.execute(base({ accountingDate: '2026-09-30' }))).rejects.toThrow(PeriodClosed);
    await expect(uc.execute(base({ accountingDate: '2027-01-05' }))).rejects.toThrow(PeriodNotFound);
    expect(u.db.entries.size).toBe(0);
  });

  it('una falla en el último paso no deja comprobante ni consume consecutivo [001-08]', async () => {
    const u = makeUnit();
    const uc = make(u);
    u.entries.failAfterAdd = new Error('falla inyectada');
    await expect(uc.execute(base())).rejects.toThrow('falla inyectada');
    expect(u.db.entries.size).toBe(0);
    u.entries.failAfterAdd = undefined;
    expect((await uc.execute(base())).entry.number.value).toBe(1);
  });

  it('una falla al asignar consecutivo tampoco deja rastro', async () => {
    const u = makeUnit();
    u.sequence.failOnNext = new Error('sin consecutivo');
    await expect(make(u).execute(base())).rejects.toThrow('sin consecutivo');
    expect(u.db.entries.size).toBe(0);
  });

  it('deriva la fecha contable de occurredAt en hora de Colombia [001-13]', async () => {
    const u = makeUnit();
    const { entry } = await make(u).execute(base({ accountingDate: undefined, occurredAt: '2026-11-01T04:30:00Z' }));
    expect(entry.accountingDate.toString()).toBe('2026-10-31');
  });

  it('usa hoy (hora de Colombia) si no se indica fecha', async () => {
    const u = makeUnit();
    const { entry } = await make(u).execute(base({ accountingDate: undefined }));
    expect(entry.accountingDate.toString()).toBe('2026-10-14');
  });

  it('idempotencia: misma clave y mismo cuerpo devuelve el comprobante; otro cuerpo da IDEMPOTENCY_CONFLICT', async () => {
    const u = makeUnit();
    const uc = make(u);
    const first = await uc.execute(base(), { idempotencyKey: 'demo-0001' });
    const again = await uc.execute(base(), { idempotencyKey: 'demo-0001' });
    expect(again.created).toBe(false);
    expect(again.entry.id).toBe(first.entry.id);
    expect(u.db.entries.size).toBe(1);
    await expect(uc.execute(base({ description: 'Otro' }), { idempotencyKey: 'demo-0001' })).rejects.toThrow(IdempotencyConflict);
  });

  it('exige el permiso accounting.entry.post', async () => {
    const u = makeUnit([]);
    await expect(make(u).execute(base())).rejects.toThrow(Forbidden);
  });

  it('valida la entrada con el esquema Zod: menos de 2 líneas, campos desconocidos, importes con 3 decimales', async () => {
    const u = makeUnit();
    const uc = make(u);
    await expect(uc.execute(base({ lines: [{ accountCode: '1105', debit: '1' }] }))).rejects.toThrow(ZodError);
    await expect(uc.execute({ ...base(), extra: 1 })).rejects.toThrow(ZodError);
    await expect(uc.execute(base({ lines: [{ accountCode: '1105', debit: '1.005' }, { accountCode: '4135', credit: '1' }] }))).rejects.toThrow(ZodError);
    await expect(uc.execute(base({ lines: [{ accountCode: '1105', debit: '-1' }, { accountCode: '4135', credit: '1' }] }))).rejects.toThrow(ZodError);
  });

  it('un origen distinto de MANUAL exige id y se guarda con el comprobante (R-CON-007)', async () => {
    const u = makeUnit();
    const uc = make(u);
    await expect(uc.execute(base({ source: { type: 'SALES_DOCUMENT' } }))).rejects.toThrow(ZodError);
    const id = '0195f3a0-0000-7000-8000-0000000000aa';
    const { entry } = await uc.execute(base({ source: { type: 'SALES_DOCUMENT', id } }));
    expect(entry.source).toMatchObject({ type: 'SALES_DOCUMENT', id });
  });
});
