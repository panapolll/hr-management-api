import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { QueryEmployeeDto } from './dto/query-employee.dto';

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEmployeeDto) {
    await this.ensureDepartmentExists(dto.department_id);
    try {
      return await this.prisma.employee.create({
        data: { ...dto, start_date: new Date(dto.start_date) },
        include: { department: true },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll(query: QueryEmployeeDto) {
    const { page = 1, limit = 10, search, department_id, status } = query;

    const where: Prisma.EmployeeWhereInput = {};
    if (department_id) where.department_id = department_id;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employee_code: { contains: search, mode: 'insensitive' } },
        { position: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'asc' },
        include: {
          department: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: { department: true },
    });
    if (!employee) {
      throw new NotFoundException(`ไม่พบพนักงาน id ${id}`);
    }
    return employee;
  }

  async update(id: number, dto: UpdateEmployeeDto) {
    await this.findOne(id);
    if (dto.department_id) {
      await this.ensureDepartmentExists(dto.department_id);
    }
    try {
      return await this.prisma.employee.update({
        where: { id },
        data: {
          ...dto,
          ...(dto.start_date && { start_date: new Date(dto.start_date) }),
        },
        include: { department: true },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async remove(id: number) {
    const employee = await this.findOne(id);
    if (employee.status === 'resigned') {
      throw new BadRequestException('พนักงานคนนี้ไดลาออกไปแล้ว');
    }
    return this.prisma.employee.update({
      where: { id },
      data: { status: 'resigned' },
    });
  }

  private async ensureDepartmentExists(departmentId: number) {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
    });
    if (!department) {
      throw new BadRequestException(`ไม่พบแผนก id ${departmentId}`);
    }
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const fieldNames: Record<string, string> = {
        employee_code: 'รหัสพนักงาน',
        email: 'อีเมล',
      };
      const target = (error.meta?.target as string[] | undefined) ?? [];
      const label = target.map((f) => fieldNames[f] ?? f).join(', ');
      throw new ConflictException(`${label}นี้มีอยู่ในระบบแล้ว`);
    }
    throw error;
  }
}
