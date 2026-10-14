import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { Money } from '../../../../src/shared-kernel/index.js';
import { entryBody } from '../../../support/compose-pg.js';
import { FAULT_STEPS, makeFailingPost } from '../../../support/fault-injection.js';
import type { SifcaWorld } from '../../support/world.js';

type Entry = import('../../../../src/modules/accounting/domain/entities/journal-entry.js').JournalEntry;

const mkBody = (d: string, c: string) => entryBody({ lines: [{ accountCode: '1105', debit: d }, { accountCode: '4135', credit: c }] });
const counts = (w: SifcaWorld) =>
  w.db.withTenant(w.unit.tenantId, async (c) => ({
    entries: Number((await c.query('SELECT count(*) AS n FROM acc.journal_entry')).rows[0].n),
    lines: Number((await c.query('SELECT count(*) AS n FROM acc.journal_line')).rows[0].n),
  }));

// ── [001-06] ───────────────────────────────────────────────────────────────
Given('un comprobante contabilizado', async function (this: SifcaWorld) {
  this.ctx['original'] = (await this.unit.uc.postJournalEntry.execute(entryBody())).entry;
});

When('se intenta modificar o eliminar el comprobante por la API', async function (this: SifcaWorld) {
  const api = await this.api();
  const id = (this.ctx['original'] as Entry).id;
  const results = [];
  for (const method of ['put', 'patch', 'delete'] as const) {
    const res = await api.http()[method](`/api/v1/accounting/journal-entries/${id}`).set(await api.auth()).send({ description: 'cambio' });
    results.push({ method, status: res.status, code: res.body.code });
  }
  this.ctx['apiResults'] = results;
});

Then('la operación se rechaza', function (this: SifcaWorld) {
  const results = this.ctx['apiResults'] as Array<{ method: string; status: number; code: string }>;
  assert.equal(results.length, 3);
  for (const r of results) assert.deepEqual([r.status, r.code], [405, 'ENTRY_IMMUTABLE'], `${r.method} debía responder 405 ENTRY_IMMUTABLE`);
});

When('se intenta modificar o eliminar el comprobante con el usuario de base de datos de la aplicación', async function (this: SifcaWorld) {
  const t = this.unit.tenantId;
  const attempts: Array<{ who: string; sql: string; message: string }> = [];
  const tryIt = async (who: 'app' | 'owner', sql: string) => {
    try {
      await this.db.withTenant(t, (c) => c.query(sql), who === 'app' ? this.db.app : this.db.owner);
      attempts.push({ who, sql, message: 'NO FALLÓ' });
    } catch (e) {
      attempts.push({ who, sql, message: (e as Error).message });
    }
  };
  for (const table of ['acc.journal_entry', 'acc.journal_line']) {
    for (const who of ['app', 'owner'] as const) {
      await tryIt(who, table.endsWith('entry') ? `UPDATE ${table} SET description = 'x'` : `UPDATE ${table} SET line_no = line_no + 10`);
      await tryIt(who, `DELETE FROM ${table}`);
    }
  }
  this.ctx['dbAttempts'] = attempts;
});

Then('la base de datos rechaza la operación por privilegios o por trigger', function (this: SifcaWorld) {
  const attempts = this.ctx['dbAttempts'] as Array<{ who: string; sql: string; message: string }>;
  assert.equal(attempts.length, 8);
  for (const a of attempts) {
    assert.match(a.message, a.who === 'app' ? /permission denied/ : /IMMUTABLE_RECORD/, `${a.who}: ${a.sql}`);
  }
});

// ── [001-07] ───────────────────────────────────────────────────────────────
Given(/^un comprobante contabilizado con un débito de ([0-9]+) en "([0-9]+)" y un crédito de ([0-9]+) en "([0-9]+)"$/, async function (this: SifcaWorld, d: string, da: string, c: string, ca: string) {
  const body = entryBody({ lines: [{ accountCode: da, debit: d }, { accountCode: ca, credit: c }] });
  this.ctx['original'] = (await this.unit.uc.postJournalEntry.execute(body)).entry;
});

When('el contador lo reversa', async function (this: SifcaWorld) {
  const original = this.ctx['original'] as Entry;
  await this.attempt(() => this.unit.uc.reverseJournalEntry.execute(original.id, { reason: 'Error de digitación' }));
  assert.equal(this.error, undefined, `no debía fallar: ${String(this.error)}`);
});

Then('existe un comprobante de reversión que referencia al original', async function (this: SifcaWorld) {
  const original = this.ctx['original'] as Entry;
  const { entry: reversal } = this.result as { entry: Entry };
  const stored = await this.unit.uc.getJournalEntry.execute(reversal.id);
  assert.equal(stored.reversalOf, original.id);
  assert.equal(stored.source.type, 'REVERSAL');
  assert.equal((await this.unit.uc.getJournalEntry.execute(original.id)).reversedBy, reversal.id);
});

Then('el efecto neto de ambos sobre cada cuenta es cero', async function (this: SifcaWorld) {
  const original = await this.unit.uc.getJournalEntry.execute((this.ctx['original'] as Entry).id);
  const { entry } = this.result as { entry: Entry };
  const reversal = await this.unit.uc.getJournalEntry.execute(entry.id);
  const net = new Map<string, Money>();
  for (const e of [original, reversal]) for (const l of e.lines) net.set(l.accountCode, (net.get(l.accountCode) ?? Money.zero()).add(l.debit).subtract(l.credit));
  assert.ok(net.size > 0);
  for (const [code, m] of net) assert.ok(m.isZero(), `la cuenta ${code} quedó con ${m}`);
});

Then('no es posible reversar dos veces el mismo comprobante', async function (this: SifcaWorld) {
  const original = this.ctx['original'] as Entry;
  await this.attempt(() => this.unit.uc.reverseJournalEntry.execute(original.id, { reason: 'Otra vez' }));
  assert.equal(this.errorCode, 'ALREADY_REVERSED');
});

// ── [001-08] ───────────────────────────────────────────────────────────────
Given(/^que el siguiente consecutivo del tipo "([A-Z]+)" es ([0-9]+)$/, async function (this: SifcaWorld, type: string, next: string) {
  for (let i = 1; i < Number(next); i++) await this.unit.uc.postJournalEntry.execute(entryEntry(type));
  this.ctx['before'] = await counts(this);
  const types = await this.unit.uc.listVoucherTypes.execute();
  assert.equal(types.find((t) => t.type.code === type)!.nextNumber, Number(next));
});
const entryEntry = (type: string) => ({ ...mkBody('100', '100'), voucherType: type });

When('falla la contabilización de un comprobante por un error inyectado en el último paso', async function (this: SifcaWorld) {
  // «último paso» = justo antes del commit; además se ejercitan los pasos intermedios (G-04, INV-15).
  for (const step of [...FAULT_STEPS].reverse()) {
    await this.attempt(() => makeFailingPost(this.unit, step).execute(entryEntry('AJ')));
    assert.match(String((this.error as Error)?.message), /falla inyectada/, `el paso ${step} debía fallar`);
  }
});

Then('no queda ninguna línea ni ningún encabezado del comprobante', async function (this: SifcaWorld) {
  assert.deepEqual(await counts(this), this.ctx['before']);
});

Then(/^el siguiente consecutivo del tipo "([A-Z]+)" sigue siendo ([0-9]+)$/, async function (this: SifcaWorld, type: string, n: string) {
  const types = await this.unit.uc.listVoucherTypes.execute();
  assert.equal(types.find((t) => t.type.code === type)!.nextNumber, Number(n));
});
