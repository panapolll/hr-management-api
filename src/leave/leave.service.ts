import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LeaveStatus, LeaveType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/current-user.decorator';
import { toBangkokDate } from '../attendance/attendance-time';
import { CreateLeaveDto, QueryMyLeaveDto } from './dto/leave.dto';
import { countWeekdays, toDateOnly } from './leave-days';

// สถานะที่นับว่า "จองโควต้าไว้แล้ว" (รออนุมัติ + อนุมัติแล้ว)
const COUNTED_STATUSES: LeaveStatus[] = ['pending', 'approved'];

@Injectable()
export class LeaveService {
  private readonly quotas: Record<LeaveType, number>;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.quotas = {
      sick: Number(config.get('LEAVE_QUOTA_SICK') ?? 30),
      personal: Number(config.get('LEAVE_QUOTA_PERSONAL') ?? 6),
      vacation: Number(config.get('LEAVE_QUOTA_VACATION') ?? 6),
    };
  }

  async create(user: AuthUser, dto: CreateLeaveDto) {
    const employeeId = this.requireEmployeeId(user);
    const start = toDateOnly(dto.start_date);
    const end = toDateOnly(dto.end_date);

    // 1. ช่วงวันต้องถูกต้อง
    if (end < start) {
      throw new BadRequestException('end_date must be on or after start_date');
    }
    if (start.getUTCFullYear() !== end.getUTCFullYear()) {
      throw new BadRequestException(
        'Leave must start and end in the same year',
      );
    }

    // 2. ต้องมีวันทำงานอย่างน้อย 1 วัน
    const days = countWeekdays(start, end);
    if (days === 0) {
      throw new BadRequestException('Selected dates contain no working days');
    }

    // 3. ห้ามทับกับใบลาที่ยังมีผลอยู่
    const overlap = await this.prisma.leaveRequest.findFirst({
      where: {
        employee_id: employeeId,
        status: { in: COUNTED_STATUSES },
        start_date: { lte: end },
        end_date: { gte: start },
      },
    });
    if (overlap) {
      throw new ConflictException(
        `Overlaps with existing leave request #${overlap.id}`,
      );
    }

    // 4. โควต้าต้องพอ
    const year = start.getUTCFullYear();
    const used = await this.usedDays(employeeId, dto.type, year);
    const remaining = this.quotas[dto.type] - used;
    if (days > remaining) {
      throw new BadRequestException(
        `Not enough ${dto.type} leave: requested ${days} day(s), ${remaining} remaining`,
      );
    }

    return this.prisma.leaveRequest.create({
      data: {
        employee_id: employeeId,
        type: dto.type,
        start_date: start,
        end_date: end,
        days,
        reason: dto.reason,
      },
    });
  }

  findMine(user: AuthUser, query: QueryMyLeaveDto) {
    const employeeId = this.requireEmployeeId(user);

    const where: Prisma.LeaveRequestWhereInput = { employee_id: employeeId };
    if (query.year) where.start_date = this.yearRange(query.year);
    if (query.status) where.status = query.status;

    return this.prisma.leaveRequest.findMany({
      where,
      orderBy: { start_date: 'desc' },
      include: {
        reviewer: { select: { id: true, first_name: true, last_name: true } },
      },
    });
  }

  async cancel(user: AuthUser, id: number) {
    const employeeId = this.requireEmployeeId(user);

    const leave = await this.prisma.leaveRequest.findUnique({ where: { id } });

    // ใบลาของคนอื่นตอบว่า "ไม่พบ" เหมือนกัน จะได้ไม่รู้ว่ามี id นี้อยู่
    if (!leave || leave.employee_id !== employeeId) {
      throw new NotFoundException(`Leave request #${id} not found`);
    }
    if (leave.status !== 'pending') {
      throw new BadRequestException(`Cannot cancel a ${leave.status} request`);
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }

  async getBalance(user: AuthUser, year?: number) {
    const employeeId = this.requireEmployeeId(user);
    const targetYear = year ?? this.currentYear();

    // รวมวันลาแยกตาม ประเภท + สถานะ ในคิวรีเดียว
    const rows = await this.prisma.leaveRequest.groupBy({
      by: ['type', 'status'],
      where: {
        employee_id: employeeId,
        status: { in: COUNTED_STATUSES },
        start_date: this.yearRange(targetYear),
      },
      _sum: { days: true },
    });

    const sumOf = (type: LeaveType, status: LeaveStatus) =>
      rows.find((r) => r.type === type && r.status === status)?._sum.days ?? 0;

    const types = Object.keys(this.quotas) as LeaveType[];
    const balance = types.map((type) => {
      const quota = this.quotas[type];
      const approved = sumOf(type, 'approved');
      const pending = sumOf(type, 'pending');
      return {
        type,
        quota,
        used: approved,
        pending,
        remaining: quota - approved - pending,
      };
    });

    return { year: targetYear, balance };
  }

  // ---------- ตัวช่วยภายใน ----------

  private async usedDays(
    employeeId: number,
    type: LeaveType,
    year: number,
  ): Promise<number> {
    const result = await this.prisma.leaveRequest.aggregate({
      where: {
        employee_id: employeeId,
        type,
        status: { in: COUNTED_STATUSES },
        start_date: this.yearRange(year),
      },
      _sum: { days: true },
    });
    return result._sum.days ?? 0;
  }

  private yearRange(year: number): Prisma.DateTimeFilter {
    return {
      gte: toDateOnly(`${year}-01-01`),
      lte: toDateOnly(`${year}-12-31`),
    };
  }

  private currentYear(): number {
    return toBangkokDate(new Date()).getUTCFullYear();
  }

  private requireEmployeeId(user: AuthUser): number {
    if (!user.employee_id) {
      throw new BadRequestException(
        'This account is not linked to an employee',
      );
    }
    return user.employee_id;
  }
}
