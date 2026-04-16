import { IsIn, IsOptional, IsString } from 'class-validator';

export class ChangeStatusDto {
  @IsIn(['new', 'contacted', 'interview', 'offer', 'hired', 'rejected'])
  toStatus!: 'new' | 'contacted' | 'interview' | 'offer' | 'hired' | 'rejected';

  @IsOptional()
  @IsString()
  reason?: string;
}
