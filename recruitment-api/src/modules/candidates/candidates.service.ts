import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';

const STATUS_LABELS: Record<string, string> = {
  new: 'Новий',
  contacted: 'Контакт',
  interview: 'Співбесіда',
  offer: 'Офер',
  hired: 'Оформлений',
  rejected: 'Відхилений',
};

const STATUS_ORDER = ['new', 'contacted', 'interview', 'offer', 'hired', 'rejected'];

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

  async update(id: string, dto: UpdateCandidateDto, actorId: string) {
    await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.candidate.update({
        where: { id },
        data: {
          fullName: dto.fullName,
          phone: dto.phone,
          email: dto.email,
          city: dto.city,
          position: dto.position,
          source: dto.source,
          comment: dto.comment,
          status: dto.status as any,
        },
      });

      await tx.activityLog.create({
        data: {
          entityType: 'candidate',
          entityId: id,
          action: 'update',
          payload: dto as any,
          actorUserId: actorId,
        },
      });

      return updated;
    });
  }

  async archive(id: string, actorId: string) {
    await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.candidate.update({
        where: { id },
        data: { isDeleted: true },
      });

      await tx.activityLog.create({
        data: {
          entityType: 'candidate',
          entityId: id,
          action: 'archive',
          payload: { isDeleted: true } as any,
          actorUserId: actorId,
        },
      });

      return updated;
    });
  }

  async getKpiOverview(recruiterId: string) {
    const candidates = await this.prisma.candidate.findMany({
      where: {
        assignedRecruiterId: recruiterId,
        isDeleted: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    const byStatus = {
      new: 0,
      contacted: 0,
      interview: 0,
      offer: 0,
      hired: 0,
      rejected: 0,
    } as Record<string, number>;

    const bySource = new Map<string, number>();
    const byPosition = new Map<string, number>();
    const todayIso = new Date().toISOString().slice(0, 10);
    let todayCount = 0;

    for (const c of candidates) {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      if ((c.createdAt?.toISOString?.() || '').slice(0, 10) === todayIso) {
        todayCount += 1;
      }
      const sourceKey = (c.source || 'Інше').trim();
      bySource.set(sourceKey, (bySource.get(sourceKey) || 0) + 1);

      const positionKey = (c.position || 'Без позиції').trim();
      byPosition.set(positionKey, (byPosition.get(positionKey) || 0) + 1);
    }

    const total = candidates.length;
    const hired = byStatus.hired || 0;
    const rejected = byStatus.rejected || 0;
    const interview = byStatus.interview || 0;
    const conversion = total ? Math.round((hired / total) * 100) : 0;
    const rejectionRate = total ? Math.round((rejected / total) * 100) : 0;

    const mapToSorted = (m: Map<string, number>, limit: number) =>
      Array.from(m.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([label, value]) => ({ label, value }));

    return {
      summary: {
        total,
        hired,
        conversion,
        interview,
        rejected,
        rejectionRate,
        today: todayCount,
      },
      funnel: STATUS_ORDER.map((status) => ({
        stage: STATUS_LABELS[status],
        value: byStatus[status] || 0,
      })),
      byStatus: STATUS_ORDER.map((status) => ({
        label: STATUS_LABELS[status],
        value: byStatus[status] || 0,
      })),
      bySource: mapToSorted(bySource, 10),
      topPositions: mapToSorted(byPosition, 8),
    };
  }
}
