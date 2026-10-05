import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { DepartmentModule } from './department/department.module';

@Module({
  imports: [PrismaModule, DepartmentModule],
})
export class AppModule {}
