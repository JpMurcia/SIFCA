import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ACCOUNTING, type AccountingUseCases } from '../../application/accounting-use-cases.js';
import { pageOf, toJournalBookDto, toLedgerDto, toTrialBalanceDto } from './dto.js';

@Controller('accounting/reports')
export class ReportsController {
  constructor(@Inject(ACCOUNTING) private readonly uc: AccountingUseCases) {}

  @Get('journal')
  async journal(@Query() query: unknown) {
    const page = await this.uc.getJournalBook.execute(query);
    return pageOf(page.items.map(toJournalBookDto), page.nextCursor);
  }

  @Get('general-ledger')
  async generalLedger(@Query() query: unknown) {
    return toLedgerDto(await this.uc.getGeneralLedger.execute(query));
  }

  @Get('trial-balance')
  async trialBalance(@Query() query: unknown) {
    return toTrialBalanceDto(await this.uc.getTrialBalance.execute(query));
  }
}
