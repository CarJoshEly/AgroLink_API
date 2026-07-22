import { Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiCommonErrorResponses, ApiOkResponseData, CurrentUser } from '../common/decorators';
import type { JwtPayload } from '../common/interfaces';
import { NotificationsService } from './notifications.service';
import { ListNotificationsQueryDto } from './dto';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@ApiCommonErrorResponses()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Ver mi centro de notificaciones' })
  @ApiOkResponseData()
  findMine(@CurrentUser() user: JwtPayload, @Query() query: ListNotificationsQueryDto) {
    return this.notificationsService.findMine(user.sub, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Contar mis notificaciones no leídas' })
  @ApiOkResponseData()
  getUnreadCount(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.getUnreadCount(user.sub);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marcar todas mis notificaciones como leídas' })
  @ApiOkResponseData()
  markAllAsRead(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.markAllAsRead(user.sub);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  @ApiOkResponseData()
  markAsRead(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.notificationsService.markAsRead(id, user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una notificación' })
  @ApiOkResponseData()
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.notificationsService.remove(id, user.sub);
  }
}
