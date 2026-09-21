import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { PlatformConfigService } from './platform-config.service';
import { UpdatePlatformConfigDto } from './dto/update-platform-config.dto';
import { ChangePinDto } from './dto/change-pin.dto';
import { ConfirmActionDto } from './dto/confirm-action.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { type User, Role } from '@prisma/client';

@Controller('admin/config')
export class PlatformConfigController {
  constructor(private readonly platformConfigService: PlatformConfigService) {}

  @Roles(Role.ADMIN)
  @Get()
  getConfig() {
    return this.platformConfigService.getConfig();
  }

  @Roles(Role.ADMIN)
  @Post('otp')
  requestOtp(@CurrentUser() admin: User) {
    return this.platformConfigService.requestOtp(admin);
  }

  @Roles(Role.ADMIN)
  @Patch()
  updateConfig(
    @CurrentUser() admin: User,
    @Body() dto: UpdatePlatformConfigDto,
  ) {
    return this.platformConfigService.updateConfig(admin, dto);
  }

  @Roles(Role.ADMIN)
  @Patch('pin')
  changePin(@CurrentUser() admin: User, @Body() dto: ChangePinDto) {
    return this.platformConfigService.changePin(admin, dto);
  }

  // POST plutôt que DELETE : certains intermédiaires HTTP suppriment le
  // corps d'une requête DELETE, or la confirmation PIN/OTP en dépend.
  @Roles(Role.ADMIN)
  @Post('pending/cancel')
  cancelPendingChange(
    @CurrentUser() admin: User,
    @Body() dto: ConfirmActionDto,
  ) {
    return this.platformConfigService.cancelPendingChange(admin, dto);
  }
}
