import { Given, Then, When, type DataTable } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ALL_PERMISSIONS } from '../../../support/compose-pg.js';
import { postReferenceLedger } from '../../../support/reference-ledger.js';
import type { SifcaWorld } from '../../support/world.js';

type Entry = import('../../../../src/modules/accounting/domain/entities/journal-entry.js').JournalEntry;
const MONTHS: Record<string, number> = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const sha = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const period = async (w: SifcaWorld, month: string, year: string) => (await w.unit.uc.listPeriods.execute({ year: Number(year) })).find((p) => p.month === MONTHS[month])!;

// ── Libro de referencia (compartido por [001-11], [001-15], [001-16]) ──────
Given('los comprobantes de referencia de venta, nota crédito y recibo del catálogo de reglas', async function (this: SifcaWorld) {
  await postReferenceLedger((b) => this.unit.uc.postJournalEntry.execute(b));
});

// ── [001-11] ───────────────────────────────────────────────────────────────
When('se consulta el balance de prueba a fin de octubre', async function (this: SifcaWorld) {
  await this.attempt(() => this.unit.uc.getTrialBalance.execute({ from: '2026-10-01', to: '2026-10-31' }));
  assert.equal(this.error, undefined, String(this.error));
});

type TB = Awaited<ReturnType<SifcaWorld['unit']['uc']['getTrialBalance']['execute']>>;

Then('los saldos por cuenta son:', function (this: SifcaWorld, table: DataTable) {
  const tb = this.result as TB;
  const money = (v: string) => `${v}.00`;
  const expected = table.hashes().map((r) => [r['cuenta']!, money(r['débito']!), money(r['crédito']!)]);
  const actual = tb.rows.filter((r) => !r.closingDebit.isZero() || !r.closingCredit.isZero()).map((r) => [r.accountCode, r.closingDebit.toString(), r.closingCredit.toString()]);
  assert.deepEqual(actual, expected);
});

Then(/^los totales son ([0-9]+) en débito y ([0-9]+) en crédito$/, function (this: SifcaWorld, d: string, c: string) {
  const tb = this.result as TB;
  assert.equal(tb.totals.closingDebit.toString(), `${d}.00`);
  assert.equal(tb.totals.closingCredit.toString(), `${c}.00`);
  assert.equal(tb.balanced, true);
});

// ── [001-12] ───────────────────────────────────────────────────────────────
Given('un período con un comprobante en borrador', async function (this: SifcaWorld) {
  this.ctx['draft'] = await this.unit.uc.saveJournalDraft.execute({ voucherType: 'AJ', accountingDate: '2026-10-20', description: 'Borrador', lines: [{ accountCode: '1105', debit: '100' }] });
  this.ctx['period'] = await period(this, 'octubre', '2026');
});

When('el contador intenta cerrar el período', async function (this: SifcaWorld) {
  await this.attempt(() => this.unit.uc.closePeriod.execute((this.ctx['period'] as { id: string }).id));
});

Then('se rechaza el cierre', function (this: SifcaWorld) {
  assert.equal(this.errorCode, 'PERIOD_CLOSE_BLOCKED');
  const violations = (this.error as { violations: Array<{ message: string }> }).violations;
  assert.match(violations[0]!.message, /borrador/);
});

When('se elimina el borrador y el balance de prueba cuadra', async function (this: SifcaWorld) {
  await this.unit.uc.discardJournalDraft.execute((this.ctx['draft'] as { id: string }).id);
  await this.unit.uc.postJournalEntry.execute({ voucherType: 'AJ', accountingDate: '2026-10-21', description: 'Comprobante cuadrado', lines: [{ accountCode: '1105', debit: '100' }, { accountCode: '4135', credit: '100' }] });
  const tb = await this.unit.uc.getTrialBalance.execute({ from: '2026-10-01', to: '2026-10-31' });
  assert.equal(tb.balanced, true);
});

// En el Gherkin, «el cierre se realiza» es el efecto esperado tras corregir las causas: este paso lo ejecuta y lo verifica.
Then('el cierre se realiza y queda en la bitácora', async function (this: SifcaWorld) {
  const p = this.ctx['period'] as { id: string };
  const closed = await this.unit.uc.closePeriod.execute(p.id);
  assert.equal(closed.status, 'CLOSED');
  const log = await this.db.withTenant(this.unit.tenantId, async (c) => (await c.query(`SELECT action, actor_id FROM audit.audit_log WHERE entity_id = $1`, [p.id])).rows);
  assert.deepEqual(log.map((r) => r.action), ['accounting.period.closed']);
  assert.equal(log[0].actor_id, this.unit.userId);
});

// ── [001-14] ───────────────────────────────────────────────────────────────
When(/^un usuario sin el permiso "([^"]*)" intenta reabrir el período de ([a-zñ]+) de ([0-9]{4})$/, async function (this: SifcaWorld, perm: string, month: string, year: string) {
  this.unit.setPermissions(ALL_PERMISSIONS.filter((p) => p !== perm));
  const p = await period(this, month, year);
  await this.attempt(() => this.unit.uc.reopenPeriod.execute(p.id, { reason: 'Corrección de una factura omitida' }));
});

