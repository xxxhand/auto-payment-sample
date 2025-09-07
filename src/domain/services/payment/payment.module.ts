import { Module } from '@nestjs/common';
import { PaymentGatewayManager } from './payment-gateway-manager.service';
import { MockPaymentGateway } from './mock-payment-gateway.service';
import { ECPayGateway } from './ecpay-gateway.service';
import { ECPayConfigService } from './ecpay-config-wrapper.service';
import { ConfModule } from '../../../../libs/conf/src/conf.module';

/**
 * 支付服務模組
 * 整合所有支付相關的服務和閘道
 */
@Module({
  imports: [ConfModule],
  providers: [PaymentGatewayManager, MockPaymentGateway, ECPayGateway, ECPayConfigService],
  exports: [PaymentGatewayManager, MockPaymentGateway, ECPayGateway, ECPayConfigService],
})
export class PaymentModule {
  constructor(
    private readonly gatewayManager: PaymentGatewayManager,
    private readonly mockGateway: MockPaymentGateway,
    private readonly ecpayGateway: ECPayGateway,
    private readonly ecpayConfigService: ECPayConfigService,
  ) {
    this.setupDefaultGateways();
  }

  /**
   * 設定預設支付閘道
   */
  private setupDefaultGateways(): void {
    // 註冊 Mock 支付閘道
    this.gatewayManager.registerGateway('mock', this.mockGateway, {
      name: 'mock',
      enabled: true,
      testMode: true,
      supportedCurrencies: ['TWD', 'USD', 'EUR', 'JPY'],
      supportedPaymentMethods: ['credit_card', 'debit_card', 'paypal', 'apple_pay', 'google_pay'] as any,
      minimumAmount: 1,
      maximumAmount: 1000000,
      processingFeeRate: 0.029, // 2.9%
      settings: {
        allowTestScenarios: true,
        simulateDelay: true,
      },
    });

    // 註冊 ECPay 支付閘道
    if (this.ecpayConfigService.validateConfig()) {
      this.gatewayManager.registerGateway('ecpay', this.ecpayGateway, {
        name: 'ecpay',
        enabled: true,
        testMode: this.ecpayConfigService.isTestMode(),
        supportedCurrencies: ['TWD'],
        supportedPaymentMethods: ['credit_card', 'webatm', 'atm', 'cvs', 'barcode'] as any,
        minimumAmount: 10,
        maximumAmount: 20000,
        processingFeeRate: 0.028, // 2.8%
        settings: {
          merchantID: this.ecpayConfigService.getConfig().merchantID,
          isTestMode: this.ecpayConfigService.isTestMode(),
        },
      });
    }

    // 設定預設閘道 (優先使用 ECPay，否則使用 Mock)
    const defaultGateway = this.ecpayConfigService.validateConfig() ? 'ecpay' : 'mock';
    this.gatewayManager.setDefaultGateway(defaultGateway);
  }
}
