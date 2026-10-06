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

  @IsEmail({}, { message: 'รูปแบบอีเมลไม่ถูกต้อง' })
  email!: string;

  @IsOptional()
  @Matches(/^0\d{8,9}$/, {
    message: 'เบอร์โทรต้องขึ้นต้นด้วย 0 และมี 9-10 หลัก',
  })
  phone?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  position!: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'เงินเดือนต้องเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง' },
  )
  @Min(0, { message: 'เงินเดือนห้ามติดลบ' })
  salary!: number;

  @IsDateString({}, { message: 'วันที่ต้องอยู่ในรูปแบบ YYYY-MM-DD' })
  start_date!: string;

  @IsOptional()
  @IsEnum(EmployeeStatus, {
    message: 'status ต้องเป็น active, inactive, on_leave หรือ resigned',
  })
  status?: EmployeeStatus;

  @IsInt()
  @Min(1)
  department_id!: number;
}
