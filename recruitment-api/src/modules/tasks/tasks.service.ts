import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { JwtUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateTaskDto, assigneeUserId: string) {
    return this.prisma.task.create({
      data: {
        title: dto.title,
        dueAt: new Date(dto.dueAt),
        candidateId: dto.candidateId,
        assigneeUserId,
        priority: (dto.priority ?? 'medium') as any,
      },
    });
  }

  async findAll(query: {
    status?: string;
    assigneeId?: string;
    candidateId?: string;
    dueFrom?: string;
    dueTo?: string;
  }) {
    const tasks = await this.prisma.task.findMany({
      where: {
        status: query.status as any,
        assigneeUserId: query.assigneeId,
        candidateId: query.candidateId,
        dueAt: {
          gte: query.dueFrom ? new Date(query.dueFrom) : undefined,
          lte: query.dueTo ? new Date(query.dueTo) : undefined,
        },
      },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
      include: {
        candidate: {
          select: { id: true, fullName: true, position: true, phone: true },
        },
      },
    });

    const now = Date.now();
    return tasks.map((t) => ({
      ...t,
      isOverdue: t.status === 'open' && new Date(t.dueAt).getTime() < now,
    }));
  }

  async update(id: string, dto: UpdateTaskDto, actor: JwtUser) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Task not found');
    if (actor.role !== 'admin' && existing.assigneeUserId !== actor.id) {
      throw new ForbiddenException('Access denied for this task');
    }
    return this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        status: dto.status as any,
        priority: dto.priority as any,
      },
    });
  }
}
