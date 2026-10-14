import { Money, type EntryId, type Instant, type LocalDate, type PartyId, type PeriodId, type UserId, type Violation } from '../../../../shared-kernel/index.js';
import { EntryNotBalanced, ValidationFailed } from '../errors/accounting-errors.js';
import type { EntryNumber } from '../value-objects/entry-number.js';
import type { EntrySource } from '../value-objects/entry-source.js';
import type { Account } from './account.js';
import type { CostCenter } from './cost-center.js';
import { JournalLine } from './journal-line.js';
import type { VoucherType } from './voucher-type.js';

/** Línea de entrada, ya con la cuenta resuelta (la aplicación resuelve códigos → cuentas). */
export interface LineInput {
  readonly account: Account;
  readonly partyId?: PartyId | null;
  readonly costCenter?: CostCenter | null;
  readonly debit: Money;
  readonly credit: Money;
  readonly description?: string | null;
  readonly documentRef?: string | null;
  readonly dueDate?: LocalDate | null;
}

export interface PrepareInput {
  readonly voucherType: VoucherType;
  readonly accountingDate: LocalDate;
  readonly description: string;
  readonly source: EntrySource;
  readonly lines: readonly LineInput[];
  readonly reversalOf?: { readonly id: EntryId; readonly reason: string } | undefined;
}

/**
 * Comprobante validado pero todavía sin número, id ni período. Se obtiene solo con `JournalEntry.prepare`,
 * de modo que no puede existir uno inválido (G-01).
 */
export class PendingEntry {
  /** @internal */
  constructor(
    readonly voucherType: VoucherType,
    readonly accountingDate: LocalDate,
    readonly description: string,
    readonly source: EntrySource,
    readonly lines: readonly LineInput[],
    readonly totalDebit: Money,
    readonly totalCredit: Money,
    readonly reversalOf: { readonly id: EntryId; readonly reason: string } | undefined,
  ) {}
}

export interface PostMeta {
  readonly id: EntryId;
  readonly number: EntryNumber;
  readonly numberingYear: number;
  readonly periodId: PeriodId;
  readonly postedAt: Instant;
  readonly postedBy: UserId;
  readonly nextLineId: () => string;
  readonly idempotency?: { readonly key: string; readonly requestHash: string } | undefined;
}

export interface JournalEntryProps {
  readonly id: EntryId;
  readonly voucherTypeId: string;
  readonly voucherTypeCode: string;
  readonly numberingYear: number;
  readonly number: EntryNumber;
  readonly accountingDate: LocalDate;
  readonly periodId: PeriodId;
  readonly description: string;
  readonly source: EntrySource;
  readonly reversalOf: EntryId | null;
  readonly reversalReason: string | null;
  readonly reversedBy: EntryId | null;
  readonly totalDebit: Money;
  readonly totalCredit: Money;
  readonly lines: readonly JournalLine[];
  readonly postedAt: Instant;
  readonly postedBy: UserId;
  readonly idempotency: { readonly key: string; readonly requestHash: string } | null;
}

const MAX_DESCRIPTION = 500;

/**
 * Comprobante contabilizado — agregado raíz INMUTABLE (principio I). Sin *setters*: la única forma de crearlo
 * es `prepare` (valida) + `post` (asigna número); la corrección es un contraasiento (`ReversalFactory`).
 */
export class JournalEntry {
  private constructor(private readonly props: JournalEntryProps) {}

