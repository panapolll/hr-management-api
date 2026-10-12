import {
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { AttendanceService } from './attendance.service';
import { QueryMyAttendanceDto } from './dto/query-attendance.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  checkIn(@CurrentUser() user: AuthUser) {
    return this.attendanceService.checkIn(user);
  }

  @Post('check-out')
  @HttpCode(200)
  checkOut(@CurrentUser() user: AuthUser) {
    return this.attendanceService.checkOut(user);
  }

  @Get('me')
  findMine(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryMyAttendanceDto,
  ) {
    return this.attendanceService.findMine(user, query);
  }
}
