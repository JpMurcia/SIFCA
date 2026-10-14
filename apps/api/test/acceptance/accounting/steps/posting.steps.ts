import { randomUUID } from 'node:crypto';
import { Given, Then, When, type DataTable } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { Instant, Money, Percentage } from '../../../../src/shared-kernel/index.js';
import type { SifcaWorld } from '../../support/world.js';

type Posted = { entry: import('../../../../src/modules/accounting/domain/entities/journal-entry.js').JournalEntry; created: boolean };

const peekNext = async (w: SifcaWorld, type: string): Promise<number> => {
  const types = await w.unit.uc.listVoucherTypes.execute();
  return types.find((t) => t.type.code === type)!.nextNumber;
};

const bodyOf = (type: string, lines: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) => ({
  voucherType: type, accountingDate: '2026-10-14', description: 'Escenario de aceptación', lines, ...extra,
});

const post = (w: SifcaWorld) => w.attempt(() => w.unit.uc.postJournalEntry.execute(w.body));
const nz = (v: string | undefined) => (v && v.trim() !== '' && v.trim() !== '0' ? v.trim() : undefined);

// Nota: las expresiones regulares con \d+ se convierten a number; se usa [0-9]+ para recibir cadenas (Money no acepta number).
// ── [001-01] ───────────────────────────────────────────────────────────────
Given('un comprobante de tipo {string} con las siguientes líneas:', async function (this: SifcaWorld, type: string, table: DataTable) {
  const lines = table.hashes().map((r) => ({
    accountCode: r['cuenta']!, ...(r['tercero'] ? { partyId: randomUUID() } : {}),
    ...(nz(r['débito']) ? { debit: `${r['débito']}.00`.replace(/\.\d+\.00$/, (m) => m.slice(0, -3)) } : {}),
    ...(nz(r['crédito']) ? { credit: `${r['crédito']}.00`.replace(/\.\d+\.00$/, (m) => m.slice(0, -3)) } : {}),
  }));
  this.body = bodyOf(type, lines);
  this.ctx['type'] = type;
  this.ctx['nextBefore'] = await peekNext(this, type);
});

When('el contador lo contabiliza', async function (this: SifcaWorld) {
  await post(this);
  assert.equal(this.error, undefined, `no debía fallar: ${String(this.error)}`);
});

When('el contador intenta contabilizarlo', async function (this: SifcaWorld) {
  await post(this);
});

Then(/^el comprobante queda guardado con el número ([0-9]+)$/, async function (this: SifcaWorld, n: string) {
  const { entry } = this.result as Posted;
  assert.equal(entry.number.value, Number(n));
  const stored = await this.unit.uc.getJournalEntry.execute(entry.id);
  assert.equal(stored.number.value, Number(n));
  assert.equal(stored.status, 'POSTED');
});

Then(/^la suma de débitos es ([0-9]+) y la suma de créditos es ([0-9]+)$/, async function (this: SifcaWorld, d: string, c: string) {
  const { entry } = this.result as Posted;
  const stored = await this.unit.uc.getJournalEntry.execute(entry.id);
  assert.equal(stored.totalDebit.toString(), Money.of(d).toString());
  assert.equal(stored.totalCredit.toString(), Money.of(c).toString());
  assert.equal(Money.sum(stored.lines.map((l) => l.debit)).toString(), Money.of(d).toString());
  assert.equal(Money.sum(stored.lines.map((l) => l.credit)).toString(), Money.of(c).toString());
});

// ── [001-02] ───────────────────────────────────────────────────────────────
Given(/^un comprobante de tipo "([^"]*)" con un débito de ([\d.]+) y un crédito de ([\d.]+)$/, async function (this: SifcaWorld, type: string, d: string, c: string) {
  this.body = bodyOf(type, [{ accountCode: '1105', debit: d }, { accountCode: '4135', credit: c }]);
  this.ctx['type'] = type;
  this.ctx['nextBefore'] = await peekNext(this, type);
});

Then('se rechaza con el código {string}', function (this: SifcaWorld, code: string) {
  assert.ok(this.error, 'se esperaba un rechazo');
  assert.equal(this.errorCode, code);
});

Then('el siguiente consecutivo del tipo {string} sigue siendo el mismo', async function (this: SifcaWorld, type: string) {
  assert.equal(await peekNext(this, type), this.ctx['nextBefore']);
  // y no quedó ningún comprobante
  const page = await this.unit.uc.listJournalEntries.execute({ voucherType: type });
  assert.equal(page.items.length, 0);
});

// ── [001-03] ───────────────────────────────────────────────────────────────
Given(/^un comprobante con una línea de débito (-?[\d.]+) y crédito (-?[\d.]+)$/, function (this: SifcaWorld, d: string, c: string) {
  this.body = bodyOf('AJ', [{ accountCode: '1105', debit: d, credit: c }, { accountCode: '4135', credit: '100' }]);
});

