import type { CostCenterId, LocalDate, Money, PartyId } from '../../../../shared-kernel/index.js';

export interface JournalLineProps {
  readonly id: string;
  readonly lineNo: number;
  readonly accountId: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly partyId: PartyId | null;
  readonly costCenterId: CostCenterId | null;
  readonly costCenterCode: string | null;
  readonly debit: Money;
  readonly credit: Money;
  readonly description: string | null;
  readonly documentRef: string | null;
  readonly dueDate: LocalDate | null;
}

/** Línea contabilizada: inmutable, un solo lado positivo. Solo se crea desde `JournalEntry.post` o al restaurar de la base. */
export class JournalLine {
  private constructor(private readonly props: JournalLineProps) {}
  static restore(props: JournalLineProps): JournalLine {
    return new JournalLine(props);
  }
  get id(): string { return this.props.id; }
  get lineNo(): number { return this.props.lineNo; }
  get accountId(): string { return this.props.accountId; }
  get accountCode(): string { return this.props.accountCode; }
  get accountName(): string { return this.props.accountName; }
  get partyId(): PartyId | null { return this.props.partyId; }
  get costCenterId(): CostCenterId | null { return this.props.costCenterId; }
  get costCenterCode(): string | null { return this.props.costCenterCode; }
  get debit(): Money { return this.props.debit; }
  get credit(): Money { return this.props.credit; }
  get description(): string | null { return this.props.description; }
  get documentRef(): string | null { return this.props.documentRef; }
  get dueDate(): LocalDate | null { return this.props.dueDate; }
}
