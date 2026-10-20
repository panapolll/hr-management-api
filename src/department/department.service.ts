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

// ข้อมูลพนักงานที่โชว์ในหน้าแผนก (ไม่มีเงินเดือน)
const EMPLOYEE_PUBLIC_FIELDS = {
  id: true,
  employee_code: true,
  first_name: true,
  last_name: true,
  position: true,
  status: true,
} as const;

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
      include: {
        employees: { select: EMPLOYEE_PUBLIC_FIELDS },
        manager: { select: EMPLOYEE_PUBLIC_FIELDS },
      },
    });
    if (!department) {
      throw new NotFoundException(`Department #${id} not found`);
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

    // ถอดหัวหน้าออก
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
      throw new NotFoundException(`Employee #${employeeId} not found`);
    }
    if (employee.department_id !== id) {
      throw new BadRequestException(
        `Employee #${employeeId} is not in department #${id}`,
      );
    }
    if (employee.status === 'resigned') {
      throw new BadRequestException('A resigned employee cannot be a manager');
    }

    // กันกรณีเป็นหัวหน้าแผนกอื่นอยู่แล้ว (manager_id ห้ามซ้ำ)
    const managedElsewhere = await this.prisma.department.findFirst({
      where: { manager_id: employeeId, NOT: { id } },
    });
    if (managedElsewhere) {
      throw new ConflictException(
        `Employee #${employeeId} is already the manager of ${managedElsewhere.code}`,
      );
    }

    return this.prisma.department.update({
      where: { id },
      data: { manager_id: employeeId },
      include: { manager: { select: EMPLOYEE_PUBLIC_FIELDS } },
    });
  }

  async remove(id: number) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { employees: true } } },
    });
    if (!department) {
      throw new NotFoundException(`Department #${id} not found`);
    }
    if (department._count.employees > 0) {
      throw new ConflictException(
        'Cannot delete a department that still has employees',
      );
    }
    return this.prisma.department.delete({ where: { id } });
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Department name or code already exists');
    }
    throw error;
  }
}
