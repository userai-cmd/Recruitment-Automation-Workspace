import { IsEmail, IsOptional, IsString, IsUUID, Matches, MinLength } from 'class-validator';

export class CreateCandidateDto {
  @IsString()
  @MinLength(3)
  @Matches(/\S+\s+\S+/, { message: 'fullName must include first name and last name' })
  fullName!: string;

  @IsString()
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsUUID()
  vacancyId?: string;

  @IsUUID()
  assignedRecruiterId!: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
