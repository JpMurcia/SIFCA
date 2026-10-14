import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Query } from '@nestjs/common';
import { ACCOUNTING, type AccountingUseCases } from '../../application/accounting-use-cases.js';
import { pageOf, toDraftDto } from './dto.js';

@Controller('accounting/journal-drafts')
export class JournalDraftsController {
  constructor(@Inject(ACCOUNTING) private readonly uc: AccountingUseCases) {}

  @Post()
  async create(@Body() body: unknown) {
    return toDraftDto(await this.uc.saveJournalDraft.execute(body));
  }

  @Get()
  async list(@Query() query: unknown) {
    const page = await this.uc.listJournalDrafts.execute(query);
    return pageOf(page.items.map(toDraftDto), page.nextCursor);
  }

  @Put(':draftId')
  @HttpCode(200)
  async replace(@Param('draftId') draftId: string, @Body() body: unknown) {
    return toDraftDto(await this.uc.saveJournalDraft.execute(body, { draftId }));
  }

  @Delete(':draftId')
  @HttpCode(204)
  async discard(@Param('draftId') draftId: string): Promise<void> {
    await this.uc.discardJournalDraft.execute(draftId);
  }
}
