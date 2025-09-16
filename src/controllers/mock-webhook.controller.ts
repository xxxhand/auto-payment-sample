import { Body, Controller, Logger, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { PaymentGatewayManager } from '../domain/services/payment/payment-gateway-manager.service';

@Controller('webhooks/mock')
export class MockWebhookController {
  private readonly logger = new Logger(MockWebhookController.name);
  constructor(private readonly paymentGatewayManager: PaymentGatewayManager) {}

  @Post()
  async handleMockWebhook(@Body() body: any, @Res() res: Response) {
    this.logger.log('Received Mock webhook', { type: body?.type });
    try {
      const result = await this.paymentGatewayManager.handleWebhook('mock', body);
      return res.status(200).json({ ok: true, eventType: result.eventType, paymentId: result.paymentId });
    } catch (e: any) {
      this.logger.error('Mock webhook processing failed', e?.message || e);
      return res.status(500).json({ ok: false, error: e?.message || 'unknown' });
    }
  }
}
