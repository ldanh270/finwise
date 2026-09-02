import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { CurrentActor } from '../../auth/actor.decorator';
import { FinwiseAuthGuard } from '../../auth/finwise-auth.guard';
import { AuthenticatedActor } from '../../shared/application/auth';
import { FinwiseError } from '../../shared/errors/finwise-error';
import { CoreService } from '../../core/application/core.service';
import { WealthService } from '../application/wealth.service';
import {
  CreateLoanInput,
  InvestmentValuationRecord,
  LoanContractRecord,
  LoanPaymentRecord,
  RecordInvestmentTradeInput,
  RecordInvestmentValuationInput,
} from '../application/wealth.ports';
import {
  LoanScheduleItem,
  PaymentAllocation,
  PositionProjection,
  ValuationProjection,
} from '../domain';

@UseGuards(FinwiseAuthGuard)
@Controller('workspaces/:workspaceId/wealth')
export class WealthController {
  constructor(
    private readonly coreService: CoreService,
    private readonly wealthService: WealthService,
  ) {}

  @Get('loans')
  listLoans(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    this.authorize(actor, workspaceId);
    return this.wealthService
      .listLoans(workspaceId)
      .map((contract) => toLoanResponse(contract));
  }

  @Post('loans')
  createLoan(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
  ) {
    this.authorize(actor, workspaceId);
    const input = parseCreateLoan(body);
    return toLoanResponse(
      this.wealthService.createLoan(
        workspaceId,
        input,
        commandContext(idempotencyKey, input),
      ),
    );
  }

  @Get('loans/:contractId/payments')
  listLoanPayments(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('contractId') contractId: string,
  ) {
    this.authorize(actor, workspaceId);
    return this.wealthService
      .listLoanPayments(workspaceId, contractId)
      .map((payment) => toPaymentResponse(payment));
  }

  @Post('loans/:contractId/payments')
  recordLoanPayment(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('contractId') contractId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
  ) {
    this.authorize(actor, workspaceId);
    const input = { ...parseLoanPayment(body), contractId };
    return toPaymentResponse(
      this.wealthService.recordLoanPayment(
        workspaceId,
        {
          ...input,
        },
        commandContext(idempotencyKey, input),
      ),
    );
  }

  @Get('investments/positions')
  listInvestmentPositions(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    this.authorize(actor, workspaceId);
    return this.wealthService
      .listInvestmentPositions(workspaceId)
      .map((position) => toPositionResponse(position));
  }

  @Post('investments/trades')
  recordInvestmentTrade(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
  ) {
    this.authorize(actor, workspaceId);
    const input = parseInvestmentTrade(body);
    const result = this.wealthService.recordInvestmentTrade(
      workspaceId,
      input,
      commandContext(idempotencyKey, input),
    );
    return {
      trade: toTradeResponse(result.trade),
      positions: result.positions.map((position) =>
        toPositionResponse(position),
      ),
    };
  }

  @Get('investments/valuations')
  listInvestmentValuations(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Query('instrumentId') instrumentId?: string,
  ) {
    this.authorize(actor, workspaceId);
    return this.wealthService
      .listInvestmentValuations(workspaceId, instrumentId)
      .map((valuation) => toValuationResponse(valuation));
  }

  @Post('investments/valuations')
  recordInvestmentValuation(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
  ) {
    this.authorize(actor, workspaceId);
    const input = parseInvestmentValuation(body);
    return toValuationResponse(
      this.wealthService.recordInvestmentValuation(
        workspaceId,
        input,
        commandContext(idempotencyKey, input),
      ),
    );
  }

  private authorize(actor: AuthenticatedActor, workspaceId: string): void {
    this.coreService.getWorkspace(actor, workspaceId);
  }
}

