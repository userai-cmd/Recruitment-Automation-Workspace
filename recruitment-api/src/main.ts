import { createApp } from './bootstrap';

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

async function bootstrap(): Promise<void> {
  const app = await createApp();

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}

if (!process.env.VERCEL) {
  void bootstrap();
}
