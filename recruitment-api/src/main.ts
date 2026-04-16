import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const publicDir = join(process.cwd(), 'public');
  app.useStaticAssets(publicDir);
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/', (_req: Request, res: Response) =>
    res.sendFile(join(publicDir, 'index.html')),
  );
  expressApp.get('/dashboard', (_req: Request, res: Response) =>
    res.sendFile(join(publicDir, 'dashboard.html')),
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