// ── [001-04] ───────────────────────────────────────────────────────────────
Given(/^un comprobante con una línea en la cuenta "([0-9]+)" de nivel grupo$/, function (this: SifcaWorld, code: string) {
  this.body = bodyOf('AJ', [{ accountCode: code, debit: '100' }, { accountCode: '4135', credit: '100' }]);
});

// ── [001-05] ───────────────────────────────────────────────────────────────
Given('que el período de septiembre de 2026 está cerrado', async function (this: SifcaWorld) {
  await this.db.withTenant(this.unit.tenantId, (c) => c.query(`UPDATE acc.fiscal_period SET status = 'CLOSED', closed_at = now() WHERE year = 2026 AND month = 9`), this.db.owner);
});

Given(/^un comprobante cuadrado con fecha contable (\d{4}-\d{2}-\d{2})$/, function (this: SifcaWorld, date: string) {
  this.body = bodyOf('AJ', [{ accountCode: '1105', debit: '100' }, { accountCode: '4135', credit: '100' }], { accountingDate: date });
});

// ── [001-09] ───────────────────────────────────────────────────────────────
Given(/^que la cuenta "([0-9]+)" exige tercero$/, async function (this: SifcaWorld, code: string) {
  const r = await this.db.withTenant(this.unit.tenantId, (c) => c.query('SELECT requires_party FROM acc.account WHERE code = $1', [code]));
  assert.equal(r.rows[0]?.requires_party, true, `la cuenta ${code} debe exigir tercero en el plan de pruebas`);
});

Given(/^un comprobante cuadrado con una línea en "([0-9]+)" sin tercero$/, function (this: SifcaWorld, code: string) {
  this.body = bodyOf('AJ', [{ accountCode: code, debit: '100' }, { accountCode: '4135', credit: '100' }]);
});

// ── [001-10] · R-CON-009: redondeo por línea ───────────────────────────────
Given(/^una factura con ([0-9]+) líneas de ([\d.]+) y un IVA del ([0-9]+) ?%$/, function (this: SifcaWorld, n: string, base: string, rate: string) {
  this.ctx['bases'] = Array.from({ length: Number(n) }, () => Money.of(base));
  this.ctx['rate'] = Percentage.of(rate);
});

When('se calculan los impuestos', function (this: SifcaWorld) {
  const bases = this.ctx['bases'] as Money[];
  this.ctx['ivaPorLinea'] = bases.map((b) => b.percentOf(this.ctx['rate'] as Percentage));
});

Then(/^el IVA de cada línea es ([\d.]+)$/, function (this: SifcaWorld, expected: string) {
  for (const iva of this.ctx['ivaPorLinea'] as Money[]) assert.equal(iva.toString(), Money.of(expected).toString());
});

Then(/^el IVA del documento es ([\d.]+) y no ([\d.]+)$/, function (this: SifcaWorld, expected: string, wrong: string) {
  const total = Money.sum(this.ctx['ivaPorLinea'] as Money[]);
  assert.equal(total.toString(), Money.of(expected).toString());
  assert.notEqual(total.toString(), Money.of(wrong).toString());
  // el total NO se recalcula desde la base total (R-CON-009.3)
  const fromTotalBase = Money.sum(this.ctx['bases'] as Money[]).percentOf(this.ctx['rate'] as Percentage);
  assert.notEqual(fromTotalBase.toString(), total.toString());
});

// ── [001-13] · R-CON-014 ───────────────────────────────────────────────────
Given('un documento emitido a las 23:30 hora de Colombia del 31 de octubre de 2026', function (this: SifcaWorld) {
  const occurredAt = Instant.fromISO('2026-10-31T23:30:00-05:00').toISOString();
  this.body = { voucherType: 'FV', occurredAt, description: 'Documento de fin de mes', lines: [{ accountCode: '1105', debit: '100' }, { accountCode: '4135', credit: '100' }] };
});

When('se contabiliza', async function (this: SifcaWorld) {
  await post(this);
  assert.equal(this.error, undefined, `no debía fallar: ${String(this.error)}`);
});

Then('la fecha contable es 2026-10-31 y pertenece al período de octubre', async function (this: SifcaWorld) {
  const { entry } = this.result as Posted;
  assert.equal(entry.accountingDate.toString(), '2026-10-31');
  const r = await this.db.withTenant(this.unit.tenantId, (c) => c.query('SELECT year, month FROM acc.fiscal_period WHERE id = $1', [entry.periodId]));
  assert.deepEqual([r.rows[0].year, r.rows[0].month], [2026, 10]);
});
