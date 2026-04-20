import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CandidatesService } from './candidates.service';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';

@UseGuards(JwtAuthGuard)
@Controller('candidates')
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Get()
  findAll(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
    @Query('recruiterId') recruiterId?: string,
  ) {
    const effectiveRecruiterId = user.role === 'admin' ? recruiterId : user.id;
    return this.candidatesService.findAll({ status, recruiterId: effectiveRecruiterId });
  }

  @Post()
  create(@Body() dto: CreateCandidateDto, @CurrentUser() user: JwtUser) {
    const assignedRecruiterId = user.role === 'admin' ? dto.assignedRecruiterId : user.id;
    return this.candidatesService.create({ ...dto, assignedRecruiterId }, user.id);
  }

  @Get('kpi/overview')
  getKpiOverview(
    @CurrentUser() user: JwtUser,
    @Query('period') period?: string,
    @Query('date') date?: string,
    @Query('recruiterId') recruiterId?: string,
  ) {
    const effectiveRecruiterId = user.role === 'admin' ? recruiterId : user.id;
    return this.candidatesService.getKpiOverview(effectiveRecruiterId, period, date);
  }

  @Get('motivation/overview')
  getMotivationOverview(
    @CurrentUser() user: JwtUser,
    @Query('period') period?: string,
    @Query('date') date?: string,
    @Query('recruiterId') recruiterId?: string,
  ) {
    const effectiveRecruiterId = user.role === 'admin' ? recruiterId : user.id;
    return this.candidatesService.getMotivationOverview(effectiveRecruiterId, period, date);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.candidatesService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCandidateDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.candidatesService.update(id, dto, user);
  }

  @Patch(':id/status')
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.candidatesService.changeStatus(id, dto, user);
  }

  @Delete(':id')
  archive(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.candidatesService.archive(id, user);
  }
}
