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
import { QueryMyAttendanceDto } from './dto/query-attendance.dto';
import { parseTime, toBangkokDate, toBangkokMinutes } from './attendance-time';

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

  // ---------- ตัวช่วยภายใน ----------

  private requireEmployeeId(user: AuthUser): number {
    if (!user.employee_id) {
      throw new BadRequestException(
        'This account is not linked to an employee',
      );
    }
    return user.employee_id;
  }

  private async getActiveEmployeeId(user: AuthUser): Promise<number> {
    const employeeId = this.requireEmployeeId(user);
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee || employee.status === 'resigned') {
      throw new ForbiddenException(
        'Resigned employees cannot record attendance',
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
