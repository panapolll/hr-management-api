import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { LeaveService } from './leave.service';
import { CreateLeaveDto, QueryMyLeaveDto } from './dto/leave.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leaves')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLeaveDto) {
    return this.leaveService.create(user, dto);
  }

  @Get('me')
  findMine(@CurrentUser() user: AuthUser, @Query() query: QueryMyLeaveDto) {
    return this.leaveService.findMine(user, query);
  }

  @Get('me/balance')
  getBalance(@CurrentUser() user: AuthUser, @Query() query: QueryMyLeaveDto) {
    return this.leaveService.getBalance(user, query.year);
  }

  @Patch(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.leaveService.cancel(user, id);
  }
}