When(/^el contador intenta reabrir el período de ([a-zñ]+) de ([0-9]{4}) sin indicar el motivo$/, async function (this: SifcaWorld, month: string, year: string) {
  this.unit.setPermissions(ALL_PERMISSIONS);
  const p = await period(this, month, year);
  await this.attempt(() => this.unit.uc.reopenPeriod.execute(p.id, {}));
});

When(/^el contador reabre el período de ([a-zñ]+) de ([0-9]{4}) con el motivo "([^"]*)"$/, async function (this: SifcaWorld, month: string, year: string, reason: string) {
  const p = await period(this, month, year);
  this.ctx['reason'] = reason;
  this.ctx['reopenedId'] = p.id;
  await this.attempt(() => this.unit.uc.reopenPeriod.execute(p.id, { reason }));
  assert.equal(this.error, undefined, String(this.error));
});

Then(/^el período de ([a-zñ]+) de ([0-9]{4}) queda abierto$/, async function (this: SifcaWorld, month: string, year: string) {
  assert.equal((await period(this, month, year)).status, 'OPEN');
});

Then('la bitácora registra la reapertura con el motivo y el usuario', async function (this: SifcaWorld) {
  const rows = await this.db.withTenant(this.unit.tenantId, async (c) =>
    (await c.query(`SELECT reason, actor_id FROM audit.audit_log WHERE action = 'accounting.period.reopened' AND entity_id = $1`, [this.ctx['reopenedId']])).rows,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].reason, this.ctx['reason']);
  assert.equal(rows[0].actor_id, this.unit.userId);
});

// ── [001-15] ───────────────────────────────────────────────────────────────
When(/^el contador hace el cierre anual de ([0-9]{4}) trasladando el resultado a "([0-9]+)" a través de "([0-9]+)"$/, async function (this: SifcaWorld, year: string, result: string, pnl: string) {
  const ids = await this.db.withTenant(this.unit.tenantId, async (c) => Object.fromEntries((await c.query(`SELECT code, id FROM acc.account WHERE code = ANY($1)`, [[result, pnl]])).rows.map((r) => [r.code, r.id])));
  await this.attempt(() => this.unit.uc.closeFiscalYear.execute(Number(year), { profitAndLossAccountId: ids[pnl], yearResultAccountId: ids[result], accountingDate: `${year}-12-31`, voucherType: 'CI' }));
  assert.equal(this.error, undefined, String(this.error));
  this.ctx['closing'] = (this.result as { entry: Entry }).entry;
});

const yearEnd = (w: SifcaWorld) => w.unit.uc.getTrialBalance.execute({ from: '2026-01-01', to: '2026-12-31' });

Then(/^las cuentas de resultado "([0-9]+)", "([0-9]+)" y "([0-9]+)" quedan en cero$/, async function (this: SifcaWorld, a: string, b: string, c: string) {
  const tb = await yearEnd(this);
  for (const code of [a, b, c]) {
    const row = tb.rows.find((r) => r.accountCode === code)!;
    assert.ok(row.closingDebit.isZero() && row.closingCredit.isZero(), `la cuenta ${code} debía quedar en cero`);
  }
});

Then(/^la cuenta "([0-9]+)" muestra un saldo crédito de ([0-9]+)$/, async function (this: SifcaWorld, code: string, amount: string) {
  const row = (await yearEnd(this)).rows.find((r) => r.accountCode === code)!;
  assert.equal(row.closingCredit.toString(), `${amount}.00`);
  assert.ok(row.closingDebit.isZero());
});

When('el contador reversa el comprobante de cierre', async function (this: SifcaWorld) {
  const closing = this.ctx['closing'] as Entry;
  await this.attempt(() => this.unit.uc.reverseJournalEntry.execute(closing.id, { reason: 'Reabrir el ejercicio', accountingDate: '2026-12-31' }));
  assert.equal(this.error, undefined, String(this.error));
});

Then(/^las cuentas de resultado recuperan sus saldos de ([0-9]+), ([0-9]+) y ([0-9]+)$/, async function (this: SifcaWorld, ingresos: string, devoluciones: string, costo: string) {
  const by = Object.fromEntries((await yearEnd(this)).rows.map((r) => [r.accountCode, r]));
  assert.equal(by['4135']!.closingCredit.toString(), `${ingresos}.00`);
  assert.equal(by['4175']!.closingDebit.toString(), `${devoluciones}.00`);
  assert.equal(by['6135']!.closingDebit.toString(), `${costo}.00`);
});

// ── [001-16] ───────────────────────────────────────────────────────────────
When('se consulta dos veces el balance de prueba y el libro diario de octubre de 2026', async function (this: SifcaWorld) {
  const range = { from: '2026-10-01', to: '2026-10-31' };
  const tb = async () => (await this.unit.uc.getTrialBalance.execute(range)).rows;
  const book = async () => (await this.unit.uc.getJournalBook.execute({ ...range, limit: 100 })).items;
  this.ctx['runs'] = [[sha(await tb()), sha(await tb())], [sha(await book()), sha(await book())]];
});

Then('ambas consultas del mismo informe devuelven exactamente el mismo resultado', function (this: SifcaWorld) {
  for (const [a, b] of this.ctx['runs'] as Array<[string, string]>) assert.equal(a, b);
});
