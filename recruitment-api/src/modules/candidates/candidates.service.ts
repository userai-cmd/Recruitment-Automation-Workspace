import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { ChangeStatusDto } from './dto/change-status.dto';

@Injectable()
export class CandidatesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: { status?: string; recruiterId?: string }) {
    return this.prisma.candidate.findMany({
      where: {
        status: query.status as any,
        assignedRecruiterId: query.recruiterId,
        isDeleted: false,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(dto: CreateCandidateDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const candidate = await tx.candidate.create({
        data: {
          ...dto,
          source: dto.source ?? 'other',
        },
      });

      await tx.activityLog.create({
        data: {
          entityType: 'candidate',
          entityId: candidate.id,
          action: 'create',
          payload: candidate as any,
          actorUserId: actorId,
        },
      });

      return candidate;
    });
  }

  async findOne(id: string) {
    const candidate = await this.prisma.candidate.findUnique({ where: { id } });
    if (!candidate || candidate.isDeleted) {
      throw new NotFoundException('Candidate not found');
    }
    return candidate;
  }

  async changeStatus(id: string, dto: ChangeStatusDto, actorId: string) {
    const candidate = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.candidate.update({
        where: { id },
        data: { status: dto.toStatus },
      });

      await tx.candidateStatusHistory.create({
        data: {
          candidateId: id,
          fromStatus: candidate.status as any,
          toStatus: dto.toStatus as any,
          changedByUserId: actorId,
          reason: dto.reason,
        },
      });

      await tx.activityLog.create({
        data: {
          entityType: 'candidate',
          entityId: id,
          action: 'status_change',
          payload: {
            fromStatus: candidate.status,
            toStatus: dto.toStatus,
            reason: dto.reason ?? null,
          } as any,
          actorUserId: actorId,
        },
      });

      return updated;
    });
  }
}
