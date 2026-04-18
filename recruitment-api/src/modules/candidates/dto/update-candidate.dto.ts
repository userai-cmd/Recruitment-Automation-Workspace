import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateCandidateDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

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
  @IsString()
  comment?: string;

  @IsOptional()
  @IsIn(['new', 'contacted', 'interview', 'offer', 'hired', 'rejected'])
  status?: 'new' | 'contacted' | 'interview' | 'offer' | 'hired' | 'rejected';
}
