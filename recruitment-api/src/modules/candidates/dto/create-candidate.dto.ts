import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCandidateDto {
  @IsString()
  fullName: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsUUID()
  vacancyId?: string;

  @IsUUID()
  assignedRecruiterId: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
