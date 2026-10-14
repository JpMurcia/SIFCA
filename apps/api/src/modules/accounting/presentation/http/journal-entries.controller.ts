import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Query, Res } from '@nestjs/common';
import { ACCOUNTING, type AccountingUseCases } from '../../application/accounting-use-cases.js';
import { pageOf, toEntryDto, toSummaryDto } from './dto.js';

@Controller('accounting/journal-entries')
export class JournalEntriesController {
  constructor(@Inject(ACCOUNTING) private readonly uc: AccountingUseCases) {}

  @Post()
  async post(
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: { status(n: number): unknown; setHeader(k: string, v: string): unknown },
  ) {
    const { entry, created } = await this.uc.postJournalEntry.execute(body, { idempotencyKey });
    res.status(created ? 201 : 200);
    if (created) res.setHeader('Location', `/api/v1/accounting/journal-entries/${entry.id}`);
    return toEntryDto(entry);
  }

  @Get()
  async list(@Query() query: unknown) {
    const page = await this.uc.listJournalEntries.execute(query);
    return pageOf(page.items.map(toSummaryDto), page.nextCursor);
  }

  @Get(':entryId')
  @HttpCode(200)
  async get(@Param('entryId') entryId: string) {
    return toEntryDto(await this.uc.getJournalEntry.execute(entryId));
  }
}
