import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentActor } from '../../auth/actor.decorator';
import { FinwiseAuthGuard } from '../../auth/finwise-auth.guard';
import { AuthenticatedActor } from '../../shared/application/auth';
import { IngestionService } from '../application/ingestion.service';

@UseGuards(FinwiseAuthGuard)
@Controller('workspaces/:workspaceId')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Get('imports')
  listSessions(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.ingestionService.listSessions(actor, workspaceId);
  }

  @Post('imports')
  createSession(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    return this.ingestionService.createSession(actor, workspaceId, body);
  }

  @Get('imports/:sessionId/records')
  listRecords(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.ingestionService.listRecords(actor, workspaceId, sessionId);
  }

  @Delete('imports/:sessionId/raw')
  deleteRaw(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.ingestionService.deleteRaw(actor, workspaceId, sessionId);
  }

  @Post('imports/records/:recordId/match')
  matchRecord(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('recordId') recordId: string,
    @Body() body: unknown,
  ) {
    return this.ingestionService.matchRecord(
      actor,
      workspaceId,
      recordId,
      body,
    );
  }

  @Post('imports/records/confirm')
  confirmRecords(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.ingestionService.confirmRecords(
      actor,
      workspaceId,
      body,
      idempotencyKey,
    );
  }

  @Post('imports/records/:recordId/confirm')
  confirmRecord(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('recordId') recordId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.ingestionService.confirmRecord(
      actor,
      workspaceId,
      recordId,
      idempotencyKey,
    );
  }

  @Post('imports/records/:recordId/ignore')
  ignoreRecord(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('recordId') recordId: string,
    @Body() body: unknown,
  ) {
    return this.ingestionService.decideRecord(
      actor,
      workspaceId,
      recordId,
      'ignored',
      body,
    );
  }

  @Post('imports/records/:recordId/needs-attention')
  markNeedsAttention(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('recordId') recordId: string,
    @Body() body: unknown,
  ) {
    return this.ingestionService.decideRecord(
      actor,
      workspaceId,
      recordId,
      'needs_attention',
      body,
    );
  }

  @Post('reconciliations')
  startReconciliation(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    return this.ingestionService.startReconciliation(actor, workspaceId, body);
  }

  @Get('reconciliations')
  listReconciliations(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.ingestionService.listReconciliations(actor, workspaceId);
  }

  @Post('reconciliations/:checkpointId/adjust')
  adjustReconciliation(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('checkpointId') checkpointId: string,
    @Body() body: unknown,
  ) {
    return this.ingestionService.adjustReconciliation(
      actor,
      workspaceId,
      checkpointId,
      body,
    );
  }
}
