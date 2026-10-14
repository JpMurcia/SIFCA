import { describe, expect, it } from 'vitest';
import { PostJournalEntry } from '../../../../src/modules/accounting/application/use-cases/post-journal-entry.js';
import { ReverseJournalEntry } from '../../../../src/modules/accounting/application/use-cases/reverse-journal-entry.js';
import { AlreadyReversed, PeriodClosed } from '../../../../src/modules/accounting/domain/errors/accounting-errors.js';
import { Forbidden, Money } from '../../../../src/shared-kernel/index.js';
import { makeUnit, ZodError, type Unit } from '../../../support/compose-unit.js';

const deps = (u: Unit) => ({
  uow: u.uow, permissions: u.permissions, requestContext: u.requestContext, clock: u.clock, ids: u.ids, accounts: u.accounts,
  costCenters: u.costCenters, voucherTypes: u.voucherTypes, periods: u.periods, entries: u.entries, sequence: u.sequence, events: u.publisher,
});
const mk = (u: Unit) => ({ post: new PostJournalEntry(deps(u)), reverse: new ReverseJournalEntry(deps(u)) });
const body = (over: Record<string, unknown> = {}) => ({
  voucherType: 'AJ', accountingDate: '2026-10-14', description: 'Venta',
  lines: [{ accountCode: '1105', debit: '100000.00' }, { accountCode: '4135', credit: '100000.00' }], ...over,
});

describe('ReverseJournalEntry', () => {
  it('crea una reversión que referencia al original y neutraliza cada cuenta [001-07]', async () => {
    const u = makeUnit();
    const { post, reverse } = mk(u);
    const { entry: original } = await post.execute(body());
    const { entry: rev } = await reverse.execute(original.id, { reason: 'Error de digitación' });
    expect(rev.reversalOf).toBe(original.id);
    expect(rev.source.type).toBe('REVERSAL');
    expect(rev.number.value).toBe(2);
    expect(rev.accountingDate.toString()).toBe('2026-10-14'); // por defecto, hoy en hora de Colombia
    const net = new Map<string, Money>();
    for (const e of [original, rev]) for (const l of e.lines) net.set(l.accountCode, (net.get(l.accountCode) ?? Money.zero()).add(l.debit).subtract(l.credit));
    expect([...net.values()].every((m) => m.isZero())).toBe(true);
    expect(u.publisher.events.map((e) => e.name)).toContain('accounting.journal_entry.reversed.v1');
  });

  it('no permite reversar dos veces el mismo comprobante [001-07]', async () => {
    const u = makeUnit();
    const { post, reverse } = mk(u);
    const { entry } = await post.execute(body());
    await reverse.execute(entry.id, { reason: 'Primera vez' });
    await expect(reverse.execute(entry.id, { reason: 'Segunda vez' })).rejects.toThrow(AlreadyReversed);
    expect(u.db.entries.size).toBe(2);
  });

  it('reversar una reversión restituye el efecto original y es válido', async () => {
    const u = makeUnit();
    const { post, reverse } = mk(u);
    const { entry } = await post.execute(body());
    const { entry: r1 } = await reverse.execute(entry.id, { reason: 'Primera vez' });
    const { entry: r2 } = await reverse.execute(r1.id, { reason: 'Restituir el original' });
    expect(r2.reversalOf).toBe(r1.id);
    expect(r2.lines[0]!.debit.toString()).toBe('100000.00');
  });

  it('exige motivo de 5 a 500 caracteres', async () => {
    const u = makeUnit();
    const { post, reverse } = mk(u);
    const { entry } = await post.execute(body());
    await expect(reverse.execute(entry.id, { reason: 'x' })).rejects.toThrow(ZodError);
    await expect(reverse.execute(entry.id, {})).rejects.toThrow(ZodError);
  });

  it('la reversión debe caer en un período abierto', async () => {
    const u = makeUnit();
    const { post, reverse } = mk(u);
    const { entry } = await post.execute(body({ accountingDate: '2026-09-15' }));
    u.closePeriod(2026, 9);
    await expect(reverse.execute(entry.id, { reason: 'Corrección', accountingDate: '2026-09-30' })).rejects.toThrow(PeriodClosed);
    const ok = await reverse.execute(entry.id, { reason: 'Corrección', accountingDate: '2026-10-02' });
    expect(ok.entry.accountingDate.toString()).toBe('2026-10-02');
  });

  it('NOT_FOUND para un comprobante inexistente o un id inválido', async () => {
    const u = makeUnit();
    const { reverse } = mk(u);
    await expect(reverse.execute('0195f3a0-0000-7000-8000-0000000000ff', { reason: 'No existe' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(reverse.execute('no-uuid', { reason: 'No existe' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('exige el permiso accounting.entry.reverse', async () => {
    const u = makeUnit(['accounting.entry.post']);
    const { post, reverse } = mk(u);
    const { entry } = await post.execute(body());
    await expect(reverse.execute(entry.id, { reason: 'Sin permiso' })).rejects.toThrow(Forbidden);
  });

  it('una falla al reversar no deja rastro ni consume consecutivo', async () => {
    const u = makeUnit();
    const { post, reverse } = mk(u);
    const { entry } = await post.execute(body());
    u.entries.failAfterAdd = new Error('falla inyectada');
    await expect(reverse.execute(entry.id, { reason: 'Falla' })).rejects.toThrow('falla inyectada');
    u.entries.failAfterAdd = undefined;
    expect(u.db.entries.size).toBe(1);
    expect((await reverse.execute(entry.id, { reason: 'Reintento' })).entry.number.value).toBe(2);
  });
});
