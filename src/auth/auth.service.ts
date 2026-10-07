import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const exitst = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exitst) {
      throw new ConflictException('อีเมลนี้ถูกใช้งานแล้ว');
    }
    const employee = await this.prisma.employee.findUnique({
      where: { email: dto.email },
    });
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
    });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
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

  private buildAuthResponse(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
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
