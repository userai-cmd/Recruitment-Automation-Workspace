import { existsSync } from 'fs';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { AppModule } from './app.module';

export async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const publicCandidates = [
    join(process.cwd(), 'public'),
    join(process.cwd(), 'recruitment-api', 'public'),
    join(__dirname, '..', 'public'),
    join(__dirname, '..', '..', 'public'),
  ];
  const publicDir = publicCandidates.find((candidate) => existsSync(candidate)) || publicCandidates[0];
  const expressApp = app.getHttpAdapter().getInstance();
  const sendHtml = (res: Response, fileName: string) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(join(publicDir, fileName));
  };

  app.useStaticAssets(publicDir);

  expressApp.get('/big_dnipro_logo_final.png', (_req: Request, res: Response) =>
    res.sendFile(join(publicDir, 'big_dnipro_logo_final.png')),
  );
  expressApp.get('/', (_req: Request, res: Response) => sendHtml(res, 'index.html'));
  expressApp.get('/home', (_req: Request, res: Response) => sendHtml(res, 'home.html'));
  expressApp.get('/dashboard', (_req: Request, res: Response) => sendHtml(res, 'dashboard.html'));
  expressApp.get('/kpi', (_req: Request, res: Response) => sendHtml(res, 'kpi.html'));
  expressApp.get('/motivation', (_req: Request, res: Response) => sendHtml(res, 'motivation.html'));
  expressApp.get('/users', (_req: Request, res: Response) => sendHtml(res, 'users.html'));
  expressApp.get('/candidate', (_req: Request, res: Response) => sendHtml(res, 'candidate.html'));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  return app;
}
