import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description?: string;
}
