import { Role } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'รูปแบบอีเมลไม่ถูกต้อง' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร' })
  password!: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'รูปแบบอีเมลไม่ถูกต้อง' })
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class UpdateRoleDto {
  @IsEnum(Role, { message: 'role ต้องเป็น ADMIN, HR, MANAGER หรือ EMPLOYEE' })
  role!: Role;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'กรุณากรอกรหัสผ่านเดิม' })
  current_password!: string;

  @IsString()
  @MinLength(8, { message: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร' })
  new_password!: string;
}
