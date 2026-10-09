import { EmployeeStatus, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`กรุณาตั้งค่า ${name} ใน .env ก่อนรัน seed`);
  }
  return value;
}

// ---------- ข้อมูลตั้งต้น ----------

const departments = [
  { code: 'IT', name: 'Information Technology', description: 'ฝ่ายไอที' },
  { code: 'HR', name: 'Human Resources', description: 'ฝ่ายบุคคล' },
  { code: 'FIN', name: 'Finance', description: 'ฝ่ายการเงิน' },
];

type SeedEmployee = {
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  position: string;
  salary: number;
  start_date: string;
  status?: EmployeeStatus;
  department: string;
};

const employees: SeedEmployee[] = [
  {
    employee_code: 'EMP0001',
    first_name: 'สมชาย',
    last_name: 'ใจดี',
    email: 'somchai@company.com',
    phone: '0812345678',
    position: 'Backend Developer',
    salary: 38000,
    start_date: '2026-01-15',
    department: 'IT',
  },
  {
    employee_code: 'EMP0002',
    first_name: 'สมหญิง',
    last_name: 'รักงาน',
    email: 'somying@company.com',
    phone: '0823456789',
    position: 'HR Officer',
    salary: 28000,
    start_date: '2026-03-01',
    department: 'HR',
  },
  {
    employee_code: 'EMP0003',
    first_name: 'วิภา',
    last_name: 'สุขสันต์',
    email: 'wipa@company.com',
    phone: '0834567890',
    position: 'HR Manager',
    salary: 55000,
    start_date: '2024-06-10',
    department: 'HR',
  },
  {
    employee_code: 'EMP0004',
    first_name: 'ธนากร',
    last_name: 'ศรีสมบูรณ์',
    email: 'thanakorn@company.com',
    phone: '0845678901',
    position: 'Frontend Developer',
    salary: 32000,
    start_date: '2025-09-01',
    status: 'on_leave',
    department: 'IT',
  },
  {
    employee_code: 'EMP0005',
    first_name: 'ปิยะ',
    last_name: 'มั่นคง',
    email: 'piya@company.com',
    phone: '0856789012',
    position: 'IT Manager',
    salary: 70000,
    start_date: '2023-02-15',
    department: 'IT',
  },
  {
    employee_code: 'EMP0006',
    first_name: 'กมลวรรณ',
    last_name: 'ทองดี',
    email: 'kamonwan@company.com',
    phone: '0867890123',
    position: 'Finance Manager',
    salary: 60000,
    start_date: '2025-04-20',
    department: 'FIN',
  },
  {
    employee_code: 'EMP0007',
    first_name: 'ประเสริฐ',
    last_name: 'วงศ์ใหญ่',
    email: 'prasert@company.com',
    position: 'Accountant',
    salary: 35000,
    start_date: '2022-11-01',
    status: 'resigned',
    department: 'FIN',
  },
  {
    employee_code: 'EMP0008',
    first_name: 'ทดสอบ',
    last_name: 'สิทธิ์',
    email: 'test@company.com',
    position: 'QA Tester',
    salary: 20000,
    start_date: '2026-10-01',
    department: 'IT',
  },
];

// หัวหน้าแต่ละแผนก (รหัสแผนก → รหัสพนักงาน)
const managers: Record<string, string> = {
  IT: 'EMP0005',
  HR: 'EMP0003',
  FIN: 'EMP0006',
};

// บัญชีผู้ใช้ ครบทุก role
const users: { email: string; role: Role }[] = [
  { email: 'admin@company.com', role: 'ADMIN' },
  { email: 'wipa@company.com', role: 'HR' },
  { email: 'somying@company.com', role: 'HR' },
  { email: 'piya@company.com', role: 'MANAGER' },
  { email: 'kamonwan@company.com', role: 'MANAGER' },
  { email: 'somchai@company.com', role: 'EMPLOYEE' },
];

// ---------- รัน seed ----------

async function main() {
  const adminPassword = await bcrypt.hash(
    requireEnv('SEED_ADMIN_PASSWORD'),
    10,
  );
  const userPassword = await bcrypt.hash(requireEnv('SEED_USER_PASSWORD'), 10);

  // 1. แผนก
  const departmentIds: Record<string, number> = {};
  for (const dept of departments) {
    const saved = await prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: dept,
    });
    departmentIds[dept.code] = saved.id;
  }
  console.log(`✔ แผนก ${departments.length} แผนก`);

  // 2. พนักงาน
  const employeeIds: Record<string, number> = {};
  for (const { department, start_date, ...emp } of employees) {
    const saved = await prisma.employee.upsert({
      where: { employee_code: emp.employee_code },
      update: {},
      create: {
        ...emp,
        start_date: new Date(start_date),
        department_id: departmentIds[department],
      },
    });
    employeeIds[emp.employee_code] = saved.id;
  }
  console.log(`✔ พนักงาน ${employees.length} คน`);

  // 3. หัวหน้าแผนก
  for (const [deptCode, employeeCode] of Object.entries(managers)) {
    await prisma.department.update({
      where: { code: deptCode },
      data: { manager_id: employeeIds[employeeCode] },
    });
  }
  console.log('✔ ตั้งหัวหน้าแผนกครบ');

  // 4. บัญชีผู้ใช้ (ผูกกับพนักงานอัตโนมัติจากอีเมล เหมือนตอน register)
  for (const user of users) {
    const employee = await prisma.employee.findUnique({
      where: { email: user.email },
    });
    await prisma.user.upsert({
      where: { email: user.email },
      update: { role: user.role },
      create: {
        email: user.email,
        password: user.role === 'ADMIN' ? adminPassword : userPassword,
        role: user.role,
        employee_id: employee?.id,
      },
    });
  }
  console.log(`✔ บัญชีผู้ใช้ ${users.length} บัญชี`);
}

main()
  .then(() => console.log('🎉 seed เสร็จแล้ว'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
