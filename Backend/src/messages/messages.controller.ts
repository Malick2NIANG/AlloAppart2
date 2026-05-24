import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateRoomDto } from './dto/create-room.dto';
import { SendMessageDto } from './dto/send-message.dto';
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
    return this.messagesService.findMessages(id, user.id, page ? parseInt(page) : 1);
  }

  @Post('rooms')
  createRoom(
    @CurrentUser() user: User,
    @Body() dto: CreateRoomDto,
  ) {
    return this.messagesService.createRoom(dto.listingId, user.id);
  }

  @Post('rooms/:id/send')
  send(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(id, user.id, dto.content);
  }

  @Post('rooms/:id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: User) {
    return this.messagesService.markRead(id, user.id);
  }
}
