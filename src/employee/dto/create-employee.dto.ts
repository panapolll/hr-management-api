import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { EmployeeStatus } from '@prisma/client';

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  employee_code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  first_name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  last_name!: string;

  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  @IsOptional()
  @Matches(/^0\d{8,9}$/, {
    message: 'Phone number must start with 0 and have 9-10 digits',
  })
  phone?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  position!: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Salary must be a number with up to 2 decimal places' },
  )
  @Min(0, { message: 'Salary must not be negative' })
  salary!: number;

  @IsDateString({}, { message: 'Date must be in YYYY-MM-DD format' })
  start_date!: string;

  @IsOptional()
  @IsEnum(EmployeeStatus, {
    message: 'status must be active, inactive, on_leave or resigned',
  })
  status?: EmployeeStatus;

  @IsInt()
  @Min(1)
  department_id!: number;
}
