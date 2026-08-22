import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { VerificationsService } from './verifications.service';
import { CreateVerificationDto } from './dto/create-verification.dto';
import { CompleteVerificationDto } from './dto/complete-verification.dto';
import { AssignAgentDto } from './dto/assign-agent.dto';
import { RejectVerificationDto } from './dto/reject-verification.dto';
import { DeclineVerificationDto } from './dto/decline-verification.dto';
import { RateVerificationDto } from './dto/rate-verification.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { type User, Role, VerifStatus } from '@prisma/client';

@Controller('verifications')
export class VerificationsController {
  constructor(private readonly verificationsService: VerificationsService) {}

  @Roles(Role.BAILLEUR, Role.PRO_AGENCE, Role.ADMIN)
  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateVerificationDto) {
    return this.verificationsService.create(user.id, dto);
  }

  @Roles(Role.BAILLEUR, Role.PRO_AGENCE, Role.ADMIN)
  @Get('mine')
  findMine(@CurrentUser() user: User) {
    return this.verificationsService.findByRequester(user.id);
  }

  @Roles(Role.AGENT_TERRAIN)
  @Get('assigned')
  findAssigned(@CurrentUser() user: User) {
    return this.verificationsService.findAssigned(user.id);
  }

  @Roles(Role.AGENT_TERRAIN)
  @Get('all-mine')
  findAllForAgent(@CurrentUser() user: User) {
    return this.verificationsService.findAllForAgent(user.id);
  }

  @Roles(Role.AGENT_TERRAIN)
  @Get(':id/detail')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.verificationsService.findOne(id, user.id);
  }

  @Roles(Role.AGENT_TERRAIN)
  @Get('history')
  findHistory(@CurrentUser() user: User) {
    return this.verificationsService.findAgentHistory(user.id);
  }

  @Roles(Role.AGENT_TERRAIN)
  @Get('stats')
  getStats(@CurrentUser() user: User) {
    return this.verificationsService.agentStats(user.id);
  }

  @Roles(Role.AGENT_TERRAIN, Role.ADMIN)
  @Get('pending')
  findPending() {
    return this.verificationsService.findPending();
  }

  @Roles(Role.ADMIN)
  @Get('pending-count')
  pendingCount() {
    return this.verificationsService.pendingCount();
  }

  @Roles(Role.ADMIN)
  @Get('all')
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const verifStatus = Object.values(VerifStatus).includes(status as VerifStatus)
      ? (status as VerifStatus)
      : undefined;
    return this.verificationsService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      verifStatus,
    );
  }

  @Roles(Role.ADMIN)
  @Patch(':id/validate')
  validate(@Param('id') id: string, @CurrentUser() admin: User) {
    return this.verificationsService.validate(id, admin.id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/assign')
  assignAgent(@Param('id') id: string, @Body() dto: AssignAgentDto) {
    return this.verificationsService.assignAgent(id, dto.agentId);
  }

  @Roles(Role.AGENT_TERRAIN)
  @Patch(':id/start')
  start(@Param('id') id: string, @CurrentUser() user: User) {
    return this.verificationsService.start(id, user.id);
  }

  @Roles(Role.AGENT_TERRAIN)
  @Patch(':id/complete')
  complete(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: CompleteVerificationDto,
  ) {
    return this.verificationsService.complete(id, user.id, dto);
  }

  @Roles(Role.AGENT_TERRAIN, Role.ADMIN)
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: RejectVerificationDto,
  ) {
    return this.verificationsService.reject(id, user, dto.reason);
  }

  @Roles(Role.AGENT_TERRAIN)
  @Patch(':id/decline')
  decline(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: DeclineVerificationDto,
  ) {
    return this.verificationsService.decline(id, user.id, dto.reason);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/approve-decline')
  approveDecline(@Param('id') id: string) {
    return this.verificationsService.approveDecline(id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/refuse-decline')
  refuseDecline(@Param('id') id: string) {
    return this.verificationsService.refuseDecline(id);
  }

  @Roles(Role.BAILLEUR, Role.PRO_AGENCE)
  @Post(':id/rate')
  rate(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: RateVerificationDto,
  ) {
    return this.verificationsService.rate(id, user.id, dto);
  }

  @Get(':id/rating')
  getRating(@Param('id') id: string, @CurrentUser() user: User) {
    return this.verificationsService.findRatingByVerification(id, user);
  }
}
