import { IsIn, IsOptional, IsString } from 'class-validator';

export class ChangeStatusDto {
  @IsIn(['new', 'contacted', 'interview', 'offer', 'hired', 'sb_failed', 'rejected'])
  toStatus!: 'new' | 'contacted' | 'interview' | 'offer' | 'hired' | 'sb_failed' | 'rejected';

  @IsOptional()
  @IsString()
  reason?: string;
}
