import { v7 as uuidv7 } from 'uuid';

/**
 * Plan de cuentas de PRUEBA (research §15). Los escenarios usan cuentas de 4 dígitos como cuentas de movimiento;
 * NO es el PUC que se sembrará en producción (ese lo revisa un contador).
 */
export interface TestAccount {
  code: string; name: string; level: number; nature: 'DEBIT' | 'CREDIT';
  allowsPosting: boolean; requiresParty?: boolean; requiresCostCenter?: boolean; isActive?: boolean;
}

export const TEST_CHART: readonly TestAccount[] = [
  { code: '1', name: 'Activo', level: 1, nature: 'DEBIT', allowsPosting: false },
  { code: '13', name: 'Deudores', level: 2, nature: 'DEBIT', allowsPosting: false },
  { code: '1105', name: 'Caja', level: 4, nature: 'DEBIT', allowsPosting: true },
  { code: '1110', name: 'Bancos', level: 4, nature: 'DEBIT', allowsPosting: true },
  { code: '130505', name: 'Clientes nacionales', level: 6, nature: 'DEBIT', allowsPosting: true, requiresParty: true },
  { code: '1435', name: 'Mercancías no fabricadas por la empresa', level: 4, nature: 'DEBIT', allowsPosting: true },
  { code: '1199', name: 'Cuenta inactiva de prueba', level: 4, nature: 'DEBIT', allowsPosting: true, isActive: false },
  { code: '2408', name: 'Impuesto sobre las ventas por pagar', level: 4, nature: 'CREDIT', allowsPosting: true },
  { code: '3115', name: 'Aportes sociales', level: 4, nature: 'CREDIT', allowsPosting: true },
  { code: '4135', name: 'Comercio al por mayor y al por menor', level: 4, nature: 'CREDIT', allowsPosting: true },
  { code: '4175', name: 'Devoluciones en ventas', level: 4, nature: 'DEBIT', allowsPosting: true },
  { code: '5105', name: 'Gastos de personal', level: 4, nature: 'DEBIT', allowsPosting: true, requiresCostCenter: true },
  { code: '5905', name: 'Ganancias y pérdidas', level: 4, nature: 'CREDIT', allowsPosting: true },
  { code: '3605', name: 'Utilidad del ejercicio', level: 4, nature: 'CREDIT', allowsPosting: true },
  { code: '6135', name: 'Costo de ventas', level: 4, nature: 'DEBIT', allowsPosting: true },
];

export const TEST_VOUCHER_TYPES = [
  { code: 'AJ', name: 'Ajuste', scope: 'TENANT' },
  { code: 'FV', name: 'Factura de venta', scope: 'TENANT' },
  { code: 'NC', name: 'Nota crédito', scope: 'TENANT' },
  { code: 'RC', name: 'Recibo de caja', scope: 'TENANT' },
  { code: 'CE', name: 'Comprobante de egreso', scope: 'YEAR' },
  { code: 'CI', name: 'Cierre anual', scope: 'YEAR' },
] as const;

export const TEST_COST_CENTER = { code: 'ADM', name: 'Administración' } as const;

interface Queryable {
  query(sql: string, params?: unknown[]): Promise<unknown>;
}

/** Inserta plan de cuentas, tipos de comprobante y centro de costo (dentro de una transacción con el tenant fijado). */
export async function seedTestChart(c: Queryable, tenantId: string): Promise<void> {
  for (const a of TEST_CHART) {
    await c.query(
      `INSERT INTO acc.account (id, tenant_id, code, name, level, nature, allows_posting, requires_party, requires_cost_center, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [uuidv7(), tenantId, a.code, a.name, a.level, a.nature, a.allowsPosting, a.requiresParty ?? false, a.requiresCostCenter ?? false, a.isActive ?? true],
    );
  }
  for (const v of TEST_VOUCHER_TYPES) {
    await c.query(`INSERT INTO acc.voucher_type (id, tenant_id, code, name, numbering_scope) VALUES ($1,$2,$3,$4,$5)`, [uuidv7(), tenantId, v.code, v.name, v.scope]);
  }
  await c.query(`INSERT INTO acc.cost_center (id, tenant_id, code, name) VALUES ($1,$2,$3,$4)`, [uuidv7(), tenantId, TEST_COST_CENTER.code, TEST_COST_CENTER.name]);
}

/** Inserta los 12 períodos mensuales (abiertos) de un año. */
export async function seedFiscalYear(c: Queryable, tenantId: string, year: number): Promise<void> {
  for (let m = 1; m <= 12; m++) {
    const start = `${year}-${String(m).padStart(2, '0')}-01`;
    const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
    const end = `${year}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    await c.query(`INSERT INTO acc.fiscal_period (id, tenant_id, year, month, starts_on, ends_on) VALUES ($1,$2,$3,$4,$5,$6)`, [uuidv7(), tenantId, year, m, start, end]);
  }
}
