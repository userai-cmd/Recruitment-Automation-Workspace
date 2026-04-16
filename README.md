# Recruitment Automation Workspace

Operational CRM-style system for recruiters with a single backend source of truth:

- Authentication and role-based access (`admin`, `recruiter`)
- Candidate pipeline management
- Status history and activity audit log
- Recruiter tasks / follow-ups
- KPI dashboard API

## Included in this repository

- `starter-kit/sql/001_init.sql` - PostgreSQL schema and indexes
- `starter-kit/prisma/schema.prisma` - Prisma data model
- `starter-kit/prisma/MIGRATION_STEPS.md` - migration guide
- `starter-kit/nestjs/README.md` - architecture and endpoint blueprint
- `recruitment-api/src` - NestJS backend skeleton for fast MVP start

## Quick start

1. Create a NestJS app (or use existing one).
2. Copy `recruitment-api/src` content into your project `src`.
3. Apply Prisma schema and run migrations.
4. Add env vars:
   - `DATABASE_URL`
   - `JWT_SECRET`
5. Run API and connect frontend.

## Planned MVP scope

- Auth + roles
- Candidates CRUD
- Status transitions + history
- Tasks and follow-ups
- Basic recruiter KPI dashboard
