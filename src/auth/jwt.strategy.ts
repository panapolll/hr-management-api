import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { EmployeeStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './current-user.decorator';

type JwtPayload = { sub: number };

// สถานะที่ห้ามใช้ระบบ
export const BLOCKED_STATUSES: EmployeeStatus[] = ['inactive', 'resigned'];

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        employee_id: true,
        employee: { select: { status: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }
    if (user.employee && BLOCKED_STATUSES.includes(user.employee.status)) {
      throw new UnauthorizedException('This account is suspended');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      employee_id: user.employee_id,
    };
  }
}
