import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MessagesService } from './messages.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateRoomDto } from './dto/create-room.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import type { User } from '@prisma/client';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('rooms')
  findRooms(@CurrentUser() user: User) {
    return this.messagesService.findRooms(user.id);
  }

  @Get('rooms/:id')
  findMessages(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Query('page') page?: string,
  ) {
    return this.messagesService.findMessages(
      id,
      user.id,
      page ? parseInt(page) : 1,
    );
  }

  @Post('rooms')
  createRoom(@CurrentUser() user: User, @Body() dto: CreateRoomDto) {
    // Si le bailleur initie la conversation vers un locataire spécifique
    const tenantId = dto.tenantId ?? user.id;
    return this.messagesService.createRoom(dto.listingId, tenantId, user.id);
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('rooms/:id/send')
  send(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(id, user.id, dto.content, dto.replyToId);
  }

  @Post('rooms/:id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: User) {
    return this.messagesService.markRead(id, user.id);
  }

  @Patch(':messageId')
  editMessage(
    @Param('messageId') messageId: string,
    @CurrentUser() user: User,
    @Body() dto: EditMessageDto,
  ) {
    return this.messagesService.editMessage(messageId, user.id, dto.content);
  }

  @Delete(':messageId')
  deleteMessage(
    @Param('messageId') messageId: string,
    @CurrentUser() user: User,
  ) {
    return this.messagesService.deleteMessage(messageId, user.id);
  }
}
