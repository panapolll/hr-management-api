import { Prisma } from '@prisma/client';

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

export type PayrollSettings = {
  daysPerMonth: number;
  hoursPerDay: number;
  graceMinutes: number;
  socialSecurityRate: number;
  socialSecurityMax: number;
};

export type PayslipAmount = {
  base_salary: Decimal;
  late_days: number;
  late_minutes: number;
  late_deduction: Decimal;
  social_security: Decimal;
  net_pay: Decimal;
};

export function calculatePayslip(
  salary: Decimal,
  lateMinutesPerDay: number[],
  settings: PayrollSettings,
): PayslipAmount {
  const countedDays = lateMinutesPerDay.filter(
    (minutes) => minutes > settings.graceMinutes,
  );
  const lateMinutes = countedDays.reduce((sum, minutes) => sum + minutes, 0);

  const perMinutes = salary
    .div(settings.daysPerMonth)
    .div(settings.hoursPerDay)
    .div(60);
  const lateDeduction = perMinutes.mul(lateMinutes).toDecimalPlaces(2);

  const socialSecurity = Decimal.min(
    salary.mul(settings.socialSecurityRate),
    settings.socialSecurityMax,
  ).toDecimalPlaces(2);

  const netPay = Decimal.max(salary.sub(lateDeduction).sub(socialSecurity), 0);
  return {
    base_salary: salary,
    late_days: countedDays.length,
    late_minutes: lateMinutes,
    late_deduction: lateDeduction,
    social_security: socialSecurity,
    net_pay: netPay,
  };
}
