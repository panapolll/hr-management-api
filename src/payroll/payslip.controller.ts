import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { PayrollService } from './payroll.service';

@UseGuards(JwtAuthGuard)
@Controller('payslips')
export class PayslipController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('me')
  findMine(@CurrentUser() user: AuthUser) {
    return this.payrollService.findMyPayslips(user);
  }
}
