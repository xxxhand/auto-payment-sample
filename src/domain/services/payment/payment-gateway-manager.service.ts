import { Injectable, Logger } from '@nestjs/common';
import {
  IPaymentGateway,
  PaymentCreateOptions,
  PaymentResult,
  RefundOptions,
  RefundResult,
  GatewaySelectionCriteria,
  PaymentGatewayConfig,
  PaymentMethodType,
} from '../../interfaces/payment/payment-gateway.interface';

/**
 * 支付閘道管理器
 * 負責管理多個支付閘道、智能選擇和統一處理
 */
@Injectable()
export class PaymentGatewayManager {
  private readonly logger = new Logger(PaymentGatewayManager.name);
  private readonly gateways: Map<string, IPaymentGateway> = new Map();
  private readonly configs: Map<string, PaymentGatewayConfig> = new Map();
  private defaultGateway: string = 'mock';

  /**
   * 註冊支付閘道
   */
  registerGateway(name: string, gateway: IPaymentGateway, config: PaymentGatewayConfig): void {
    this.logger.log(`Registering payment gateway: ${name}`);
    this.gateways.set(name, gateway);
    this.configs.set(name, config);
  }

  /**
   * 取消註冊支付閘道
   */
  unregisterGateway(name: string): void {
    this.logger.log(`Unregistering payment gateway: ${name}`);
    this.gateways.delete(name);
    this.configs.delete(name);
  }

  /**
   * 獲取指定的支付閘道
   */
  getGateway(name?: string): IPaymentGateway {
    const gatewayName = name || this.defaultGateway;
    const gateway = this.gateways.get(gatewayName);

    if (!gateway) {
      throw new Error(`Payment gateway '${gatewayName}' not found`);
    }

    const config = this.configs.get(gatewayName);
    if (!config?.enabled) {
      throw new Error(`Payment gateway '${gatewayName}' is disabled`);
    }

    return gateway;
  }

  /**
   * 獲取所有已註冊的閘道名稱
   */
  getAvailableGateways(): string[] {
    return Array.from(this.gateways.keys()).filter((name) => {
      const config = this.configs.get(name);
      return config?.enabled;
    });
  }

  /**
   * 智能選擇最適合的支付閘道
   */
  selectOptimalGateway(criteria: GatewaySelectionCriteria): IPaymentGateway {
    this.logger.debug('Selecting optimal gateway', criteria);

    // 如果指定了偏好閘道且可用，直接使用
    if (criteria.preferredGateway) {
      const preferredConfig = this.configs.get(criteria.preferredGateway);
      if (preferredConfig?.enabled && this.isGatewaySuitable(criteria.preferredGateway, criteria)) {
        return this.getGateway(criteria.preferredGateway);
      }
    }

    // 根據標準選擇最適合的閘道
    const suitableGateways = this.getSuitableGateways(criteria);

    if (suitableGateways.length === 0) {
      this.logger.warn('No suitable gateway found, using default gateway');
      return this.getGateway(this.defaultGateway);
    }

    // 簡單的選擇邏輯：選擇手續費最低的
    const bestGateway = suitableGateways.reduce((best, current) => {
      const bestConfig = this.configs.get(best);
      const currentConfig = this.configs.get(current);

      const bestFee = bestConfig?.processingFeeRate || 0;
      const currentFee = currentConfig?.processingFeeRate || 0;

      return currentFee < bestFee ? current : best;
    });

    this.logger.debug(`Selected gateway: ${bestGateway}`);
    return this.getGateway(bestGateway);
  }

  /**
   * 處理支付
   */
  async processPayment(gatewayName: string, options: PaymentCreateOptions): Promise<PaymentResult> {
    const gateway = this.getGateway(gatewayName);

    this.logger.log(`Processing payment via ${gatewayName}`, {
      amount: options.amount,
      currency: options.currency,
      paymentMethodType: options.paymentMethodType,
    });

    try {
      const result = await gateway.createPayment(options);

      this.logger.log(`Payment processed successfully`, {
        gateway: gatewayName,
        paymentId: result.paymentId,
        status: result.status,
        success: result.success,
      });

      return result;
    } catch (error) {
      this.logger.error(`Payment processing failed`, {
        gateway: gatewayName,
        error: error.message,
        stack: error.stack,
      });

      throw error;
    }
  }

