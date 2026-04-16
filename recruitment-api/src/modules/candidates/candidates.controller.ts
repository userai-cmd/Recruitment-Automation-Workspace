import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CandidatesService } from './candidates.service';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CreateCandidateDto } from './dto/create-candidate.dto';

@UseGuards(JwtAuthGuard)
@Controller('candidates')
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('recruiterId') recruiterId?: string,
  ) {
    return this.candidatesService.findAll({ status, recruiterId });
  }

  @Post()
  create(@Body() dto: CreateCandidateDto, @CurrentUser() user: JwtUser) {
    return this.candidatesService.create(dto, user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.candidatesService.findOne(id);
  }

  @Patch(':id/status')
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.candidatesService.changeStatus(id, dto, user.id);
  }
}
