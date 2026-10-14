import { Body, Controller, Get, HttpCode, Inject, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ACCOUNTING, type AccountingUseCases } from '../../application/accounting-use-cases.js';
import { toEntryDto, toPeriodDto } from './dto.js';

@Controller('accounting')
export class PeriodsController {
  constructor(@Inject(ACCOUNTING) private readonly uc: AccountingUseCases) {}

  @Post('fiscal-years')
  async createYear(@Body() body: unknown) {
    return { data: (await this.uc.createFiscalYear.execute(body)).map(toPeriodDto) };
  }

  /** Cierre anual (R-CON-012): genera un comprobante `YEAR_CLOSING` reversible. */
  @Post('fiscal-years/:year/closing')
  async closeYear(@Param('year', ParseIntPipe) year: number, @Body() body: unknown) {
    return toEntryDto((await this.uc.closeFiscalYear.execute(year, body)).entry);
  }

  @Get('periods')
  async list(@Query() query: unknown) {
    return { data: (await this.uc.listPeriods.execute(query)).map(toPeriodDto) };
  }

  @Post('periods/:periodId/close')
  @HttpCode(200)
  async close(@Param('periodId') periodId: string) {
    return toPeriodDto(await this.uc.closePeriod.execute(periodId));
  }

  @Post('periods/:periodId/reopen')
  @HttpCode(200)
  async reopen(@Param('periodId') periodId: string, @Body() body: unknown) {
    return toPeriodDto(await this.uc.reopenPeriod.execute(periodId, body));
  }
}
