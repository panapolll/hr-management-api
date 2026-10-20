import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { calculatePayslip, PayrollSettings } from './payroll-calc';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { GeneratePayrollDto } from './dto/payroll.dto';
import { AuthUser } from '../auth/current-user.decorator';

@Injectable()
export class PayrollService {
  private readonly settings: PayrollSettings;
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.settings = {
      daysPerMonth: Number(config.get('PAYROLL_DAYS_PER_MONTH') ?? 30),
      hoursPerDay: Number(config.get('PAYROLL_HOURS_PER_DAY') ?? 8),
      graceMinutes: Number(config.get('LATE_GRACE_MINUTES') ?? 30),
      socialSecurityRate: Number(config.get('SOCIAL_SECURITY_RATE') ?? 0.05),
      socialSecurityMax: Number(config.get('SOCIAL_SECURITY_MAX') ?? 750),
    };
  }

  async generate(dto: GeneratePayrollDto, user: AuthUser) {
    const { year, month } = dto;

    const existing = await this.prisma.payrollRun.findUnique({
      where: { year_month: { year, month } },
    });
    if (existing?.status === 'finalized') {
      throw new ConflictException(
        `Payroll for ${year}-${month} is already finalized`,
      );
    }
    const firstDay = new Date(Date.UTC(year, month - 1, 1));
    const lastDay = new Date(Date.UTC(year, month, 0));

    const employees = await this.prisma.employee.findMany({
      where: { status: { not: 'resigned' }, start_date: { lte: lastDay } },
      select: {
        id: true,
        salary: true,
        attendances: {
          where: { work_date: { gte: firstDay, lte: lastDay } },
          select: { late_minutes: true },
        },
      },
    });

    const payslips = employees.map((employee) => ({
      employee_id: employee.id,
      ...calculatePayslip(
        employee.salary,
        employee.attendances.map((a) => a.late_minutes),
        this.settings,
      ),
    }));

    return this.prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.upsert({
        where: { year_month: { year, month } },
        create: { year, month, created_by_id: user.id },
        update: {},
      });

      await tx.payslip.deleteMany({ where: { payroll_run_id: run.id } });
      await tx.payslip.createMany({
        data: payslips.map((p) => ({ ...p, payroll_run_id: run.id })),
      });

      return {
        message: existing ? 'Payroll recalculated' : 'Payroll created',
        payroll_run: run,
        employee_count: payslips.length,
      };
    });
  }
  async finalize(id: number, user: AuthUser) {
    const run = await this.prisma.payrollRun.findUnique({ where: { id } });
    if (!run) {
      throw new NotFoundException(`Payroll run #${id} not found`);
    }

    const result = await this.prisma.payrollRun.updateMany({
      where: { id, status: 'draft' },
      data: {
        status: 'finalized',
        finalized_by_id: user.id,
        finalized_at: new Date(),
      },
    });
    if (result.count === 0) {
      throw new ConflictException(`Payroll run #${id} is already finalized`);
    }
    return this.prisma.payrollRun.findUnique({ where: { id } });
  }

  findAll() {
    return this.prisma.payrollRun.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: { _count: { select: { payslips: true } } },
    });
  }

  async findOne(id: number) {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id },
      include: {
        payslips: {
          orderBy: { employee: { employee_code: 'asc' } },
          include: {
            employee: {
              select: {
                id: true,
                employee_code: true,
                first_name: true,
                last_name: true,
                department: { select: { code: true, name: true } },
              },
            },
          },
        },
      },
    });
    if (!run) {
      throw new NotFoundException(`Payroll run #${id} not found`);
    }

    const totals = await this.prisma.payslip.aggregate({
      where: { payroll_run_id: id },
      _sum: {
        base_salary: true,
        late_deduction: true,
        social_security: true,
        net_pay: true,
      },
    });
    return { ...run, totals: totals._sum };
  }

  findMyPayslips(user: AuthUser) {
    if (!user.employee_id) {
      throw new ForbiddenException('This account is not linked to an employee');
    }

    return this.prisma.payslip.findMany({
      where: {
        employee_id: user.employee_id,
        payroll_run: { status: 'finalized' },
      },
      orderBy: [
        { payroll_run: { year: 'desc' } },
        { payroll_run: { month: 'desc' } },
      ],
      include: {
        payroll_run: {
          select: { year: true, month: true, finalized_at: true },
        },
      },
    });
  }
}
