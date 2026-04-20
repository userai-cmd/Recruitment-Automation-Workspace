import { createApp } from '../src/bootstrap';

type Handler = (req: any, res: any) => void;

let cachedHandler: Handler | null = null;

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
