import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Param,
  Patch,
  Post,
  Query,
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

  @Get('workspaces/:workspaceId/categories')
  listCategories(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.coreService.listCategories(actor, workspaceId);
  }

  @Post('workspaces/:workspaceId/categories')
  createCategory(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    return this.coreService.createCategory(actor, workspaceId, body);
  }

  @Post('workspaces/:workspaceId/categories/:categoryId/archive')
  archiveCategory(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.coreService.archiveCategory(actor, workspaceId, categoryId);
  }

  @Get('workspaces/:workspaceId/tags')
  listTags(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.coreService.listTags(actor, workspaceId);
  }

  @Post('workspaces/:workspaceId/tags')
  createTag(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    return this.coreService.createTag(actor, workspaceId, body);
  }

  @Post('workspaces/:workspaceId/invitations')
  createInvitation(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    return this.coreService.createInvitation(actor, workspaceId, body);
  }

  @Get('workspaces/:workspaceId/invitations')
  listInvitations(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.coreService.listInvitations(actor, workspaceId);
  }

  @Post('invitations/:token/accept')
  acceptInvitation(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('token') token: string,
  ) {
    return this.coreService.acceptInvitation(actor, token);
  }

  @Post('workspaces/:workspaceId/invitations/:invitationId/revoke')
  revokeInvitation(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.coreService.revokeInvitation(actor, workspaceId, invitationId);
  }

  @Delete('workspaces/:workspaceId/members/:memberId')
  removeMember(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.coreService.removeMember(actor, workspaceId, memberId);
  }

  @Post('workspaces/:workspaceId/owner-transfers')
  initiateOwnerTransfer(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    return this.coreService.initiateOwnerTransfer(actor, workspaceId, body);
  }

  @Post('owner-transfers/:transferId/accept')
  acceptOwnerTransfer(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('transferId') transferId: string,
  ) {
    return this.coreService.acceptOwnerTransfer(actor, transferId);
  }

  @Post('workspaces/:workspaceId/owner-transfers/:transferId/cancel')
  cancelOwnerTransfer(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('transferId') transferId: string,
  ) {
    return this.coreService.cancelOwnerTransfer(actor, workspaceId, transferId);
  }

  @Post('workspaces/:workspaceId/archive')
  archiveWorkspace(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.coreService.archiveWorkspace(actor, workspaceId);
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

  @Get('workspaces/:workspaceId/budgets')
  listBudgetPeriods(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.coreService.listBudgetPeriods(actor, workspaceId);
  }

  @Post('workspaces/:workspaceId/budgets')
  createBudgetPeriod(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    return this.coreService.createBudgetPeriod(actor, workspaceId, body);
  }

  @Get('workspaces/:workspaceId/budgets/:month')
  getBudgetOverview(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('month') month: string,
  ) {
    return this.coreService.getBudgetOverview(actor, workspaceId, month);
  }

  @Post('workspaces/:workspaceId/budgets/:month/close')
  closeBudgetPeriod(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('month') month: string,
  ) {
    return this.coreService.closeBudgetPeriod(actor, workspaceId, month);
  }

  @Get('workspaces/:workspaceId/overview')
  overview(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.coreService.overview(actor, workspaceId);
  }

  @Get('workspaces/:workspaceId/reports')
  reports(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Query('from') fromMonth?: string,
    @Query('to') toMonth?: string,
  ) {
    return this.coreService.reports(actor, workspaceId, fromMonth, toMonth);
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

  @Post('workspaces/:workspaceId/accounts/:accountId/archive')
  archiveAccount(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('accountId') accountId: string,
  ) {
    return this.coreService.archiveAccount(actor, workspaceId, accountId);
  }

  @Get('workspaces/:workspaceId/balances/rebuild')
  rebuildBalances(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.coreService.rebuildBalances(actor, workspaceId);
  }

  @Get('workspaces/:workspaceId/balances')
  getBalanceViews(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.coreService.getBalanceViews(actor, workspaceId);
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

  @Get('workspaces/:workspaceId/transactions/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="finwise-transactions.csv"',
  )
  exportTransactions(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.coreService.exportTransactions(actor, workspaceId);
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

  @Post('workspaces/:workspaceId/transactions/:transactionId/classification')
  classifyTransaction(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('transactionId') transactionId: string,
    @Body() body: unknown,
  ) {
    return this.coreService.classifyTransaction(
      actor,
      workspaceId,
      transactionId,
      body,
    );
  }

  @Get('workspaces/:workspaceId/transactions/:transactionId/classification')
  getClassification(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.coreService.getClassification(
      actor,
      workspaceId,
      transactionId,
    );
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

  @Post('workspaces/:workspaceId/transactions/:transactionId/replace')
  replaceTransaction(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('transactionId') transactionId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.coreService.replaceTransaction(
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

  @Get('workspaces/:workspaceId/transactions/:transactionId/source-links')
  sourceLinks(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('workspaceId') workspaceId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.coreService.sourceLinks(actor, workspaceId, transactionId);
  }
}
