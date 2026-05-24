import { Body, Controller, Delete, ForbiddenException, Get, Headers, HttpCode, Param, Patch, Post, Query, RawBodyRequest, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SyncUserDto } from './dto/sync-user.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { type User, Role } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Webhook Clerk (production) — vérification de signature via svix
  @Public()
  @HttpCode(200)
  @Post('webhook')
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
  ) {
    return this.authService.handleWebhook(
      req.rawBody ?? Buffer.alloc(0),
      { 'svix-id': svixId, 'svix-timestamp': svixTimestamp, 'svix-signature': svixSignature },
    );
  }

  // Appelé par le client après inscription Clerk — synchronise le compte en BDD
  // @Public() retiré intentionnellement : le guard crée l'utilisateur automatiquement via
  // l'API Clerk lors de la première requête authentifiée. On vérifie que le clerkId
  // soumis correspond bien au token JWT pour éviter toute injection de compte.
  @Post('sync')
  sync(@CurrentUser() user: User, @Body() dto: SyncUserDto) {
    if (dto.clerkId !== user.clerkId) throw new ForbiddenException('clerkId mismatch');
    return this.authService.syncUser(dto);
  }

  @Get('me')
  getMe(@CurrentUser() user: User) {
    return this.authService.getMe(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.authService.updateMe(user.id, dto);
  }

  // Activation du rôle BAILLEUR depuis le dashboard — accessible à tout utilisateur connecté
  @Patch('me/activate-bailleur')
  activateBailleur(@CurrentUser() user: User) {
    return this.authService.activateBailleur(user.id);
  }

  // Création d'un compte AGENT_TERRAIN — réservé à l'ADMIN, pas de formulaire public
  @Roles(Role.ADMIN)
  @Post('agents')
  createAgentTerrain(
    @CurrentUser() admin: User,
    @Body() dto: SyncUserDto,
  ) {
    return this.authService.createAgentTerrain(admin.id, dto);
  }

  @Roles(Role.ADMIN)
  @Get('users')
  getUsers(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.authService.getUsers(parseInt(page), parseInt(limit));
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
