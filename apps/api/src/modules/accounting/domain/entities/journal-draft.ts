import type { DraftId, Instant, LocalDate, UserId } from '../../../../shared-kernel/index.js';

export interface DraftLine {
  readonly accountCode: string;
  readonly partyId?: string | null | undefined;
  readonly costCenterCode?: string | null | undefined;
  readonly debit?: string | undefined;
  readonly credit?: string | undefined;
  readonly description?: string | undefined;
  readonly documentRef?: string | undefined;
  readonly dueDate?: string | null | undefined;
}

export interface JournalDraftProps {
  readonly id: DraftId;
  readonly voucherTypeCode: string;
  readonly accountingDate: LocalDate | null;
  readonly description: string | null;
  readonly lines: readonly DraftLine[];
  readonly version: number;
  readonly createdBy: UserId;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

/**
 * Borrador de comprobante: es MUTABLE (no es registro contable) y admite descuadre. No consume consecutivo ni
 * afecta saldos; bloquea el cierre del período (R-CON-011).
 */
export class JournalDraft {
  private constructor(private readonly props: JournalDraftProps) {}
  static restore(props: JournalDraftProps): JournalDraft {
    return new JournalDraft(props);
  }
  static create(input: Omit<JournalDraftProps, 'version' | 'updatedAt'> & { now: Instant }): JournalDraft {
    return new JournalDraft({ ...input, version: 1, updatedAt: input.now });
  }
  /** Reemplaza el contenido y avanza la versión. */
  replace(input: { voucherTypeCode: string; accountingDate: LocalDate | null; description: string | null; lines: readonly DraftLine[]; now: Instant }): JournalDraft {
    return new JournalDraft({ ...this.props, voucherTypeCode: input.voucherTypeCode, accountingDate: input.accountingDate, description: input.description, lines: input.lines, version: this.props.version + 1, updatedAt: input.now });
  }
  get id(): DraftId { return this.props.id; }
  get voucherTypeCode(): string { return this.props.voucherTypeCode; }
  get accountingDate(): LocalDate | null { return this.props.accountingDate; }
  get description(): string | null { return this.props.description; }
  get lines(): readonly DraftLine[] { return this.props.lines; }
  get version(): number { return this.props.version; }
  get createdBy(): UserId { return this.props.createdBy; }
  get createdAt(): Instant { return this.props.createdAt; }
  get updatedAt(): Instant { return this.props.updatedAt; }
}
