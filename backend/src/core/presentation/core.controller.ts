import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentActor } from '../../auth/actor.decorator';
import { FinwiseAuthGuard } from '../../auth/finwise-auth.guard';
import { AuthenticatedActor } from '../../shared/application/auth';
import { CoreService } from '../application/core.service';

@UseGuards(FinwiseAuthGuard)
@Controller()
export class CoreController {
  constructor(private readonly coreService: CoreService) {}

  @Get('session/bootstrap')
  bootstrap(@CurrentActor() actor: AuthenticatedActor) {
    return this.coreService.bootstrap(actor);
  }

  @Get('workspaces/:workspaceId')
  getWorkspace(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.coreService.getWorkspace(actor, workspaceId);
  }

  @Get('workspaces/:workspaceId/members')
  listMembers(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.coreService.listMembers(actor, workspaceId);
  }

  @Get('workspaces/:workspaceId/roles')
  listRoles(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.coreService.listRoles(actor, workspaceId);
  }

  @Post('workspaces/:workspaceId/roles')
  createRole(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    return this.coreService.createRole(actor, workspaceId, body);
  }

  @Patch('workspaces/:workspaceId/roles/:roleId')
  updateRole(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('roleId') roleId: string,
    @Body() body: unknown,
  ) {
    return this.coreService.updateRole(actor, workspaceId, roleId, body);
  }

  @Delete('workspaces/:workspaceId/roles/:roleId')
  deleteRole(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.coreService.deleteRole(actor, workspaceId, roleId);
  }

  @Post('workspaces/:workspaceId/members/:memberId/roles')
  assignRole(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @Body() body: unknown,
  ) {
    return this.coreService.assignRole(actor, workspaceId, memberId, body);
  }

  @Get('workspaces/:workspaceId/members/:memberId/access-preview')
  accessPreview(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.coreService.accessPreview(actor, workspaceId, memberId);
  }

  @Post('workspaces')
  createWorkspace(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() body: unknown,
  ) {
    return this.coreService.createWorkspace(actor, body);
  }

  @Get('workspaces/:workspaceId/accounts')
  listAccounts(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.coreService.listAccounts(actor, workspaceId);
  }

  @Get('workspaces/:workspaceId/overview')
  overview(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.coreService.overview(actor, workspaceId);
  }

  @Post('workspaces/:workspaceId/accounts')
  createAccount(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    return this.coreService.createAccount(actor, workspaceId, body);
  }

  @Get('workspaces/:workspaceId/accounts/:accountId')
  getAccount(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('accountId') accountId: string,
  ) {
    return this.coreService.getAccount(actor, workspaceId, accountId);
  }

  @Post('workspaces/:workspaceId/accounts/:accountId/access')
  updateAccountAccess(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('accountId') accountId: string,
    @Body() body: unknown,
  ) {
    return this.coreService.updateAccountAccess(
      actor,
      workspaceId,
      accountId,
      body,
    );
  }

  @Post('workspaces/:workspaceId/accounts/:accountId/opening-balance')
  openingBalance(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('accountId') accountId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.coreService.postOpeningBalance(
      actor,
      workspaceId,
      accountId,
      body,
      idempotencyKey,
    );
  }

  @Get('workspaces/:workspaceId/transactions')
  listTransactions(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.coreService.listTransactions(actor, workspaceId);
  }

  @Post('workspaces/:workspaceId/transactions')
  createTransaction(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.coreService.createTransaction(
      actor,
      workspaceId,
      body,
      idempotencyKey,
    );
  }

  @Get('workspaces/:workspaceId/transactions/:transactionId')
  getTransaction(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.coreService.getTransaction(actor, workspaceId, transactionId);
  }

  @Post('workspaces/:workspaceId/transactions/:transactionId/void')
  voidTransaction(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('transactionId') transactionId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.coreService.voidTransaction(
      actor,
      workspaceId,
      transactionId,
      body,
      idempotencyKey,
    );
  }

  @Get('workspaces/:workspaceId/transactions/:transactionId/audits')
  audits(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.coreService.audits(actor, workspaceId, transactionId);
  }
}
