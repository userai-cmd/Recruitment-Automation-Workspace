# Deploy to Vercel (Production)

## 1) Prepare production database

Use managed Postgres (for example: Neon, Supabase, Railway Postgres).

Required environment variable:

- `DATABASE_URL` (full Prisma PostgreSQL URL)

## 2) Create Vercel project

1. Import this repository in Vercel.
2. Set **Root Directory** to `recruitment-api`.
3. Runtime is configured by `vercel.json` (`nodejs20.x`).

## 3) Add environment variables in Vercel

Add these variables for Production (and Preview if needed):

- `DATABASE_URL`
- `JWT_SECRET` (strong random secret)
- `PORT` is optional on Vercel

## 4) Run migrations on production DB

Run once against the production database:

```bash
npx prisma migrate deploy
```

Optional (create default admin from seed):

```bash
npm run prisma:seed
```

## 5) Redeploy

Trigger a new deploy in Vercel after variables and migrations are ready.

## Notes

- All routes (`/`, `/home`, `/dashboard`, `/kpi`, `/motivation`, `/users`, `/candidate` and API paths) are routed through `api/index.ts`.
- Static assets from `public/` are included in the serverless function bundle.
- Prisma generator includes `rhel-openssl-3.0.x` target for Vercel runtime compatibility.
