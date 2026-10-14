import type { AccountId } from '../../../../shared-kernel/index.js';
import type { AccountCode } from '../value-objects/account-code.js';

export type Nature = 'DEBIT' | 'CREDIT';

export interface AccountProps {
  readonly id: AccountId;
  readonly code: AccountCode;
  readonly name: string;
  readonly level: number;
  readonly nature: Nature;
  readonly allowsPosting: boolean;
  readonly requiresParty: boolean;
  readonly requiresCostCenter: boolean;
  readonly isActive: boolean;
}

/** Cuenta del plan de cuentas (entidad de referencia: solo lectura para el agregado `JournalEntry`). */
export class Account {
  private constructor(private readonly props: AccountProps) {}

  static restore(props: AccountProps): Account {
    return new Account(props);
  }

  get id(): AccountId { return this.props.id; }
  get code(): AccountCode { return this.props.code; }
  get name(): string { return this.props.name; }
  get level(): number { return this.props.level; }
  get nature(): Nature { return this.props.nature; }
  get requiresParty(): boolean { return this.props.requiresParty; }
  get requiresCostCenter(): boolean { return this.props.requiresCostCenter; }

  /** R-CON-003: solo cuentas auxiliares (de movimiento) y activas reciben comprobantes. */
  canReceivePostings(): boolean {
    return this.props.allowsPosting && this.props.isActive;
  }
}
