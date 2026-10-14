import type { CostCenter } from '../../domain/entities/cost-center.js';

export interface CostCenterRepository {
  /** Mapa código → centro de costo con los que existen. */
  findByCodes(codes: readonly string[]): Promise<Map<string, CostCenter>>;
}

export const COST_CENTER_REPOSITORY = Symbol('CostCenterRepository');
