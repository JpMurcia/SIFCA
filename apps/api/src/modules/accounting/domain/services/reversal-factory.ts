import { type LocalDate } from '../../../../shared-kernel/index.js';
import type { Account } from '../entities/account.js';
import type { CostCenter } from '../entities/cost-center.js';
import { JournalEntry, type LineInput, type PendingEntry } from '../entities/journal-entry.js';
import type { VoucherType } from '../entities/voucher-type.js';
import { ValidationFailed } from '../errors/accounting-errors.js';
import { EntrySource } from '../value-objects/entry-source.js';

export interface ReversalInput {
  readonly original: JournalEntry;
  readonly voucherType: VoucherType;
  /** Cuentas del original por código (ya resueltas por la aplicación). */
  readonly accounts: ReadonlyMap<string, Account>;
  readonly costCenters: ReadonlyMap<string, CostCenter>;
  readonly accountingDate: LocalDate;
  readonly reason: string;
}

const MAX_DESCRIPTION = 500;

/**
 * Construye el contraasiento (R-CON-005): mismas cuentas, lados invertidos, mismo tercero, centro de costo,
 * referencia y vencimiento, con referencia al original. Pasa por las mismas reglas que cualquier comprobante
 * (`JournalEntry.prepare`), por lo que una cuenta que ya no admita movimientos se rechaza con VALIDATION_FAILED.
 */
export const ReversalFactory = {
  build(i: ReversalInput): PendingEntry {
    const lines: LineInput[] = i.original.lines.map((l, idx) => {
      const account = i.accounts.get(l.accountCode);
      if (!account) {
        throw new ValidationFailed([{ field: `lines[${idx}].accountCode`, message: `La cuenta ${l.accountCode} del original ya no existe`, rule: 'R-CON-003' }]);
      }
      return {
        account,
        partyId: l.partyId,
        costCenter: l.costCenterCode ? (i.costCenters.get(l.costCenterCode) ?? null) : null,
        debit: l.credit,
        credit: l.debit,
        description: l.description,
        documentRef: l.documentRef,
        dueDate: l.dueDate,
      };
    });
    const head = `Reversión de ${i.original.voucherTypeCode}-${i.original.number.value}: `;
    return JournalEntry.prepare({
      voucherType: i.voucherType,
      accountingDate: i.accountingDate,
      description: (head + i.reason).slice(0, MAX_DESCRIPTION),
      source: EntrySource.of('REVERSAL', i.original.id),
      lines,
      reversalOf: { id: i.original.id, reason: i.reason },
    });
  },
};
