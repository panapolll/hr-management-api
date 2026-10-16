import { LeaveStatus, LeaveType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateLeaveDto {
  @IsEnum(LeaveType)
  type!: LeaveType;

  @IsDateString()
  start_date!: string;

  @IsDateString()
  end_date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class QueryMyLeaveDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsEnum(LeaveStatus)
  status?: LeaveStatus;
}
