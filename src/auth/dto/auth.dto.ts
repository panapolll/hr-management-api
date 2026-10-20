import { Role } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password!: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class UpdateRoleDto {
  @IsEnum(Role, { message: 'role must be ADMIN, HR, MANAGER or EMPLOYEE' })
  role!: Role;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  current_password!: string;

  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  new_password!: string;
}