  /**
   * 處理退款
   */
  async processRefund(gatewayName: string, paymentId: string, options?: RefundOptions): Promise<RefundResult> {
    const gateway = this.getGateway(gatewayName);

    this.logger.log(`Processing refund via ${gatewayName}`, {
      paymentId,
      amount: options?.amount,
      reason: options?.reason,
    });

    try {
      const result = await gateway.createRefund(paymentId, options);

      this.logger.log(`Refund processed successfully`, {
        gateway: gatewayName,
        refundId: result.refundId,
        paymentId: result.paymentId,
        status: result.status,
        success: result.success,
      });

      return result;
    } catch (error) {
      this.logger.error(`Refund processing failed`, {
        gateway: gatewayName,
        paymentId,
        error: error.message,
        stack: error.stack,
      });

      throw error;
    }
  }

  /**
   * 處理 Webhook
   */
  async handleWebhook(gatewayName: string, payload: any, signature?: string) {
    const gateway = this.getGateway(gatewayName);

    this.logger.log(`Handling webhook for ${gatewayName}`);

    try {
      const result = await gateway.handleWebhook(payload, signature);

      this.logger.log(`Webhook processed successfully`, {
        gateway: gatewayName,
        eventType: result.eventType,
        success: result.success,
      });

      return result;
    } catch (error) {
      this.logger.error(`Webhook processing failed`, {
        gateway: gatewayName,
        error: error.message,
        stack: error.stack,
      });

      throw error;
    }
  }

  /**
   * 設定預設支付閘道
   */
  setDefaultGateway(gatewayName: string): void {
    if (!this.gateways.has(gatewayName)) {
      throw new Error(`Gateway '${gatewayName}' is not registered`);
    }

    this.defaultGateway = gatewayName;
    this.logger.log(`Default gateway set to: ${gatewayName}`);
  }

  /**
   * 獲取閘道配置
   */
  getGatewayConfig(gatewayName: string): PaymentGatewayConfig | undefined {
    return this.configs.get(gatewayName);
  }

  /**
   * 更新閘道配置
   */
  updateGatewayConfig(gatewayName: string, config: Partial<PaymentGatewayConfig>): void {
    const currentConfig = this.configs.get(gatewayName);
    if (!currentConfig) {
      throw new Error(`Gateway '${gatewayName}' is not registered`);
    }

    const updatedConfig = { ...currentConfig, ...config };
    this.configs.set(gatewayName, updatedConfig);
    this.logger.log(`Gateway config updated: ${gatewayName}`);
  }

  /**
   * 獲取合適的支付閘道列表
   */
  private getSuitableGateways(criteria: GatewaySelectionCriteria): string[] {
    return Array.from(this.configs.entries())
      .filter(([name, config]) => config.enabled && this.isGatewaySuitable(name, criteria))
      .map(([name]) => name);
  }

  /**
   * 檢查閘道是否適合給定的標準
   */
  private isGatewaySuitable(gatewayName: string, criteria: GatewaySelectionCriteria): boolean {
    const config = this.configs.get(gatewayName);
    if (!config) return false;

    // 檢查幣種支援
    if (!config.supportedCurrencies.includes(criteria.currency)) {
      return false;
    }

    // 檢查金額範圍
    if (config.minimumAmount && criteria.amount < config.minimumAmount) {
      return false;
    }

    if (config.maximumAmount && criteria.amount > config.maximumAmount) {
      return false;
    }

    // 檢查支付方式支援
    if (criteria.paymentMethodType) {
      const paymentMethodType = criteria.paymentMethodType as PaymentMethodType;
      if (!config.supportedPaymentMethods.includes(paymentMethodType)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 獲取系統狀態資訊
   */
  getSystemStatus(): {
    totalGateways: number;
    enabledGateways: number;
    disabledGateways: number;
    defaultGateway: string;
    gateways: Array<{
      name: string;
      enabled: boolean;
      testMode: boolean;
      supportedCurrencies: string[];
      supportedPaymentMethods: PaymentMethodType[];
    }>;
  } {
    const gatewayInfo = Array.from(this.configs.entries()).map(([name, config]) => ({
      name,
      enabled: config.enabled,
      testMode: config.testMode,
      supportedCurrencies: config.supportedCurrencies,
      supportedPaymentMethods: config.supportedPaymentMethods,
    }));

    return {
      totalGateways: this.gateways.size,
      enabledGateways: gatewayInfo.filter((g) => g.enabled).length,
      disabledGateways: gatewayInfo.filter((g) => !g.enabled).length,
      defaultGateway: this.defaultGateway,
      gateways: gatewayInfo,
    };
  }
}
