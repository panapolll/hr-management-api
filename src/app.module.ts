import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { DepartmentModule } from './department/department.module';
import { EmployeeModule } from './employee/employee.module';

@Module({
  imports: [PrismaModule, DepartmentModule, EmployeeModule],
})
export class AppModule {}
