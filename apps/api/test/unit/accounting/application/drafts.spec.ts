import { describe, expect, it } from 'vitest';
import { DiscardJournalDraft, ListJournalDrafts, SaveJournalDraft } from '../../../../src/modules/accounting/application/use-cases/journal-drafts.js';
import { Forbidden } from '../../../../src/shared-kernel/index.js';
import { makeUnit, ZodError, type Unit } from '../../../support/compose-unit.js';

const deps = (u: Unit) => ({ uow: u.uow, permissions: u.permissions, requestContext: u.requestContext, clock: u.clock, ids: u.ids, voucherTypes: u.voucherTypes, drafts: u.drafts });
const mk = (u: Unit) => ({
  save: new SaveJournalDraft(deps(u)),
  discard: new DiscardJournalDraft({ uow: u.uow, permissions: u.permissions, drafts: u.drafts }),
  list: new ListJournalDrafts({ uow: u.uow, permissions: u.permissions, periods: u.periods, drafts: u.drafts }),
});
const body = (over: Record<string, unknown> = {}) => ({ voucherType: 'AJ', accountingDate: '2026-10-20', description: 'Borrador', lines: [{ accountCode: '1105', debit: '100' }], ...over });

describe('Borradores (R-CON-011)', () => {
  it('guarda un borrador descuadrado sin consumir consecutivo ni crear comprobante', async () => {
    const u = makeUnit();
    const d = await mk(u).save.execute(body());
    expect(d.version).toBe(1);
    expect(d.lines).toHaveLength(1);
    expect(u.db.entries.size).toBe(0);
    expect(u.db.sequences.size).toBe(0);
  });

  it('reemplaza con bloqueo optimista por versión', async () => {
    const u = makeUnit();
    const { save } = mk(u);
    const d = await save.execute(body());
    const v2 = await save.execute(body({ description: 'Cambio', version: 1 }), { draftId: d.id });
    expect([v2.version, v2.description]).toEqual([2, 'Cambio']);
    await expect(save.execute(body({ version: 1 }), { draftId: d.id })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(save.execute(body(), { draftId: d.id })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(save.execute(body({ version: 1 }), { draftId: '0195f3a0-0000-7000-8000-0000000000aa' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('el único borrado permitido es el de un borrador', async () => {
    const u = makeUnit();
    const { save, discard } = mk(u);
    const d = await save.execute(body());
    await discard.execute(d.id);
    expect(u.db.drafts.size).toBe(0);
    await expect(discard.execute(d.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('lista por período', async () => {
    const u = makeUnit();
    const { save, list } = mk(u);
    await save.execute(body());
    await save.execute(body({ accountingDate: '2026-11-05' }));
    const oct = u.db.periods.find((p) => p.month === 10)!;
    const page = await list.execute({ periodId: oct.id });
    expect(page.items).toHaveLength(1);
  });

  it('valida el tipo de comprobante, el esquema y el permiso', async () => {
    const u = makeUnit();
    await expect(mk(u).save.execute(body({ voucherType: 'ZZ' }))).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(mk(u).save.execute(body({ extra: 1 }))).rejects.toThrow(ZodError);
    await expect(mk(makeUnit([])).save.execute(body())).rejects.toThrow(Forbidden);
  });
});
