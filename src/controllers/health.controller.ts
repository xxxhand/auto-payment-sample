import { Controller, Get } from '@nestjs/common';
import { PaymentGatewayManager } from '../domain/services/payment/payment-gateway-manager.service';

/**
 * 健康檢查控制器
 */
@Controller('health')
export class HealthController {
  constructor(private readonly paymentGatewayManager: PaymentGatewayManager) {}

  /**
   * 基本健康檢查
   */
  @Get()
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  /**
   * 詳細健康檢查
   */
  @Get('detailed')
  detailedHealthCheck() {
    const gateways = this.paymentGatewayManager.getAvailableGateways();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      node_version: process.version,
      memory_usage: process.memoryUsage(),
      payment_gateways: {
        available: gateways,
        total: gateways.length,
      },
      services: {
        database: 'connected', // TODO: 實際檢查資料庫連線
        redis: 'connected', // TODO: 實際檢查 Redis 連線
        payment_gateways: gateways.length > 0 ? 'available' : 'unavailable',
      },
    };
  }
}