function parseCreateLoan(body: unknown): CreateLoanInput {
  const record = asRecord(body);
  const direction = readEnum(record.direction, ['LENT', 'BORROWED']);
  const scheduleMode = readEnum(record.scheduleMode, [
    'INTEREST_FREE',
    'REDUCING_BALANCE',
  ]);
  return {
    direction,
    scheduleMode,
    principalMinorUnits: readBigInt(
      record.principalMinorUnits,
      'principalMinorUnits',
      true,
    ),
    annualRateBasisPoints: readOptionalBigInt(
      record.annualRateBasisPoints,
      'annualRateBasisPoints',
    ),
    feeMinorUnits: readOptionalBigInt(record.feeMinorUnits, 'feeMinorUnits'),
    termMonths: readPositiveInteger(record.termMonths, 'termMonths'),
    firstDueDate: readDate(record.firstDueDate, 'firstDueDate'),
  };
}

function parseLoanPayment(body: unknown) {
  const record = asRecord(body);
  return {
    installment: readPositiveInteger(record.installment, 'installment'),
    amountMinorUnits: readBigInt(
      record.amountMinorUnits,
      'amountMinorUnits',
      false,
    ),
    effectiveDate: readDate(record.effectiveDate, 'effectiveDate'),
  };
}

function parseInvestmentTrade(body: unknown): RecordInvestmentTradeInput {
  const record = asRecord(body);
  return {
    instrumentId: readString(record.instrumentId, 'instrumentId'),
    side: readEnum(record.side, ['BUY', 'SELL']),
    quantityUnits: readBigInt(record.quantityUnits, 'quantityUnits', true),
    quantityScale: readBigInt(record.quantityScale, 'quantityScale', true),
    totalCostMinorUnits: readBigInt(
      record.totalCostMinorUnits,
      'totalCostMinorUnits',
      false,
    ),
    tradedAt: readDate(record.tradedAt, 'tradedAt'),
  };
}

function parseInvestmentValuation(
  body: unknown,
): RecordInvestmentValuationInput {
  const record = asRecord(body);
  return {
    instrumentId: readString(record.instrumentId, 'instrumentId'),
    valuedAt: readDate(record.valuedAt, 'valuedAt'),
    marketPriceMinorUnits: readBigInt(
      record.marketPriceMinorUnits,
      'marketPriceMinorUnits',
      false,
    ),
  };
}

function toLoanResponse(contract: LoanContractRecord) {
  return {
    id: contract.id,
    workspaceId: contract.workspaceId,
    direction: contract.direction,
    principalMinorUnits: contract.principalMinorUnits.toString(),
    annualRateBasisPoints: contract.annualRateBasisPoints.toString(),
    termMonths: contract.termMonths,
    firstDueDate: contract.firstDueDate,
    feeMinorUnits: contract.feeMinorUnits.toString(),
    scheduleVersion: contract.scheduleVersion,
    schedule: contract.schedule.map((item) => toScheduleResponse(item)),
  };
}

function toScheduleResponse(item: LoanScheduleItem) {
  return {
    installment: item.installment,
    dueDate: item.dueDate,
    principalMinorUnits: item.principalMinorUnits.toString(),
    interestMinorUnits: item.interestMinorUnits.toString(),
    feeMinorUnits: item.feeMinorUnits.toString(),
    totalDueMinorUnits: item.totalDueMinorUnits.toString(),
    openingPrincipalMinorUnits: item.openingPrincipalMinorUnits.toString(),
    closingPrincipalMinorUnits: item.closingPrincipalMinorUnits.toString(),
  };
}

function toPaymentResponse(payment: LoanPaymentRecord) {
  return {
    id: payment.id,
    workspaceId: payment.workspaceId,
    contractId: payment.contractId,
    installment: payment.installment,
    amountMinorUnits: payment.amountMinorUnits.toString(),
    effectiveDate: payment.effectiveDate,
    allocation: toAllocationResponse(payment.allocation),
  };
}

function toAllocationResponse(allocation: PaymentAllocation) {
  return {
    feeMinorUnits: allocation.feeMinorUnits.toString(),
    interestMinorUnits: allocation.interestMinorUnits.toString(),
    principalMinorUnits: allocation.principalMinorUnits.toString(),
    unappliedMinorUnits: allocation.unappliedMinorUnits.toString(),
  };
}

