import { IsDateString, IsOptional } from 'class-validator';

export class QueryMyAttendanceDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
