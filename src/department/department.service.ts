import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { Prisma } from '@prisma/client';
import { CreateDepartmentDto } from './dto/department.dto';

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDepartmentDto) {
    try {
      return await this.prisma.department.create({ data: dto });
    } catch (error) {
      console.log(error);
      this.handlePrismaError(error);
    }
  }

  findAll() {
    return this.prisma.department.findMany({
      orderBy: { id: 'asc' },
      include: { _count: { select: { employees: true } } },
    });
  }

  async findOne(id: number) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: { employees: true },
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
      console.log(error);
      this.handlePrismaError(error);
    }
  }

  async remove(id: number) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { employees: true } } },
    });
    if (!department) {
      throw new NotFoundException(`ไม่พบแผนก id ${id}`);
    }
    return this.prisma.department.delete({ where: { id } });
  }
  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('ชื่อแผนกนี้มีอยู่แล้ว');
    }
    throw error;
  }
}