function toTradeResponse(
  trade: RecordInvestmentTradeInput & { id: string; workspaceId: string },
) {
  return {
    id: trade.id,
    workspaceId: trade.workspaceId,
    instrumentId: trade.instrumentId,
    side: trade.side,
    quantityUnits: trade.quantityUnits.toString(),
    quantityScale: trade.quantityScale.toString(),
    totalCostMinorUnits: trade.totalCostMinorUnits.toString(),
    tradedAt: trade.tradedAt,
  };
}

function toPositionResponse(position: PositionProjection) {
  return {
    instrumentId: position.instrumentId,
    quantityUnits: position.quantityUnits.toString(),
    quantityScale: position.quantityScale.toString(),
    costBasisMinorUnits: position.costBasisMinorUnits.toString(),
    realizedGainMinorUnits: position.realizedGainMinorUnits.toString(),
    ...(positionHasMarketValue(position)
      ? {
          marketValueMinorUnits: position.marketValueMinorUnits.toString(),
          unrealizedGainMinorUnits:
            position.unrealizedGainMinorUnits.toString(),
        }
      : {}),
  };
}

function toValuationResponse(valuation: InvestmentValuationRecord) {
  return {
    id: valuation.id,
    workspaceId: valuation.workspaceId,
    instrumentId: valuation.instrumentId,
    valuedAt: valuation.valuedAt,
    marketPriceMinorUnits: valuation.marketPriceMinorUnits.toString(),
    projection: toPositionResponse(valuation.projection),
  };
}

function positionHasMarketValue(
  position: PositionProjection | ValuationProjection,
): position is ValuationProjection {
  return 'marketValueMinorUnits' in position;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw FinwiseError.validation('Request body must be an object.');
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw FinwiseError.validation(`${field} is required.`, { field });
  }
  return value.trim();
}

function readBigInt(value: unknown, field: string, positive: boolean): bigint {
  const parsed = readString(value, field);
  if (!/^-?\d+$/.test(parsed)) {
    throw FinwiseError.validation(`${field} must be an integer string.`, {
      field,
    });
  }
  const amount = BigInt(parsed);
  if (positive ? amount <= 0n : amount < 0n) {
    throw FinwiseError.validation(
      `${field} must be ${positive ? 'positive' : 'non-negative'}.`,
      { field },
    );
  }
  return amount;
}

function readOptionalBigInt(value: unknown, field: string): bigint | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return readBigInt(value, field, false);
}

function readPositiveInteger(value: unknown, field: string): number {
  const parsed =
    typeof value === 'number' ? value : Number(readString(value, field));
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw FinwiseError.validation(`${field} must be a positive integer.`, {
      field,
    });
  }
  return parsed;
}

function readDate(value: unknown, field: string): string {
  const date = readString(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw FinwiseError.validation(`${field} must use YYYY-MM-DD.`, { field });
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (parsed.toISOString().slice(0, 10) !== date) {
    throw FinwiseError.validation(`${field} is invalid.`, { field });
  }
  return date;
}

function readEnum<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value === 'string' && values.includes(value as T))
    return value as T;
  throw FinwiseError.validation(`Value must be one of: ${values.join(', ')}.`);
}

function commandContext(
  key: string | undefined,
  input: unknown,
): { key: string; requestHash: string } {
  const normalizedKey = key?.trim();
  if (!normalizedKey || normalizedKey.length > 200) {
    throw FinwiseError.validation('Idempotency-Key is required.', {
      field: 'Idempotency-Key',
    });
  }
  return {
    key: normalizedKey,
    requestHash: createHash('sha256')
      .update(
        JSON.stringify(input, (_, value: unknown) =>
          typeof value === 'bigint' ? value.toString() : value,
        ),
      )
      .digest('hex'),
  };
}
