# Recruitment Automation MVP - NestJS skeleton

## 1) Bootstrap project

```bash
npm i -g @nestjs/cli
nest new recruitment-api
cd recruitment-api

npm i @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt class-validator class-transformer
npm i -D @types/passport-jwt @types/bcrypt
npm i @prisma/client
npm i -D prisma
```

If you prefer TypeORM, you can swap Prisma out. For MVP speed, Prisma is usually simpler.

---

## 2) Suggested folder structure

```text
src/
  app.module.ts
  main.ts
  common/
    guards/
      jwt-auth.guard.ts
      roles.guard.ts
    decorators/
      roles.decorator.ts
      current-user.decorator.ts
    enums/
      role.enum.ts
  modules/
    auth/
      auth.module.ts
      auth.controller.ts
      auth.service.ts
      dto/
        login.dto.ts
      strategies/
        jwt.strategy.ts
    users/
      users.module.ts
      users.controller.ts
      users.service.ts
    candidates/
      candidates.module.ts
      candidates.controller.ts
      candidates.service.ts
      dto/
        create-candidate.dto.ts
        update-candidate.dto.ts
        change-status.dto.ts
    notes/
      notes.module.ts
      notes.controller.ts
      notes.service.ts
    tasks/
      tasks.module.ts
      tasks.controller.ts
      tasks.service.ts
    dashboard/
      dashboard.module.ts
      dashboard.controller.ts
      dashboard.service.ts
  prisma/
    prisma.module.ts
    prisma.service.ts
```

---

## 3) App module wiring

```ts
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CandidatesModule } from './modules/candidates/candidates.module';
import { NotesModule } from './modules/notes/notes.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CandidatesModule,
    NotesModule,
    TasksModule,
    DashboardModule,
  ],
})
export class AppModule {}
```

---

## 4) Minimal auth skeleton

```ts
// src/modules/auth/dto/login.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}
```

```ts
// src/modules/auth/auth.controller.ts
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: { id: string; role: string }) {
    return user;
  }
}
```

---

## 5) Candidates API skeleton

```ts
// src/modules/candidates/dto/create-candidate.dto.ts
import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCandidateDto {
  @IsString()
  fullName: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsUUID()
  vacancyId?: string;

  @IsUUID()
  assignedRecruiterId: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
```

```ts
// src/modules/candidates/dto/change-status.dto.ts
import { IsIn, IsOptional, IsString } from 'class-validator';

export class ChangeStatusDto {
  @IsIn(['new', 'contacted', 'interview', 'offer', 'hired', 'rejected'])
  toStatus: 'new' | 'contacted' | 'interview' | 'offer' | 'hired' | 'rejected';

  @IsOptional()
  @IsString()
  reason?: string;
}
```

```ts
// src/modules/candidates/candidates.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CandidatesService } from './candidates.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('candidates')
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Get()
  findAll(@Query() query: Record<string, string>) {
    return this.candidatesService.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateCandidateDto, @CurrentUser() user: { id: string }) {
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
    @CurrentUser() user: { id: string },
  ) {
    return this.candidatesService.changeStatus(id, dto, user.id);
  }
}
```

```ts
// src/modules/candidates/candidates.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { ChangeStatusDto } from './dto/change-status.dto';

@Injectable()
export class CandidatesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: Record<string, string>) {
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
      const candidate = await tx.candidate.create({ data: dto as any });
      await tx.activityLog.create({
        data: {
          entityType: 'candidate',
          entityId: candidate.id,
          action: 'create',
          payload: { candidate },
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
          payload: { from: candidate.status, to: dto.toStatus, reason: dto.reason ?? null },
          actorUserId: actorId,
        },
      });

      return updated;
    });
  }
}
```

---

## 6) Dashboard endpoint idea

`GET /dashboard/kpi?from=2026-04-01&to=2026-04-30&recruiterId=<id>`

Response:

```json
{
  "newCandidates": 120,
  "hiredCount": 18,
  "conversionByStage": {
    "new_to_contacted": 0.62,
    "contacted_to_interview": 0.41,
    "interview_to_offer": 0.37,
    "offer_to_hired": 0.73
  },
  "avgDaysToHire": 9.4
}
```

---

## 7) First sprint checklist

1. Apply SQL from `starter-kit/sql/001_init.sql`.
2. Generate Nest modules and connect Prisma.
3. Implement `auth/login` + JWT guard.
4. Implement candidate CRUD + status change + status history write.
5. Implement `GET /tasks?assignee=me&status=open&due=today`.
6. Add simple React/Next page with candidate table + filters.

