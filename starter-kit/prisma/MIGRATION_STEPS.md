# Prisma migration steps

## 1) Install Prisma in your NestJS project

```bash
npm i @prisma/client
npm i -D prisma
```

## 2) Initialize Prisma

```bash
npx prisma init
```

This creates `prisma/schema.prisma` and `.env`.

## 3) Replace schema

Copy `starter-kit/prisma/schema.prisma` into your project `prisma/schema.prisma`.

## 4) Set DB connection

In `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/recruitment_db?schema=public"
```

## 5) Run first migration

```bash
npx prisma migrate dev --name init_recruitment_mvp
```

## 6) Generate Prisma client

```bash
npx prisma generate
```

## 7) Optional: open Prisma Studio

```bash
npx prisma studio
```

## Notes

- If DB already has tables from SQL script, use:
  - `npx prisma db pull` to introspect existing schema; or
  - create a fresh DB for Prisma-first workflow.
- Recommended approach now: use Prisma-first migration flow and keep SQL file as reference.

