import { Module } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { DepartmentsController } from './department.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DepartmentsController],
  providers: [DepartmentService],
})
export class DepartmentModule {}
