import { IsInt, Min, ValidateIf } from 'class-validator';

export class SetManagerDto {
  // ตรวจเฉพาะตอนที่ไม่ใช่ null (null = ถอดหัวหน้า)
  @ValidateIf((o: SetManagerDto) => o.employee_id !== null)
  @IsInt()
  @Min(1)
  employee_id!: number | null;
}
