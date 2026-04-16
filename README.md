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

## Quick start (Docker)

1. Ensure Docker Desktop is running.
2. From repository root run:
   - `docker compose up --build`
3. API will be available on `http://localhost:3000`.

## Quick start (local without Docker)

1. Open `recruitment-api`.
2. Install dependencies: `npm install`.
3. Copy `.env.example` to `.env` and adjust values.
4. Run Prisma migration: `npx prisma migrate dev --name init`.
5. Start API: `npm run start:dev`.

## Planned MVP scope

- Auth + roles
- Candidates CRUD
- Status transitions + history
- Tasks and follow-ups
- Basic recruiter KPI dashboard
