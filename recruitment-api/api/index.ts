import { NestFactory } from '@nestjs/core';
import { createApp } from '../src/bootstrap';

type Handler = (req: any, res: any) => void;

let cachedHandler: Handler | null = null;

// Keep an explicit Nest import in the serverless entrypoint so Vercel's
// Nest detector recognizes this file as the runtime entry.
void NestFactory;

async function getHandler(): Promise<Handler> {
  if (cachedHandler) return cachedHandler;
  const app = await createApp();
  await app.init();
  cachedHandler = app.getHttpAdapter().getInstance();
  return cachedHandler;
}

export default async function handler(req: any, res: any): Promise<void> {
  const h = await getHandler();
  h(req, res);
}
