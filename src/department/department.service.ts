import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDepartmentDto) {
    try {
      return await this.prisma.department.create({ data: dto });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  findAll() {
    return this.prisma.department.findMany({
      orderBy: { id: 'asc' },
      include: {
        manager: { select: { id: true, first_name: true, last_name: true } },
        _count: { select: { employees: true } },
      },
    });
  }

  async findOne(id: number) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: { employees: true, manager: true },
    });
    if (!department) {
      throw new NotFoundException(`ไม่พบแผนก id ${id}`);
    }
    return department;
  }

  async update(id: number, dto: UpdateDepartmentDto) {
    await this.findOne(id);
    try {
      return await this.prisma.department.update({ where: { id }, data: dto });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async setManager(id: number, employeeId: number | null) {
    await this.findOne(id);

    if (employeeId === null) {
      return this.prisma.department.update({
        where: { id },
        data: { manager_id: null },
      });
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      throw new NotFoundException(`ไม่พบพนักงาน id ${employeeId}`);
    }
    if (employee.department_id !== id) {
      throw new BadRequestException(
        `พนักงาน id ${employeeId} ไม่อยู่ในแผนก id ${id}`,
      );
    }
    if (employee.status === 'resigned') {
      throw new BadRequestException(
        'ไม่สามารถตั้งพนักงานที่ลาออกแล้วเป็นหัวหน้าได้',
      );
    }

    return this.prisma.department.update({
      where: { id },
      data: { manager_id: employeeId },
      include: { manager: true },
    });
  }

  async remove(id: number) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { employees: true } } },
    });
    if (!department) {
      throw new NotFoundException(`ไม่พบแผนก id ${id}`);
    }
    if (department._count.employees > 0) {
      throw new ConflictException('ไม่สามารถลบแผนกที่ยังมีพนักงานอยู่ได้');
    }
    return this.prisma.department.delete({ where: { id } });
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('ชื่อหรือรหัสแผนกนี้มีอยู่แล้ว');
    }
    throw error;
  }
}