  /**
   * Valida las reglas del comprobante: ≥ 2 líneas (R-CON-003), un solo lado positivo (R-CON-002), cuentas de
   * movimiento activas (R-CON-003), tercero/centro de costo (R-CON-008) y cuadre exacto (R-CON-001).
   * Primero las reglas de línea (`VALIDATION_FAILED`); solo si pasan se evalúa el cuadre (`ENTRY_NOT_BALANCED`).
   */
  static prepare(input: PrepareInput): PendingEntry {
    const v: Violation[] = [];
    if (input.description.length < 1 || input.description.length > MAX_DESCRIPTION) {
      v.push({ field: 'description', message: `La descripción debe tener entre 1 y ${MAX_DESCRIPTION} caracteres` });
    }
    if (input.lines.length < 2) {
      v.push({ field: 'lines', message: 'Un comprobante necesita al menos dos líneas', rule: 'R-CON-003' });
    }
    input.lines.forEach((l, i) => {
      const at = `lines[${i}]`;
      const d = l.debit.isPositive();
      const c = l.credit.isPositive();
      if (l.debit.isNegative() || l.credit.isNegative()) {
        v.push({ field: `${at}.amount`, message: 'No se admiten valores negativos', rule: 'R-CON-002' });
      } else if (d === c) {
        v.push({ field: `${at}.amount`, message: d ? 'Una línea no puede tener débito y crédito a la vez' : 'Una línea debe tener débito o crédito mayor que cero', rule: 'R-CON-002' });
      }
      if (!l.account.canReceivePostings()) {
        v.push({ field: `${at}.accountCode`, message: `La cuenta ${l.account.code} no es de movimiento o está inactiva`, rule: 'R-CON-003' });
      }
      if (l.account.requiresParty && !l.partyId) {
        v.push({ field: `${at}.partyId`, message: `La cuenta ${l.account.code} exige tercero`, rule: 'R-CON-008' });
      }
      if (l.account.requiresCostCenter && !l.costCenter) {
        v.push({ field: `${at}.costCenterCode`, message: `La cuenta ${l.account.code} exige centro de costo`, rule: 'R-CON-008' });
      }
    });
    if (v.length > 0) throw new ValidationFailed(v);

    const totalDebit = Money.sum(input.lines.map((l) => l.debit));
    const totalCredit = Money.sum(input.lines.map((l) => l.credit));
    if (!totalDebit.equals(totalCredit)) throw new EntryNotBalanced(totalDebit.toString(), totalCredit.toString());
    return new PendingEntry(input.voucherType, input.accountingDate, input.description, input.source, input.lines, totalDebit, totalCredit, input.reversalOf);
  }

  /** Asigna número, identificadores y período y devuelve el comprobante contabilizado. */
  static post(pending: PendingEntry, meta: PostMeta): JournalEntry {
    const lines = pending.lines.map((l, i) =>
      JournalLine.restore({
        id: meta.nextLineId(),
        lineNo: i + 1,
        accountId: l.account.id,
        accountCode: l.account.code.value,
        accountName: l.account.name,
        partyId: l.partyId ?? null,
        costCenterId: l.costCenter?.id ?? null,
        costCenterCode: l.costCenter?.code ?? null,
        debit: l.debit,
        credit: l.credit,
        description: l.description ?? null,
        documentRef: l.documentRef ?? null,
        dueDate: l.dueDate ?? null,
      }),
    );
    return new JournalEntry({
      id: meta.id,
      voucherTypeId: pending.voucherType.id,
      voucherTypeCode: pending.voucherType.code,
      numberingYear: meta.numberingYear,
      number: meta.number,
      accountingDate: pending.accountingDate,
      periodId: meta.periodId,
      description: pending.description,
      source: pending.source,
      reversalOf: pending.reversalOf?.id ?? null,
      reversalReason: pending.reversalOf?.reason ?? null,
      reversedBy: null,
      totalDebit: pending.totalDebit,
      totalCredit: pending.totalCredit,
      lines,
      postedAt: meta.postedAt,
      postedBy: meta.postedBy,
      idempotency: meta.idempotency ?? null,
    });
  }

  /** Reconstruye un comprobante ya persistido (sin revalidar: la base lo garantiza). */
  static restore(props: JournalEntryProps): JournalEntry {
    return new JournalEntry(props);
  }

  /** Proyección de lectura: copia del comprobante marcando qué comprobante lo reversa (no se persiste en el original). */
  withReversedBy(reversalId: EntryId | null): JournalEntry {
    return new JournalEntry({ ...this.props, reversedBy: reversalId });
  }

  get id(): EntryId { return this.props.id; }
  get voucherTypeId(): string { return this.props.voucherTypeId; }
  get voucherTypeCode(): string { return this.props.voucherTypeCode; }
  get numberingYear(): number { return this.props.numberingYear; }
  get number(): EntryNumber { return this.props.number; }
  get accountingDate(): LocalDate { return this.props.accountingDate; }
  get periodId(): PeriodId { return this.props.periodId; }
  get description(): string { return this.props.description; }
  get source(): EntrySource { return this.props.source; }
  get status(): 'POSTED' { return 'POSTED'; }
  get reversalOf(): EntryId | null { return this.props.reversalOf; }
  get reversalReason(): string | null { return this.props.reversalReason; }
  /** Calculado al leer: id del comprobante que lo reversa; no se guarda en el original. */
  get reversedBy(): EntryId | null { return this.props.reversedBy; }
  get totalDebit(): Money { return this.props.totalDebit; }
  get totalCredit(): Money { return this.props.totalCredit; }
  get lines(): readonly JournalLine[] { return this.props.lines; }
  get postedAt(): Instant { return this.props.postedAt; }
  get postedBy(): UserId { return this.props.postedBy; }
  get idempotency(): { readonly key: string; readonly requestHash: string } | null { return this.props.idempotency; }
}
