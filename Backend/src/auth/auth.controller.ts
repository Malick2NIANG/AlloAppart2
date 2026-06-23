import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SyncUserDto } from './dto/sync-user.dto';
import { CreateAgentDto } from './dto/create-agent.dto';
import { CreateProAgenceDto } from './dto/create-pro-agence.dto';
import { PaginationDto } from './dto/pagination.dto';
import { AdminFilterDto } from './dto/admin-filter.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { type User, Role } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Webhook Clerk (production) — vérification de signature via svix
  @SkipThrottle()
  @Public()
  @HttpCode(200)
  @Post('webhook')
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
  ) {
    return this.authService.handleWebhook(req.rawBody ?? Buffer.alloc(0), {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    });
  }

  // Appelé par le client après inscription Clerk — synchronise le compte en BDD.
  // Les données viennent du user authentifié (trusté), pas du body client.
  @Post('sync')
  sync(@CurrentUser() user: User) {
    return this.authService.syncUser({
      clerkId: user.clerkId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? undefined,
    });
  }

  @Get('me')
  getMe(@CurrentUser() user: User) {
    return this.authService.getMe(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.authService.updateMe(user.id, dto);
  }

  // Activation du rôle BAILLEUR — réservé aux comptes LOCATAIRE (particuliers uniquement, pas les pros ni l'admin)
  @Roles(Role.LOCATAIRE)
  @Patch('me/activate-bailleur')
  activateBailleur(@CurrentUser() user: User) {
    return this.authService.activateBailleur(user.id);
  }

  // Création d'un compte AGENT_TERRAIN — réservé à l'ADMIN, compte Clerk créé automatiquement
  @Roles(Role.ADMIN)
  @Post('agents')
  createAgentTerrain(@CurrentUser() admin: User, @Body() dto: CreateAgentDto) {
    return this.authService.createAgentTerrain(admin.id, dto);
  }

  // Création d'un compte PRO_AGENCE — admin signe le contrat et livre les identifiants
  @Roles(Role.ADMIN)
  @Post('agences')
  createProAgence(@CurrentUser() admin: User, @Body() dto: CreateProAgenceDto) {
    return this.authService.createProAgence(admin.id, dto);
  }

  @Roles(Role.ADMIN)
  @Get('users')
  getUsers(@Query() dto: AdminFilterDto) {
    return this.authService.getUsers(dto.page ?? 1, dto.limit ?? 20, dto.q, dto.role);
  }

  @Roles(Role.ADMIN)
  @Patch('users/:userId')
  updateUser(
    @Param('userId') userId: string,
    @CurrentUser() admin: User,
    @Body() dto: { firstName?: string; lastName?: string; phone?: string | null; agencyName?: string | null },
  ) {
    return this.authService.updateUser(userId, admin.id, dto);
  }

  @Roles(Role.ADMIN)
  @Patch('users/:userId/suspend')
  suspendUser(@Param('userId') userId: string, @CurrentUser() admin: User) {
    return this.authService.suspendUser(userId, admin.id);
  }

  @Roles(Role.ADMIN)
  @Delete('users/:userId')
  deleteUser(@Param('userId') userId: string, @CurrentUser() admin: User) {
    return this.authService.deleteUser(userId, admin.id);
  }

  // Désactivation du rôle BAILLEUR par l'ADMIN
  @Roles(Role.ADMIN)
  @Delete('users/:userId/bailleur')
  deactivateBailleur(
    @Param('userId') userId: string,
    @CurrentUser() admin: User,
  ) {
    return this.authService.deactivateBailleur(userId, admin.id);
  }
}
