import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const publicDir = join(process.cwd(), 'public');
  const expressApp = app.getHttpAdapter().getInstance();

  // Serve UI assets reliably in Docker/production.
  // We keep the generic static middleware, but also add explicit routes for key files.
  app.useStaticAssets(publicDir);

  expressApp.get('/big_dnipro_logo_final.png', (_req: Request, res: Response) =>
    res.sendFile(join(publicDir, 'big_dnipro_logo_final.png')),
  );
  expressApp.get('/', (_req: Request, res: Response) =>
    res.sendFile(join(publicDir, 'index.html')),
  );
  expressApp.get('/home', (_req: Request, res: Response) =>
    res.sendFile(join(publicDir, 'home.html')),
  );
  expressApp.get('/dashboard', (_req: Request, res: Response) =>
    res.sendFile(join(publicDir, 'dashboard.html')),
  );
  expressApp.get('/kpi', (_req: Request, res: Response) =>
    res.sendFile(join(publicDir, 'kpi.html')),
  );
  expressApp.get('/motivation', (_req: Request, res: Response) =>
    res.sendFile(join(publicDir, 'motivation.html')),
  );
  expressApp.get('/candidate', (_req: Request, res: Response) =>
    res.sendFile(join(publicDir, 'candidate.html')),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}

void bootstrap();
