import { currentTx } from '../../../../platform/persistence/sql.js';
import type { CostCenterRepository } from '../../application/ports/cost-center-repository.js';
import type { CostCenter } from '../../domain/entities/cost-center.js';
import { toCostCenter } from './mappers/reference.mapper.js';

export class PrismaCostCenterRepository implements CostCenterRepository {
  async findByCodes(codes: readonly string[]): Promise<Map<string, CostCenter>> {
    if (codes.length === 0) return new Map();
    const rows = await currentTx().cost_center.findMany({ where: { code: { in: [...codes] } } });
    return new Map(rows.map((r) => [r.code, toCostCenter(r)]));
  }
}
