import type { LocalDate, VoucherTypeId } from '../../../../shared-kernel/index.js';

export type NumberingScope = 'TENANT' | 'YEAR';

export interface VoucherTypeProps {
  readonly id: VoucherTypeId;
  readonly code: string;
  readonly name: string;
  readonly numberingScope: NumberingScope;
}

export class VoucherType {
  private constructor(private readonly props: VoucherTypeProps) {}

  static restore(props: VoucherTypeProps): VoucherType {
    return new VoucherType(props);
  }

  get id(): VoucherTypeId { return this.props.id; }
  get code(): string { return this.props.code; }
  get name(): string { return this.props.name; }
  get numberingScope(): NumberingScope { return this.props.numberingScope; }

  /** Año de numeración: 0 si el tipo numera por empresa; el año de la fecha contable si numera por año (R-CON-006). */
  scopeYearFor(accountingDate: LocalDate): number {
    return this.props.numberingScope === 'YEAR' ? accountingDate.year : 0;
  }
}
