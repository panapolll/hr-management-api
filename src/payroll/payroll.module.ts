import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { PayslipController } from './payslip.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PayrollController, PayslipController],
  providers: [PayrollService],
})
export class PayrollModule {}
