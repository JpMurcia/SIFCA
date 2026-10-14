import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ACCOUNTING, type AccountingUseCases } from '../../application/accounting-use-cases.js';
import { pageOf, toAccountDto, toVoucherTypeDto } from './dto.js';

@Controller('accounting')
export class LookupsController {
  constructor(@Inject(ACCOUNTING) private readonly uc: AccountingUseCases) {}

  @Get('accounts')
  async accounts(@Query() query: unknown) {
    const page = await this.uc.listAccounts.execute(query);
    return pageOf(page.items.map(toAccountDto), page.nextCursor);
  }

  @Get('voucher-types')
  async voucherTypes() {
    return { data: (await this.uc.listVoucherTypes.execute()).map(toVoucherTypeDto) };
  }
}
