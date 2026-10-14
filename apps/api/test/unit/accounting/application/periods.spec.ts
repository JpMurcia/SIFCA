import { describe, expect, it } from 'vitest';
import { BalancedTrialBalanceCheck } from '../../../../src/modules/accounting/application/period-checks/balanced-trial-balance-check.js';
import { NoDraftsCheck } from '../../../../src/modules/accounting/application/period-checks/no-drafts-check.js';
import { CloseFiscalYear } from '../../../../src/modules/accounting/application/use-cases/close-fiscal-year.js';
import { ClosePeriod } from '../../../../src/modules/accounting/application/use-cases/close-period.js';
import { CreateFiscalYear } from '../../../../src/modules/accounting/application/use-cases/create-fiscal-year.js';
import { PostJournalEntry } from '../../../../src/modules/accounting/application/use-cases/post-journal-entry.js';
import { ReopenPeriod } from '../../../../src/modules/accounting/application/use-cases/reopen-period.js';
import { ReverseJournalEntry } from '../../../../src/modules/accounting/application/use-cases/reverse-journal-entry.js';
import { SaveJournalDraft } from '../../../../src/modules/accounting/application/use-cases/journal-drafts.js';
import type { PeriodCloseCheck } from '../../../../src/modules/accounting/application/ports/period-close-check.js';
import { FiscalPeriod } from '../../../../src/modules/accounting/domain/entities/fiscal-period.js';
import { PeriodClosed } from '../../../../src/modules/accounting/domain/errors/accounting-errors.js';
import { Forbidden } from '../../../../src/shared-kernel/index.js';
import { postReferenceLedger } from '../../../support/reference-ledger.js';
import { makeUnit, USER, ZodError, type Unit } from '../../../support/compose-unit.js';

const postDeps = (u: Unit) => ({
  uow: u.uow, permissions: u.permissions, requestContext: u.requestContext, clock: u.clock, ids: u.ids, accounts: u.accounts,
  costCenters: u.costCenters, voucherTypes: u.voucherTypes, periods: u.periods, entries: u.entries, sequence: u.sequence, events: u.publisher,
});
function build(u: Unit, extraChecks: PeriodCloseCheck[] = []) {
  const post = new PostJournalEntry(postDeps(u));
  return {
    post,
    reverse: new ReverseJournalEntry(postDeps(u)),
    close: new ClosePeriod({
      uow: u.uow, permissions: u.permissions, requestContext: u.requestContext, clock: u.clock, periods: u.periods, audit: u.audit, events: u.publisher,
      checks: [new BalancedTrialBalanceCheck(u.trialBalance), new NoDraftsCheck(u.drafts), ...extraChecks],
    }),
    reopen: new ReopenPeriod({ uow: u.uow, permissions: u.permissions, requestContext: u.requestContext, clock: u.clock, periods: u.periods, audit: u.audit, events: u.publisher }),
    createYear: new CreateFiscalYear({ uow: u.uow, permissions: u.permissions, ids: u.ids, periods: u.periods }),
    saveDraft: new SaveJournalDraft({ uow: u.uow, permissions: u.permissions, requestContext: u.requestContext, clock: u.clock, ids: u.ids, voucherTypes: u.voucherTypes, drafts: u.drafts }),
    closeYear: new CloseFiscalYear({
      uow: u.uow, permissions: u.permissions, requestContext: u.requestContext, clock: u.clock, ids: u.ids, accounts: u.accounts, trialBalance: u.trialBalance, entries: u.entries, post,
    }),
  };
}
const octoberId = (u: Unit) => u.db.periods.find((p) => p.year === 2026 && p.month === 10)!.id;
const ajBody = (over: Record<string, unknown> = {}) => ({
  voucherType: 'AJ', accountingDate: '2026-10-14', description: 'x', lines: [{ accountCode: '1105', debit: '10' }, { accountCode: '4135', credit: '10' }], ...over,
});

