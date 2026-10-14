/**
 * Libro de referencia (docs/02-normativa-y-reglas/01-contabilidad-partida-doble-y-puc.md §4–§5): apertura de inventario,
 * factura de venta a crédito (P-01), nota crédito por devolución parcial (P-02) y recibo de caja (P-03).
 * Debe producir el balance de [001-11]: 2.152.000 en débito y en crédito.
 */
export const CLIENT_PARTY_ID = '0195f3a0-0000-7000-8000-00000000c11e';

type Body = Record<string, unknown>;
const e = (voucherType: string, accountingDate: string, description: string, lines: Array<[string, 'D' | 'C', string]>): Body => ({
  voucherType, accountingDate, description,
  lines: lines.map(([accountCode, side, amount]) => ({
    accountCode, ...(accountCode === '130505' ? { partyId: CLIENT_PARTY_ID } : {}), ...(side === 'D' ? { debit: amount } : { credit: amount }),
  })),
});

export const REFERENCE_ENTRIES: readonly Body[] = [
  e('AJ', '2026-10-01', 'Apertura de inventario aportado como capital', [['1435', 'D', '1000000.00'], ['3115', 'C', '1000000.00']]),
  e('FV', '2026-10-05', 'P-01 Factura de venta a crédito con IVA', [['130505', 'D', '1190000.00'], ['4135', 'C', '1000000.00'], ['2408', 'C', '190000.00']]),
  e('FV', '2026-10-05', 'P-01 Costo de ventas', [['6135', 'D', '600000.00'], ['1435', 'C', '600000.00']]),
  e('NC', '2026-10-10', 'P-02 Nota crédito por devolución parcial', [['4175', 'D', '200000.00'], ['2408', 'D', '38000.00'], ['130505', 'C', '238000.00']]),
  e('NC', '2026-10-10', 'P-02 Reingreso al costo de salida', [['1435', 'D', '120000.00'], ['6135', 'C', '120000.00']]),
  e('RC', '2026-10-20', 'P-03 Recibo de caja', [['1110', 'D', '952000.00'], ['130505', 'C', '952000.00']]),
];

export async function postReferenceLedger(post: (body: Body) => Promise<unknown>): Promise<void> {
  for (const body of REFERENCE_ENTRIES) await post(body);
}

/** Saldos finales esperados de [001-11] (cuenta → [débito, crédito]). */
export const EXPECTED_TRIAL_BALANCE: ReadonlyArray<readonly [string, string, string]> = [
  ['1110', '952000.00', '0.00'], ['1435', '520000.00', '0.00'], ['2408', '0.00', '152000.00'],
  ['3115', '0.00', '1000000.00'], ['4135', '0.00', '1000000.00'], ['4175', '200000.00', '0.00'], ['6135', '480000.00', '0.00'],
];
