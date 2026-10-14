import type { CostCenterId } from '../../../../shared-kernel/index.js';

export interface CostCenter {
  readonly id: CostCenterId;
  readonly code: string;
  readonly name: string;
  readonly isActive: boolean;
}
