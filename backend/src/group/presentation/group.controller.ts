import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentActor } from '../../auth/actor.decorator';
import { FinwiseAuthGuard } from '../../auth/finwise-auth.guard';
import { AuthenticatedActor } from '../../shared/application/auth';
import { GroupService } from '../application/group.service';

@UseGuards(FinwiseAuthGuard)
@Controller('workspaces/:workspaceId/group')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Get('participants')
  listParticipants(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.groupService.listParticipants(actor, workspaceId);
  }

  @Post('participants')
  createParticipant(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    return this.groupService.createParticipant(actor, workspaceId, body);
  }

  @Get('collections')
  listCollections(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.groupService.listCollections(actor, workspaceId);
  }

  @Post('collections')
  createCollection(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    return this.groupService.createCollection(actor, workspaceId, body);
  }

  @Get('collections/:collectionId/obligations')
  listObligations(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('collectionId') collectionId: string,
  ) {
    return this.groupService.listObligations(actor, workspaceId, collectionId);
  }

  @Get('collections/:collectionId/progress')
  getCollectionProgress(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('collectionId') collectionId: string,
  ) {
    return this.groupService.getCollectionProgress(
      actor,
      workspaceId,
      collectionId,
    );
  }

  @Post('collections/:collectionId/obligations')
  addObligation(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('collectionId') collectionId: string,
    @Body() body: unknown,
  ) {
    return this.groupService.addObligation(
      actor,
      workspaceId,
      collectionId,
      body,
    );
  }

  @Get('collections/:collectionId/submissions')
  listSubmissions(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('collectionId') collectionId: string,
  ) {
    return this.groupService.listSubmissions(actor, workspaceId, collectionId);
  }

  @Post('collections/:collectionId/submissions')
  submitContribution(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('collectionId') collectionId: string,
    @Body() body: unknown,
  ) {
    return this.groupService.submitContribution(
      actor,
      workspaceId,
      collectionId,
      body,
    );
  }

  @Post('submissions/:submissionId/verify')
  verifyContribution(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('submissionId') submissionId: string,
    @Body() body: unknown,
  ) {
    return this.groupService.verifyContribution(
      actor,
      workspaceId,
      submissionId,
      body,
    );
  }

  @Post('submissions/:submissionId/resolve-overpayment')
  resolveOverpayment(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('submissionId') submissionId: string,
    @Body() body: unknown,
  ) {
    return this.groupService.resolveOverpayment(
      actor,
      workspaceId,
      submissionId,
      body,
    );
  }

  @Get('sponsored-expenses')
  listSponsoredExpenses(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.groupService.listSponsoredExpenses(actor, workspaceId);
  }

  @Post('sponsored-expenses')
  createSponsoredExpense(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    return this.groupService.createSponsoredExpense(actor, workspaceId, body);
  }

  @Get('claims')
  listClaims(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.groupService.listClaims(actor, workspaceId);
  }

  @Post('claims')
  createClaim(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    return this.groupService.createClaim(actor, workspaceId, body);
  }

  @Post('claims/:claimId/approve')
  approveClaim(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('claimId') claimId: string,
  ) {
    return this.groupService.approveClaim(actor, workspaceId, claimId);
  }

  @Post('claims/:claimId/reimburse')
  reimburseClaim(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('claimId') claimId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.groupService.reimburseClaim(
      actor,
      workspaceId,
      claimId,
      body,
      idempotencyKey,
    );
  }

  @Get('payables')
  listPayables(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.groupService.listPayables(actor, workspaceId);
  }

  @Get('expenses')
  listDirectExpenses(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.groupService.listDirectExpenses(actor, workspaceId);
  }

  @Post('expenses')
  createDirectExpense(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.groupService.createDirectExpense(
      actor,
      workspaceId,
      body,
      idempotencyKey,
    );
  }

  @Get('reports/summary')
  reportSummary(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.groupService.reportSummary(actor, workspaceId);
  }
}
