import { Module } from '@nestjs/common';
import { REQUEST_CONTEXT, type RequestContextPort } from '../../shared-kernel/index.js';
import { ACCOUNT_REPOSITORY } from './application/ports/account-repository.js';
import { COST_CENTER_REPOSITORY } from './application/ports/cost-center-repository.js';
import { FISCAL_PERIOD_REPOSITORY } from './application/ports/fiscal-period-repository.js';
import { VOUCHER_TYPE_REPOSITORY } from './application/ports/voucher-type-repository.js';
import { PrismaAccountRepository } from './infrastructure/persistence/prisma-account.repository.js';
import { PrismaCostCenterRepository } from './infrastructure/persistence/prisma-cost-center.repository.js';
import { PrismaFiscalPeriodRepository } from './infrastructure/persistence/prisma-fiscal-period.repository.js';
import { PrismaVoucherTypeRepository } from './infrastructure/persistence/prisma-voucher-type.repository.js';

/** Composition root del módulo: enlaza puertos con adaptadores (D-7). Los casos de uso y controladores se añaden por historia. */
@Module({
  providers: [
    { provide: ACCOUNT_REPOSITORY, useFactory: () => new PrismaAccountRepository() },
    { provide: COST_CENTER_REPOSITORY, useFactory: () => new PrismaCostCenterRepository() },
    { provide: VOUCHER_TYPE_REPOSITORY, useFactory: () => new PrismaVoucherTypeRepository() },
    { provide: FISCAL_PERIOD_REPOSITORY, inject: [REQUEST_CONTEXT], useFactory: (ctx: RequestContextPort) => new PrismaFiscalPeriodRepository(ctx) },
  ],
  exports: [],
})
export class AccountingModule {}
