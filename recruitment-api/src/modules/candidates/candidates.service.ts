import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { JwtUser } from '../../common/decorators/current-user.decorator';

const STATUS_LABELS: Record<string, string> = {
  new: 'Новий',
  contacted: 'Контакт',
  interview: 'Співбесіда',
  offer: 'Офер',
  hired: 'Оформлений',
  sb_failed: 'Не пройшов СБ',
  rejected: 'Відхилений',
};

const STATUS_ORDER = ['new', 'contacted', 'interview', 'offer', 'hired', 'sb_failed', 'rejected'];
const KPI_PERIODS = ['day', 'week', 'month', 'quarter', 'year'] as const;
type KpiPeriod = (typeof KPI_PERIODS)[number];
const REFERRAL_SOURCES = new Set(['рекомендація', 'referral', 'recommendation']);
const HIRED_BONUS_UAH = 800;
const SB_FAILED_BONUS_UAH = 400;

@Injectable()
export class CandidatesService {
  constructor(private readonly prisma: PrismaService) {}

  private parsePeriod(period?: string): KpiPeriod {
    if (period && KPI_PERIODS.includes(period as KpiPeriod)) {
      return period as KpiPeriod;
    }
    return 'month';
  }

  private parseAnchorDate(input?: string): Date {
    if (!input) return new Date();
    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) return new Date();
    return parsed;
  }

  private startOfDayUtc(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
  }

  private addDaysUtc(date: Date, days: number) {
    const copy = new Date(date);
    copy.setUTCDate(copy.getUTCDate() + days);
    return copy;
  }

  private getRange(period: KpiPeriod, anchorDate: Date) {
    const dayStart = this.startOfDayUtc(anchorDate);
    if (period === 'day') {
      return { from: dayStart, to: this.addDaysUtc(dayStart, 1) };
    }
    if (period === 'week') {
      // Monday-based week.
      const day = dayStart.getUTCDay(); // 0=Sun..6=Sat
      const mondayOffset = (day + 6) % 7;
      const from = this.addDaysUtc(dayStart, -mondayOffset);
      return { from, to: this.addDaysUtc(from, 7) };
    }
    if (period === 'month') {
      const from = new Date(Date.UTC(dayStart.getUTCFullYear(), dayStart.getUTCMonth(), 1, 0, 0, 0, 0));
      return { from, to: new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1, 0, 0, 0, 0)) };
    }
    if (period === 'quarter') {
      const quarterStartMonth = Math.floor(dayStart.getUTCMonth() / 3) * 3;
      const from = new Date(Date.UTC(dayStart.getUTCFullYear(), quarterStartMonth, 1, 0, 0, 0, 0));
      return { from, to: new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 3, 1, 0, 0, 0, 0)) };
    }
    const from = new Date(Date.UTC(dayStart.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
    return { from, to: new Date(Date.UTC(dayStart.getUTCFullYear() + 1, 0, 1, 0, 0, 0, 0)) };
  }

  private previousRange(from: Date, to: Date) {
    const duration = to.getTime() - from.getTime();
    return {
      from: new Date(from.getTime() - duration),
      to: new Date(from.getTime()),
    };
  }

  private percentChange(current: number, previous: number) {
    if (!previous) return current ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  private async computeSummaryForRange(recruiterId: string | undefined, from: Date, to: Date) {
    const [createdCount, changedRows] = await Promise.all([
      this.prisma.candidate.count({
        where: {
          assignedRecruiterId: recruiterId || undefined,
          isDeleted: false,
          createdAt: { gte: from, lt: to },
        },
      }),
      this.prisma.candidateStatusHistory.findMany({
        where: {
          changedByUserId: recruiterId || undefined,
          changedAt: { gte: from, lt: to },
        },
        select: { toStatus: true },
      }),
    ]);

    const byStatus = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<string, number>;
    byStatus.new += createdCount;
    for (const row of changedRows) {
      const status = String(row.toStatus);
      if (byStatus[status] !== undefined) byStatus[status] += 1;
    }

    const total = createdCount + changedRows.length;
    const hired = byStatus.hired || 0;
    const rejected = byStatus.rejected || 0;
    const interview = byStatus.interview || 0;
    const conversion = total ? Math.round((hired / total) * 100) : 0;
    const rejectionRate = total ? Math.round((rejected / total) * 100) : 0;

    return {
      total,
      hired,
      interview,
      rejected,
      conversion,
      rejectionRate,
      byStatus,
    };
  }

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

  private assertCanAccessCandidate(user: JwtUser, candidate: { assignedRecruiterId: string }) {
    if (user.role === 'admin') return;
    if (candidate.assignedRecruiterId !== user.id) {
      throw new ForbiddenException('Access denied for this candidate');
    }
  }

  async findOne(id: string, user?: JwtUser) {
    const candidate = await this.prisma.candidate.findUnique({ where: { id } });
    if (!candidate || candidate.isDeleted) {
      throw new NotFoundException('Candidate not found');
    }
    if (user) this.assertCanAccessCandidate(user, candidate);
    return candidate;
  }

  async changeStatus(id: string, dto: ChangeStatusDto, actor: JwtUser) {
    const candidate = await this.findOne(id, actor);

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
          changedByUserId: actor.id,
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
          actorUserId: actor.id,
        },
      });

      return updated;
    });
  }

  async update(id: string, dto: UpdateCandidateDto, actor: JwtUser) {
    await this.findOne(id, actor);

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
          actorUserId: actor.id,
        },
      });

      return updated;
    });
  }

  async archive(id: string, actor: JwtUser) {
    await this.findOne(id, actor);

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
          actorUserId: actor.id,
        },
      });

      return updated;
    });
  }

  async getKpiOverview(recruiterId: string | undefined, periodInput?: string, dateInput?: string) {
    const period = this.parsePeriod(periodInput);
    const anchorDate = this.parseAnchorDate(dateInput);
    const currentRange = this.getRange(period, anchorDate);
    const prevRange = this.previousRange(currentRange.from, currentRange.to);

    const [currentSummary, prevSummary, createdCandidates] = await Promise.all([
      this.computeSummaryForRange(recruiterId, currentRange.from, currentRange.to),
      this.computeSummaryForRange(recruiterId, prevRange.from, prevRange.to),
      this.prisma.candidate.findMany({
        where: {
          assignedRecruiterId: recruiterId || undefined,
          isDeleted: false,
          createdAt: { gte: currentRange.from, lt: currentRange.to },
        },
        select: {
          source: true,
          position: true,
        },
      }),
    ]);

    const bySource = new Map<string, number>();
    const byPosition = new Map<string, number>();
    for (const c of createdCandidates) {
      const sourceKey = (c.source || 'Інше').trim();
      bySource.set(sourceKey, (bySource.get(sourceKey) || 0) + 1);
      const positionKey = (c.position || 'Без позиції').trim();
      byPosition.set(positionKey, (byPosition.get(positionKey) || 0) + 1);
    }

    const mapToSorted = (m: Map<string, number>, limit: number) =>
      Array.from(m.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([label, value]) => ({ label, value }));

    return {
      summary: {
        total: currentSummary.total,
        hired: currentSummary.hired,
        conversion: currentSummary.conversion,
        interview: currentSummary.interview,
        rejected: currentSummary.rejected,
        rejectionRate: currentSummary.rejectionRate,
        totalChangePct: this.percentChange(currentSummary.total, prevSummary.total),
        hiredChangePct: this.percentChange(currentSummary.hired, prevSummary.hired),
        conversionChangePct: this.percentChange(currentSummary.conversion, prevSummary.conversion),
        interviewChangePct: this.percentChange(currentSummary.interview, prevSummary.interview),
        rejectedChangePct: this.percentChange(currentSummary.rejected, prevSummary.rejected),
        rejectionRateChangePct: this.percentChange(currentSummary.rejectionRate, prevSummary.rejectionRate),
      },
      period: {
        key: period,
        from: currentRange.from.toISOString(),
        to: currentRange.to.toISOString(),
        prevFrom: prevRange.from.toISOString(),
        prevTo: prevRange.to.toISOString(),
      },
      funnel: STATUS_ORDER.map((status) => ({
        stage: STATUS_LABELS[status],
        value: currentSummary.byStatus[status] || 0,
      })),
      byStatus: STATUS_ORDER.map((status) => ({
        label: STATUS_LABELS[status],
        value: currentSummary.byStatus[status] || 0,
      })),
      bySource: mapToSorted(bySource, 10),
      topPositions: mapToSorted(byPosition, 8),
    };
  }

  async getMotivationOverview(recruiterId: string | undefined, periodInput?: string, dateInput?: string) {
    const period = this.parsePeriod(periodInput);
    const anchorDate = this.parseAnchorDate(dateInput);
    const currentRange = this.getRange(period, anchorDate);
    const prevRange = this.previousRange(currentRange.from, currentRange.to);

    const [currentHiredRows, currentSbRows, prevHiredRows, prevSbRows] = await Promise.all([
      this.prisma.candidateStatusHistory.findMany({
        where: {
          changedByUserId: recruiterId || undefined,
          toStatus: 'hired',
          changedAt: { gte: currentRange.from, lt: currentRange.to },
        },
        select: {
          candidateId: true,
          changedAt: true,
          candidate: {
            select: { fullName: true, source: true },
          },
        },
      }),
      this.prisma.candidateStatusHistory.findMany({
        where: {
          changedByUserId: recruiterId || undefined,
          toStatus: 'sb_failed',
          changedAt: { gte: currentRange.from, lt: currentRange.to },
        },
        select: {
          candidateId: true,
          changedAt: true,
          candidate: {
            select: { fullName: true, source: true },
          },
        },
      }),
      this.prisma.candidateStatusHistory.findMany({
        where: {
          changedByUserId: recruiterId || undefined,
          toStatus: 'hired',
          changedAt: { gte: prevRange.from, lt: prevRange.to },
        },
        select: {
          candidateId: true,
          candidate: {
            select: { source: true },
          },
        },
      }),
      this.prisma.candidateStatusHistory.findMany({
        where: {
          changedByUserId: recruiterId || undefined,
          toStatus: 'sb_failed',
          changedAt: { gte: prevRange.from, lt: prevRange.to },
        },
        select: { candidateId: true },
      }),
    ]);

    const distinctByCandidate = <T extends { candidateId: string }>(rows: T[]) => {
      const map = new Map<string, T>();
      for (const row of rows) map.set(row.candidateId, row);
      return Array.from(map.values());
    };
    const isReferral = (source?: string | null) => REFERRAL_SOURCES.has((source || '').trim().toLowerCase());

    const currentHiredDistinctAll = distinctByCandidate(currentHiredRows);
    const currentHiredReferralDistinct = currentHiredDistinctAll.filter((r) => isReferral(r.candidate?.source));
    const currentHiredDistinct = currentHiredDistinctAll.filter((r) => !isReferral(r.candidate?.source));
    const currentSbDistinct = distinctByCandidate(currentSbRows);
    const prevHiredDistinct = distinctByCandidate(prevHiredRows).filter((r) => !isReferral(r.candidate?.source));
    const prevSbDistinct = distinctByCandidate(prevSbRows);

    const hiredCount = currentHiredDistinct.length;
    const sbFailedCount = currentSbDistinct.length;
    const hiredBonus = hiredCount * HIRED_BONUS_UAH;
    const sbFailedBonus = sbFailedCount * SB_FAILED_BONUS_UAH;
    const totalBonus = hiredBonus + sbFailedBonus;

    const prevTotalBonus = prevHiredDistinct.length * HIRED_BONUS_UAH + prevSbDistinct.length * SB_FAILED_BONUS_UAH;
    const totalChangePct = this.percentChange(totalBonus, prevTotalBonus);

    const details = [
      ...currentHiredDistinct.map((row) => ({
        candidateId: row.candidateId,
        candidateName: row.candidate?.fullName || 'Кандидат',
        reason: 'Оформлений співробітник',
        amount: HIRED_BONUS_UAH,
        changedAt: row.changedAt.toISOString(),
      })),
      ...currentSbDistinct.map((row) => ({
        candidateId: row.candidateId,
        candidateName: row.candidate?.fullName || 'Кандидат',
        reason: 'Не пройшов перевірку СБ',
        amount: SB_FAILED_BONUS_UAH,
        changedAt: row.changedAt.toISOString(),
      })),
    ].sort((a, b) => b.changedAt.localeCompare(a.changedAt));

    return {
      period: {
        key: period,
        from: currentRange.from.toISOString(),
        to: currentRange.to.toISOString(),
      },
      summary: {
        hiredCount,
        hiredReferralCount: currentHiredReferralDistinct.length,
        sbFailedCount,
        hiredBonus,
        sbFailedBonus,
        totalBonus,
        totalChangePct,
      },
      rules: {
        hiredBonusPerCandidate: HIRED_BONUS_UAH,
        sbFailedBonusPerCandidate: SB_FAILED_BONUS_UAH,
        excludeReferralForHired: true,
      },
      details,
      referrals: currentHiredReferralDistinct
        .map((row) => ({
          candidateId: row.candidateId,
          candidateName: row.candidate?.fullName || 'Кандидат',
          source: row.candidate?.source || 'Рекомендація',
          changedAt: row.changedAt.toISOString(),
          excludedFromBonus: true,
        }))
        .sort((a, b) => b.changedAt.localeCompare(a.changedAt)),
    };
  }
}
