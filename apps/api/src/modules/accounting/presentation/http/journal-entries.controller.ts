import { Body, Controller, Delete, Get, Headers, HttpCode, Inject, Param, Patch, Post, Put, Query, Res } from '@nestjs/common';
import { EntryImmutable } from '../../domain/errors/accounting-errors.js';
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

  /** Corrección = contraasiento (R-CON-005). */
  @Post(':entryId/reversal')
  async reverse(@Param('entryId') entryId: string, @Body() body: unknown) {
    const { entry } = await this.uc.reverseJournalEntry.execute(entryId, body);
    return toEntryDto(entry);
  }

  /** Los comprobantes contabilizados no se editan ni se eliminan (principio I): 405 ENTRY_IMMUTABLE. */
  @Put(':entryId')
  replace(): never {
    throw new EntryImmutable();
  }

  @Patch(':entryId')
  update(): never {
    throw new EntryImmutable();
  }

  @Delete(':entryId')
  remove(): never {
    throw new EntryImmutable();
  }
}
