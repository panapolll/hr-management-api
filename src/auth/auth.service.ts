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
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto/auth.dto';
import { BLOCKED_STATUSES } from './jwt.strategy';

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
      throw new ConflictException('This email is already in use');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { email: dto.email },
    });

    // ห้ามสร้างบัญชีให้คนที่ลาออกหรือถูกพักงาน
    if (employee && BLOCKED_STATUSES.includes(employee.status)) {
      throw new BadRequestException(
        `Cannot create an account for a ${employee.status} employee`,
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
      message: 'Account created successfully',
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
      throw new UnauthorizedException('Invalid email or password');
    }

    // เช็คหลังรหัสผ่านถูก เพื่อไม่ให้คนเดาได้ว่าอีเมลไหนถูกระงับ
    if (user.employee && BLOCKED_STATUSES.includes(user.employee.status)) {
      throw new ForbiddenException('This account is suspended');
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

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }

    const isCurrentValid = await bcrypt.compare(
      dto.current_password,
      user.password,
    );
    if (!isCurrentValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.current_password === dto.new_password) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.new_password, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
    return { message: 'Password changed successfully' };
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
      throw new BadRequestException('You cannot change your own role');
    }
    const user = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!user) {
      throw new NotFoundException(`User #${targetId} not found`);
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
