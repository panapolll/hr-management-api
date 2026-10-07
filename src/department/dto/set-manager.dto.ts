import { IsInt, Min, Validate } from 'class-validator';

export class SetManagerDto {
  @Validate((o) => o.manager_id !== null)
  @IsInt()
  @Min(1)
  employee_id!: number;
}
