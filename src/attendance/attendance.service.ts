import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/current-user.decorator';
import { parseTime, toBangkokDate, toBangkokMinutes } from './attendance-time';
import {
  QueryAttendanceDto,
  QueryMyAttendanceDto,
} from './dto/query-attendance.dto';

@Injectable()
export class AttendanceService {
  private readonly workStart: number;
  private readonly graceMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.workStart = parseTime(config.get<string>('WORK_START') ?? '08:00');
    this.graceMinutes = Number(config.get('LATE_GRACE_MINUTES') ?? 30);
  }

  async checkIn(user: AuthUser) {
    const employeeId = await this.getActiveEmployeeId(user);
    const now = new Date();
    const workDate = toBangkokDate(now);

    const existing = await this.findToday(employeeId, workDate);
    if (existing) {
      throw new ConflictException('Already checked in today');
    }

    const lateMinutes = Math.max(0, toBangkokMinutes(now) - this.workStart);

    try {
      const attendance = await this.prisma.attendance.create({
        data: {
          employee_id: employeeId,
          work_date: workDate,
          check_in: now,
          late_minutes: lateMinutes,
        },
      });
      return { message: this.lateMessage(lateMinutes), attendance };
    } catch (error) {
      // กันกรณีกดเข้างานสองครั้งพร้อมกันจนหลุดการเช็คด้านบน
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Already checked in today');
      }
      throw error;
    }
  }

  async checkOut(user: AuthUser) {
    const employeeId = await this.getActiveEmployeeId(user);
    const now = new Date();
    const record = await this.findToday(employeeId, toBangkokDate(now));

    if (!record) {
      throw new BadRequestException('Not checked in today');
    }
    if (record.check_out) {
      throw new ConflictException('Already checked out today');
    }

    const workMinutes = Math.round(
      (now.getTime() - record.check_in.getTime()) / 60000,
    );

    const attendance = await this.prisma.attendance.update({
      where: { id: record.id },
      data: { check_out: now, work_minutes: workMinutes },
    });
    return { message: 'Checked out', attendance };
  }

  findMine(user: AuthUser, query: QueryMyAttendanceDto) {
    const employeeId = this.requireEmployeeId(user);

    const where: Prisma.AttendanceWhereInput = { employee_id: employeeId };
    if (query.from || query.to) {
      where.work_date = {
        ...(query.from && { gte: new Date(query.from) }),
        ...(query.to && { lte: new Date(query.to) }),
      };
    }

    return this.prisma.attendance.findMany({
      where,
      orderBy: { work_date: 'desc' },
    });
  }

  async findAll(query: QueryAttendanceDto, user: AuthUser) {
    const {
      from,
      to,
      department_id,
      employee_id,
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.AttendanceWhereInput = {};

    if (from || to) {
      where.work_date = {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      };
    }
    if (employee_id) where.employee_id = employee_id;
    if (department_id) where.employee = { department_id };

    if (user.role === 'MANAGER') {
      where.employee = { department_id: await this.getOwnDepartmentId(user) };
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.attendance.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ work_date: 'desc' }, { check_in: 'asc' }],
        include: {
          employee: {
            select: {
              id: true,
              employee_code: true,
              first_name: true,
              last_name: true,
              department: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
      this.prisma.attendance.count({ where }),
    ]);
    return {
      data,
      meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
    };
  }

  // ---------- ตัวช่วยภายใน ----------

  private requireEmployeeId(user: AuthUser): number {
    if (!user.employee_id) {
      throw new BadRequestException(
        'This account is not linked to an employee',
      );
    }
    return user.employee_id;
  }

  private async getOwnDepartmentId(user: AuthUser): Promise<number> {
    const employeeId = this.requireEmployeeId(user);
    const me = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { department_id: true },
    });
    if (!me) {
      throw new ForbiddenException('This account is not linked to an employee');
    }
    return me.department_id;
  }

  // ลงเวลาได้เฉพาะพนักงานที่ active เท่านั้น
  private async getActiveEmployeeId(user: AuthUser): Promise<number> {
    const employeeId = this.requireEmployeeId(user);
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { status: true },
    });
    if (!employee) {
      throw new ForbiddenException('This account is not linked to an employee');
    }
    if (employee.status !== 'active') {
      throw new ForbiddenException(
        `Cannot record attendance while ${employee.status}`,
      );
    }
    return employeeId;
  }

  private findToday(employeeId: number, workDate: Date) {
    return this.prisma.attendance.findUnique({
      where: {
        employee_id_work_date: { employee_id: employeeId, work_date: workDate },
      },
    });
  }

  private lateMessage(lateMinutes: number): string {
    if (lateMinutes === 0) {
      return 'On time';
    }
    if (lateMinutes <= this.graceMinutes) {
      return `Late ${lateMinutes} min (within ${this.graceMinutes} min grace, no deduction)`;
    }
    return `Late ${lateMinutes} min (over ${this.graceMinutes} min grace, will be deducted)`;
  }
}
