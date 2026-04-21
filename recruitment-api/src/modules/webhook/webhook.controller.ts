import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { WebhookService } from './webhook.service';

@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  /**
   * POST /webhook/telegram
   * Accepts candidate data from a Telegram bot (or any HTTP client).
   *
   * Direct JSON format:
   *   { "fullName": "Іванов Іван", "phone": "+380501234567", "city": "Київ", "position": "Охоронник" }
   *
   * Native Telegram bot webhook format:
   *   { "update_id": 12345, "message": { "text": "ПІБ: Іванов Іван\nТелефон: +380501234567", "from": {...} } }
   *
   * Optionally protect with header:  x-webhook-token: <WEBHOOK_SECRET env var>
   */
  @Post('telegram')
  @HttpCode(HttpStatus.OK)
  handleTelegram(
    @Body() body: Record<string, unknown>,
    @Headers('x-webhook-token') token?: string,
  ) {
    return this.webhookService.handleTelegramCandidate(body, token);
  }
}