describe('CreateFiscalYear', () => {
  it('crea los 12 períodos abiertos y no repite el año', async () => {
    const u = makeUnit();
    const { createYear } = build(u);
    const ps = await createYear.execute({ year: 2027 });
    expect(ps).toHaveLength(12);
    expect(ps.every((p) => p.isOpen())).toBe(true);
    expect(ps[1]!.endsOn.toString()).toBe('2027-02-28');
    await expect(createYear.execute({ year: 2027 })).rejects.toMatchObject({ code: 'CONFLICT' });
  });
  it('exige permiso y un año válido', async () => {
    const u = makeUnit([]);
    await expect(build(u).createYear.execute({ year: 2027 })).rejects.toThrow(Forbidden);
    await expect(build(makeUnit()).createYear.execute({ year: 1800 })).rejects.toThrow(ZodError);
  });
});

describe('ClosePeriod (R-CON-011)', () => {
  it('cierra un período con balance cuadrado y sin borradores, deja bitácora y publica el evento', async () => {
    const u = makeUnit();
    const { post, close } = build(u);
    await post.execute(ajBody());
    const closed = await close.execute(octoberId(u));
    expect(closed.status).toBe('CLOSED');
    expect(closed.closedBy).toBe(USER);
    expect(u.db.audit).toHaveLength(1);
    expect(u.db.audit[0]).toMatchObject({ action: 'accounting.period.closed', entityType: 'fiscal_period', entityId: octoberId(u) });
    expect(u.publisher.events.map((e) => e.name)).toContain('accounting.period.closed.v1');
  });

  it('después del cierre nadie contabiliza en ese mes [001-05]', async () => {
    const u = makeUnit();
    const { post, close } = build(u);
    await close.execute(octoberId(u));
    await expect(post.execute(ajBody())).rejects.toThrow(PeriodClosed);
  });

  it('se rechaza con borradores y lista las causas [001-12]', async () => {
    const u = makeUnit();
    const { saveDraft, close } = build(u);
    await saveDraft.execute({ voucherType: 'AJ', accountingDate: '2026-10-20', lines: [{ accountCode: '1105', debit: '10' }] });
    await expect(close.execute(octoberId(u))).rejects.toMatchObject({ code: 'PERIOD_CLOSE_BLOCKED' });
    try {
      await close.execute(octoberId(u));
    } catch (e) {
      expect((e as { violations: Array<{ message: string }> }).violations[0]!.message).toMatch(/borrador/);
    }
    expect(u.db.periods.find((p) => p.id === octoberId(u))!.isOpen()).toBe(true);
    expect(u.db.audit).toHaveLength(0);
  });

  it('un borrador de otro mes no bloquea el cierre', async () => {
    const u = makeUnit();
    const { saveDraft, close } = build(u);
    await saveDraft.execute({ voucherType: 'AJ', accountingDate: '2026-11-20', lines: [] });
    await expect(close.execute(octoberId(u))).resolves.toBeTruthy();
  });

  it('acepta comprobaciones de otros módulos que aportan causas de bloqueo', async () => {
    const u = makeUnit();
    const inv: PeriodCloseCheck = { check: async () => [{ field: 'inventory', message: 'Conciliación de inventario pendiente', rule: 'R-INV-015' }] };
    await expect(build(u, [inv]).close.execute(octoberId(u))).rejects.toMatchObject({ code: 'PERIOD_CLOSE_BLOCKED' });
  });

  it('CONFLICT si ya está cerrado, NOT_FOUND si no existe y FORBIDDEN sin permiso', async () => {
    const u = makeUnit();
    const { close } = build(u);
    await close.execute(octoberId(u));
    await expect(close.execute(octoberId(u))).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(close.execute('0195f3a0-0000-7000-8000-0000000000ee')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(build(makeUnit(['accounting.report.read'])).close.execute(octoberId(u))).rejects.toThrow(Forbidden);
  });
});

describe('ReopenPeriod (R-CON-004) [001-14]', () => {
  it('exige permiso propio y motivo; deja bitácora con el motivo y el usuario', async () => {
    const u = makeUnit();
    const { close, reopen, post } = build(u);
    await close.execute(octoberId(u));
    await expect(build(makeUnit(['accounting.period.close'])).reopen.execute(octoberId(u), { reason: 'Corrección de una factura omitida' })).rejects.toThrow(Forbidden);
    await expect(reopen.execute(octoberId(u), {})).rejects.toThrow(ZodError);
    await expect(reopen.execute(octoberId(u), { reason: 'x' })).rejects.toThrow(ZodError);
    const reopened = await reopen.execute(octoberId(u), { reason: 'Corrección de una factura omitida' });
    expect(reopened.isOpen()).toBe(true);
    expect(reopened.closedAt).toBeNull();
    expect(u.db.audit.at(-1)).toMatchObject({ action: 'accounting.period.reopened', reason: 'Corrección de una factura omitida', before: { status: 'CLOSED' }, after: { status: 'OPEN' } });
    expect(u.publisher.events.map((e) => e.name)).toContain('accounting.period.reopened.v1');
    await expect(post.execute(ajBody())).resolves.toBeTruthy();
  });

  it('CONFLICT si el período ya está abierto', async () => {
    const u = makeUnit();
    await expect(build(u).reopen.execute(octoberId(u), { reason: 'No hacía falta' })).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('CloseFiscalYear (R-CON-012) [001-15]', () => {
  const ids = (u: Unit) => ({
    profitAndLossAccountId: u.db.accounts.get('5905')!.id, yearResultAccountId: u.db.accounts.get('3605')!.id, accountingDate: '2026-12-31', voucherType: 'CI',
  });

  it('cancela las cuentas de resultado contra ganancias y pérdidas y traslada la utilidad', async () => {
    const u = makeUnit();
    const { closeYear, post } = build(u);
    await postReferenceLedger((b) => post.execute(b));
    const { entry } = await closeYear.execute(2026, ids(u));
    expect(entry.source.type).toBe('YEAR_CLOSING');
    const net = new Map<string, number>();
    for (const e of u.db.entries.values()) for (const l of e.lines) net.set(l.accountCode, (net.get(l.accountCode) ?? 0) + Number(l.debit.toString()) - Number(l.credit.toString()));
    for (const code of ['4135', '4175', '6135', '5905']) expect(net.get(code) ?? 0, code).toBe(0);
    expect(net.get('3605')).toBe(-320000);
    expect(entry.totalDebit.equals(entry.totalCredit)).toBe(true);
  });

  it('es reversible y el ejercicio solo se cierra una vez mientras el cierre no esté reversado', async () => {
    const u = makeUnit();
    const { closeYear, post, reverse } = build(u);
    await postReferenceLedger((b) => post.execute(b));
    const { entry } = await closeYear.execute(2026, ids(u));
    await expect(closeYear.execute(2026, ids(u))).rejects.toMatchObject({ code: 'CONFLICT' });
    await reverse.execute(entry.id, { reason: 'Reabrir ejercicio', accountingDate: '2026-12-31' });
    await expect(closeYear.execute(2026, ids(u))).resolves.toBeTruthy();
  });

  it('con pérdida traslada el resultado al débito de la cuenta del ejercicio', async () => {
    const u = makeUnit();
    const { closeYear, post } = build(u);
    await post.execute({ voucherType: 'AJ', accountingDate: '2026-10-01', description: 'Gasto', lines: [{ accountCode: '6135', debit: '500' }, { accountCode: '1105', credit: '500' }] });
    const { entry } = await closeYear.execute(2026, ids(u));
    const l3605 = entry.lines.find((l) => l.accountCode === '3605')!;
    expect(l3605.debit.toString()).toBe('500.00');
  });

  it('VALIDATION_FAILED si no hay saldos de resultado que cerrar', async () => {
    const u = makeUnit();
    await expect(build(u).closeYear.execute(2026, ids(u))).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('exige el permiso accounting.year.close', async () => {
    const u = makeUnit(['accounting.entry.post']);
    await expect(build(u).closeYear.execute(2026, ids(u))).rejects.toThrow(Forbidden);
  });
});

describe('FiscalPeriod (dominio)', () => {
  it('close/reopen devuelven copias y validan el estado', () => {
    const u = makeUnit();
    const p = u.db.periods[0]!;
    const closed = p.close(USER, u.clock.now());
    expect(closed.status).toBe('CLOSED');
    expect(p.status).toBe('OPEN');
    expect(() => closed.close(USER, u.clock.now())).toThrow();
    expect(() => p.reopen()).toThrow();
    expect(FiscalPeriod.openYear.length).toBeGreaterThan(0);
  });
});
