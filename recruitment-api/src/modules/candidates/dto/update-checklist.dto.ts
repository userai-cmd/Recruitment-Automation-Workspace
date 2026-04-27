import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateChecklistDto {
  @IsString()
  status!: string;

  @IsObject()
  items!: Record<string, boolean>;

  @IsOptional()
  @IsString()
  note?: string;
}
