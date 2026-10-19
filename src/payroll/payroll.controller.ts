import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { PayrollService } from './payroll.service';
import { GeneratePayrollDto } from './dto/payroll.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payroll-runs')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  // HR / ADMIN สร้างหรือคำนวณรอบเงินเดือนใหม่
  @Post()
  @Roles('HR', 'ADMIN')
  generate(@Body() dto: GeneratePayrollDto, @CurrentUser() user: AuthUser) {
    return this.payrollService.generate(dto, user);
  }

  // HR / ADMIN ยืนยันรอบเงินเดือน
  @Patch(':id/finalize')
  @Roles('HR', 'ADMIN')
  finalize(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payrollService.finalize(id, user);
  }
}
