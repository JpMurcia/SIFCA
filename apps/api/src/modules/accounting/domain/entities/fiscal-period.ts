import { LocalDate, type PeriodId, type UserId } from '../../../../shared-kernel/index.js';

export type PeriodStatus = 'OPEN' | 'CLOSED';

export interface FiscalPeriodProps {
  readonly id: PeriodId;
  readonly year: number;
  readonly month: number;
  readonly startsOn: LocalDate;
  readonly endsOn: LocalDate;
  readonly status: PeriodStatus;
  readonly closedAt: string | null;
  readonly closedBy: UserId | null;
  readonly version: number;
}

/** Período contable mensual. Las transiciones de cierre/reapertura se añaden con la historia US3. */
export class FiscalPeriod {
  private constructor(private readonly props: FiscalPeriodProps) {}

  static restore(props: FiscalPeriodProps): FiscalPeriod {
    return new FiscalPeriod(props);
  }

  /** Crea los 12 períodos mensuales (abiertos) de un año. `ids` debe traer 12 identificadores. */
  static openYear(year: number, ids: readonly PeriodId[]): FiscalPeriod[] {
    if (ids.length !== 12) throw new RangeError('Se necesitan 12 identificadores');
    return ids.map(
      (id, i) =>
        new FiscalPeriod({
          id,
          year,
          month: i + 1,
          startsOn: LocalDate.firstDayOf(year, i + 1),
          endsOn: LocalDate.lastDayOf(year, i + 1),
          status: 'OPEN',
          closedAt: null,
          closedBy: null,
          version: 1,
        }),
    );
  }

  get id(): PeriodId { return this.props.id; }
  get year(): number { return this.props.year; }
  get month(): number { return this.props.month; }
  get startsOn(): LocalDate { return this.props.startsOn; }
  get endsOn(): LocalDate { return this.props.endsOn; }
  get status(): PeriodStatus { return this.props.status; }
  get closedAt(): string | null { return this.props.closedAt; }
  get closedBy(): UserId | null { return this.props.closedBy; }
  get version(): number { return this.props.version; }

  isOpen(): boolean { return this.props.status === 'OPEN'; }
  contains(date: LocalDate): boolean { return date.isBetween(this.props.startsOn, this.props.endsOn); }
}
