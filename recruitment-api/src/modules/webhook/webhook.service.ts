import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async handleTelegramCandidate(body: Record<string, unknown>, token?: string) {
    const secret = this.config.get<string>('WEBHOOK_SECRET');
    if (secret && token !== secret) {
      throw new UnauthorizedException('Invalid webhook token');
    }

    let data: Record<string, unknown> = body;

    // Support native Telegram bot webhook format (bot sends {update_id, message:{...}})
    if (body.message && typeof body.message === 'object') {
      data = this.parseTelegramMessage(body.message as Record<string, unknown>);
    }

    const fullName = String(data.fullName ?? data.name ?? data.full_name ?? '').trim();
    const phone = String(data.phone ?? data.tel ?? data.telephone ?? '').trim();

    if (!fullName || !phone) {
      return { ok: false, error: 'fullName and phone are required' };
    }

    let assignedRecruiterId =
      String(data.assignedRecruiterId ?? data.recruiterId ?? '').trim() || null;

    if (!assignedRecruiterId) {
      const recruiter = await this.prisma.user.findFirst({
        where: { role: 'recruiter', isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!recruiter) {
        return { ok: false, error: 'No active recruiter found to assign candidate' };
      }
      assignedRecruiterId = recruiter.id;
    }

    const candidate = await this.prisma.candidate.create({
      data: {
        fullName,
        phone,
        email: String(data.email ?? '').trim() || undefined,
        city: String(data.city ?? '').trim() || undefined,
        position: String(data.position ?? data.vacancy ?? '').trim() || undefined,
        source: 'Telegram',
        comment: String(data.comment ?? data.message_text ?? '').trim() || undefined,
        assignedRecruiterId,
      },
    });

    return { ok: true, candidateId: candidate.id, fullName: candidate.fullName };
  }

  private parseTelegramMessage(message: Record<string, unknown>): Record<string, unknown> {
    const text = String(message.text ?? '');
    const result: Record<string, unknown> = {};

    for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
      const colonIdx = line.indexOf(':');
      if (colonIdx < 0) continue;
      const key = line.slice(0, colonIdx).trim().toLowerCase();
      const val = line.slice(colonIdx + 1).trim();
      if (!val) continue;

      if (/піб|пиб|name|прізвище/.test(key)) result.fullName = val;
      else if (/телефон|phone|тел/.test(key)) result.phone = val;
      else if (/місто|city|мiсто/.test(key)) result.city = val;
      else if (/позиц|вакан|position|посад/.test(key)) result.position = val;
      else if (/email/.test(key)) result.email = val;
      else if (/коментар|comment|приміт/.test(key)) result.comment = val;
    }

    // Fallback: use Telegram sender's name when no structured data found
    if (!result.fullName && message.from && typeof message.from === 'object') {
      const from = message.from as Record<string, unknown>;
      const parts = [from.first_name, from.last_name].filter(Boolean);
      if (parts.length) result.fullName = parts.join(' ');
    }

    // Store raw message text as a comment if we still have no comment
    if (!result.comment && text) {
      result.message_text = text;
    }

    return result;
  }
}
