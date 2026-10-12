import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) {
      throw new ConflictException('อีเมลนี้ถูกใช้งานแล้ว');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { email: dto.email },
    });

    // ห้ามสร้างบัญชีให้คนที่ลาออกไปแล้ว
    if (employee?.status === 'resigned') {
      throw new BadRequestException(
        'ไม่สามารถสร้างบัญชีให้พนักงานที่ลาออกแล้ว',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        employee_id: employee?.id,
      },
    });

    return {
      message: 'สร้างบัญชีสำเร็จ',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        employee_id: user.employee_id,
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { employee: { select: { status: true } } },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    // เช็คหลังรหัสผ่านถูก เพื่อไม่ให้คนเดาได้ว่าอีเมลไหนเป็นของคนลาออก
    if (user.employee?.status === 'resigned') {
      throw new ForbiddenException('บัญชีนี้ถูกระงับเนื่องจากพนักงานลาออกแล้ว');
    }

    return this.buildAuthResponse(user);
  }

  async me(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        employee: {
          select: {
            id: true,
            employee_code: true,
            first_name: true,
            last_name: true,
            position: true,
            department: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }

  findAllUsers() {
    return this.prisma.user.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        email: true,
        role: true,
        employee_id: true,
        created_at: true,
      },
    });
  }

  async updateRole(targetId: number, role: Role, currentUserId: number) {
    if (targetId === currentUserId) {
      throw new BadRequestException('ไม่สามารถเปลี่ยน role ของตัวเองได้');
    }
    const user = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!user) {
      throw new NotFoundException(`ไม่พบผู้ใช้ id ${targetId}`);
    }
    return this.prisma.user.update({
      where: { id: targetId },
      data: { role },
      select: { id: true, email: true, role: true, employee_id: true },
    });
  }

  private buildAuthResponse(user: User) {
    const payload = { sub: user.id };
    return {
      access_token: this.jwt.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        employee_id: user.employee_id,
      },
    };
  }
}
