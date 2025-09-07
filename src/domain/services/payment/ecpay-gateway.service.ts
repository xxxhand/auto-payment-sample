import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  PaymentCreateOptions,
  PaymentResult,
  PaymentStatus,
  PaymentConfirmOptions,
  RefundOptions,
  RefundResult,
  RefundStatus,
  WebhookResult,
} from '../../interfaces/payment/payment-gateway.interface';
import {
  IECPayGateway,
  ECPayConfig,
  ECPayPaymentMethod,
  PeriodPaymentOptions,
  PeriodPaymentResult,
  ATMPaymentOptions,
  ATMPaymentResult,
  CVSPaymentOptions,
  CVSPaymentResult,
  ECPayTradeInfo,
  ECPayFormParams,
  ECPayCallbackParams,
  ECPayTradeStatus,
} from '../../interfaces/payment/ecpay.interface';
import { ECPayConfigService } from './ecpay-config-wrapper.service';

/**
 * 綠界 ECPay 支付閘道實作
 * 支援信用卡、ATM、超商代碼、定期定額等多種支付方式
 */
@Injectable()
export class ECPayGateway implements IECPayGateway {
  private readonly logger = new Logger(ECPayGateway.name);
  private config: ECPayConfig;

  // 綠界 API 端點
  private readonly API_URLS = {
    production: {
      aio: 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5',
      query: 'https://payment.ecpay.com.tw/Cashier/QueryTradeInfo/V5',
    },
    test: {
      aio: 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
      query: 'https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5',
    },
  };

  constructor(private readonly ecpayConfigService?: ECPayConfigService) {
    this.config = this.ecpayConfigService ? this.ecpayConfigService.getConfig() : this.getDefaultConfig();
    this.logger.log(`ECPay Gateway initialized in ${this.config.isTestMode ? 'TEST' : 'PRODUCTION'} mode`);
  }

  getName(): string {
    return 'ecpay';
  }

  /**
   * 創建支付
   */
  async createPayment(options: PaymentCreateOptions): Promise<PaymentResult> {
    this.logger.debug('Creating ECPay payment', options);

    try {
      const merchantTradeNo = this.generateTradeNo();
      const formParams = this.buildFormParams(options, merchantTradeNo);

      // 產生檢查碼
      formParams.CheckMacValue = this.generateCheckMacValue(formParams);

      const result: PaymentResult = {
        success: true,
        paymentId: merchantTradeNo,
        status: PaymentStatus.PENDING,
        amount: options.amount,
        currency: options.currency || 'TWD',
        gatewayResponse: {
          formParams,
          actionUrl: this.getApiUrl('aio'),
          method: 'POST',
        },
        metadata: options.metadata,
      };

      this.logger.log('ECPay payment created', {
        paymentId: merchantTradeNo,
        amount: options.amount,
      });

      return result;
    } catch (error) {
      this.logger.error('ECPay payment creation failed', error);
      return {
        success: false,
        paymentId: '',
        status: PaymentStatus.FAILED,
        amount: options.amount,
        currency: options.currency || 'TWD',
        gatewayResponse: null,
        errorMessage: error.message,
        errorCode: 'ECPAY_CREATE_FAILED',
      };
    }
  }

  /**
   * 確認支付 (不適用於 ECPay)
   */
  async confirmPayment(paymentId: string, _options?: PaymentConfirmOptions): Promise<PaymentResult> {
    this.logger.warn('ECPay does not support payment confirmation', { paymentId });

    // 查詢交易狀態代替確認
    const tradeInfo = await this.queryTradeInfo(paymentId);

    return {
      success: tradeInfo.tradeStatus === ECPayTradeStatus.PAID,
      paymentId,
      status: this.mapECPayStatusToPaymentStatus(tradeInfo.tradeStatus),
      amount: tradeInfo.tradeAmt,
      currency: 'TWD',
      gatewayResponse: tradeInfo,
    };
  }

  /**
   * 獲取支付狀態
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    try {
      const tradeInfo = await this.queryTradeInfo(paymentId);
      return this.mapECPayStatusToPaymentStatus(tradeInfo.tradeStatus);
    } catch (error) {
      this.logger.error('Failed to get payment status', error);
      return PaymentStatus.FAILED;
    }
  }

  /**
   * 創建退款 (ECPay 不直接支援 API 退款，需要手動處理)
   */
  async createRefund(paymentId: string, options?: RefundOptions): Promise<RefundResult> {
    this.logger.warn('ECPay refund requires manual processing', { paymentId, options });

    // ECPay 退款需要透過特店後台手動處理
    const refundId = this.generateRefundId();

    return {
      success: true,
      refundId,
      paymentId,
      status: RefundStatus.PENDING,
      amount: options?.amount || 0,
      currency: 'TWD',
      gatewayResponse: {
        message: 'ECPay refund requires manual processing through merchant portal',
        refundId,
      },
      metadata: {
        ...options?.metadata,
        requiresManualProcessing: true,
      },
    };
  }

  /**
   * 獲取退款狀態
   */
  async getRefundStatus(refundId: string): Promise<RefundStatus> {
    this.logger.warn('ECPay refund status requires manual checking', { refundId });
    return RefundStatus.PENDING;
  }

  /**
   * 處理 Webhook
   */
  async handleWebhook(payload: any, _signature?: string): Promise<WebhookResult> {
    this.logger.debug('Handling ECPay webhook', payload);

    try {
      const params = payload as ECPayCallbackParams;

      // 驗證檢查碼
      if (!this.verifyCheckMacValue(params)) {
        throw new Error('Invalid CheckMacValue');
      }

      const eventType = this.getWebhookEventType(params.RtnCode);
      const paymentStatus = this.mapRtnCodeToPaymentStatus(params.RtnCode);

      const result: WebhookResult = {
        success: true,
        eventType,
        paymentId: params.MerchantTradeNo,
        status: paymentStatus.toString(),
        data: params,
      };

      this.logger.log('ECPay webhook processed', {
        merchantTradeNo: params.MerchantTradeNo,
        rtnCode: params.RtnCode,
        eventType,
      });

      return result;
    } catch (error) {
      this.logger.error('ECPay webhook processing failed', error);
      return {
        success: false,
        eventType: 'webhook.failed',
        data: payload,
        errorMessage: error.message,
      };
    }
  }

  /**
   * 創建定期定額支付
   */
  async createPeriodPayment(options: PeriodPaymentOptions): Promise<PeriodPaymentResult> {
    this.logger.debug('Creating ECPay period payment', options);

    try {
      const merchantTradeNo = this.generateTradeNo();
      const formParams = this.buildPeriodFormParams(options, merchantTradeNo);
      formParams.CheckMacValue = this.generateCheckMacValue(formParams);

      const result: PeriodPaymentResult = {
        success: true,
        paymentId: merchantTradeNo,
        status: PaymentStatus.PENDING,
        amount: options.amount,
        currency: 'TWD',
        periodType: options.periodType,
        frequency: options.frequency,
        execTimes: options.execTimes,
        periodAmount: options.periodAmount,
        gatewayResponse: {
          formParams,
          actionUrl: this.getApiUrl('aio'),
          method: 'POST',
        },
      };

      this.logger.log('ECPay period payment created', {
        paymentId: merchantTradeNo,
        periodAmount: options.periodAmount,
        frequency: options.frequency,
      });

      return result;
    } catch (error) {
      this.logger.error('ECPay period payment creation failed', error);
      throw error;
    }
  }

  /**
   * 創建 ATM 支付
   */
  async createATMPayment(options: ATMPaymentOptions): Promise<ATMPaymentResult> {
    this.logger.debug('Creating ECPay ATM payment', options);

    const paymentOptions: PaymentCreateOptions = {
      ...options,
      paymentMethodType: 'ATM',
    };

    const baseResult = await this.createPayment(paymentOptions);

    // ATM 支付會在回調中返回虛擬帳號資訊
    return {
      ...baseResult,
      bankCode: '', // 會在回調中填入
      vAccount: '', // 會在回調中填入
      expireDate: options.expireDate,
    } as ATMPaymentResult;
  }

  /**
   * 創建便利商店支付
   */
  async createCVSPayment(options: CVSPaymentOptions): Promise<CVSPaymentResult> {
    this.logger.debug('Creating ECPay CVS payment', options);

    const paymentOptions: PaymentCreateOptions = {
      ...options,
      paymentMethodType: options.storeType,
    };

    const baseResult = await this.createPayment(paymentOptions);

    return {
      ...baseResult,
      paymentNo: '', // 會在回調中填入
      expireDate: '', // 會在回調中填入
      storeType: options.storeType,
      desc1: options.desc1,
      desc2: options.desc2,
      desc3: options.desc3,
      desc4: options.desc4,
    } as CVSPaymentResult;
  }

  /**
   * 查詢交易資訊
   */
  async queryTradeInfo(merchantTradeNo: string): Promise<ECPayTradeInfo> {
    this.logger.debug('Querying ECPay trade info', { merchantTradeNo });

    // 模擬查詢結果 (實際實作需要呼叫 ECPay API)
    const mockTradeInfo: ECPayTradeInfo = {
      merchantID: this.config.merchantID,
      merchantTradeNo,
      tradeNo: `T${Date.now()}`,
      tradeDate: new Date().toISOString().split('T')[0].replace(/-/g, '/'),
      paymentDate: new Date().toISOString().split('T')[0].replace(/-/g, '/'),
      paymentType: 'Credit_CreditCard',
      paymentTypeChargeFee: '35',
      tradeAmt: 1000,
      paidAmt: 1000,
      tradeStatus: ECPayTradeStatus.PAID,
      itemName: 'Test Item',
    };

    return mockTradeInfo;
  }

  /**
   * 產生檢查碼
   */
  generateCheckMacValue(parameters: Record<string, any>): string {
    // 移除 CheckMacValue
    const params = { ...parameters };
    delete params.CheckMacValue;

    // 依照 A-Z 排序參數
    const sortedKeys = Object.keys(params).sort();
    const sortedParams = sortedKeys.reduce(
      (acc, key) => {
        acc[key] = params[key];
        return acc;
      },
      {} as Record<string, any>,
    );

    // 組合參數字串
    let paramStr = `HashKey=${this.config.hashKey}`;
    for (const [key, value] of Object.entries(sortedParams)) {
      if (value !== null && value !== undefined && value !== '') {
        paramStr += `&${key}=${value}`;
      }
    }
    paramStr += `&HashIV=${this.config.hashIV}`;

    // URL encode
    paramStr = encodeURIComponent(paramStr);

    // 轉為小寫
    paramStr = paramStr.toLowerCase();

    // 計算 SHA256
    const hash = crypto.createHash('sha256').update(paramStr).digest('hex');

    // 轉為大寫
    return hash.toUpperCase();
  }

  /**
   * 建立表單參數
   */
  private buildFormParams(options: PaymentCreateOptions, merchantTradeNo: string): ECPayFormParams {
    const now = new Date();
    const tradeDate = now.toISOString().replace(/[-:]/g, '').split('.')[0];

    return {
      MerchantID: this.config.merchantID,
      MerchantTradeNo: merchantTradeNo,
      MerchantTradeDate: tradeDate,
      PaymentType: 'aio',
      TotalAmount: options.amount,
      TradeDesc: options.description || 'Online Payment',
      ItemName: options.description || 'Payment Item',
      ReturnURL: this.config.returnURL,
      ChoosePayment: this.getECPayPaymentMethod(options.paymentMethodType),
      ClientBackURL: this.config.clientBackURL,
      OrderResultURL: this.config.orderResultURL,
      CustomField1: options.customerId,
      CustomField2: JSON.stringify(options.metadata || {}),
    };
  }

  /**
   * 建立定期定額表單參數
   */
  private buildPeriodFormParams(options: PeriodPaymentOptions, merchantTradeNo: string): ECPayFormParams {
    const baseParams = this.buildFormParams(options, merchantTradeNo);

    return {
      ...baseParams,
      PeriodAmount: options.periodAmount,
      PeriodType: options.periodType,
      Frequency: options.frequency,
      ExecTimes: options.execTimes,
      PeriodReturnURL: options.periodReturnURL,
    };
  }

  /**
   * 獲取 API URL
   */
  private getApiUrl(type: 'aio' | 'query'): string {
    if (this.ecpayConfigService) {
      const endpoints = this.ecpayConfigService.getApiEndpoints();
      return endpoints[type];
    }
    return this.config.isTestMode ? this.API_URLS.test[type] : this.API_URLS.production[type];
  }

  /**
   * 獲取預設配置
   */
  private getDefaultConfig(): ECPayConfig {
    return {
      merchantID: process.env.ECPAY_MERCHANT_ID || '2000132',
      hashKey: process.env.ECPAY_HASH_KEY || '5294y06JbISpM5x9',
      hashIV: process.env.ECPAY_HASH_IV || 'v77hoKGq4kWxNNIS',
      isTestMode: process.env.NODE_ENV !== 'production',
      returnURL: process.env.ECPAY_RETURN_URL || 'https://your-domain.com/api/webhooks/ecpay',
      clientBackURL: process.env.ECPAY_CLIENT_BACK_URL,
      orderResultURL: process.env.ECPAY_ORDER_RESULT_URL,
    };
  }

  /**
   * 產生交易編號
   */
  private generateTradeNo(): string {
    return `MT${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }

  /**
   * 產生退款編號
   */
  private generateRefundId(): string {
    return `RF${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }

  /**
   * 獲取 ECPay 支付方式
   */
  private getECPayPaymentMethod(paymentMethodType?: string): ECPayPaymentMethod {
    switch (paymentMethodType?.toLowerCase()) {
      case 'credit_card':
      case 'credit':
        return ECPayPaymentMethod.CREDIT;
      case 'webatm':
        return ECPayPaymentMethod.WEBATM;
      case 'atm':
        return ECPayPaymentMethod.ATM;
      case 'cvs':
        return ECPayPaymentMethod.CVS;
      case 'barcode':
        return ECPayPaymentMethod.BARCODE;
      case 'alipay':
        return ECPayPaymentMethod.ALIPAY;
      default:
        return ECPayPaymentMethod.CREDIT;
    }
  }

  /**
   * 映射 ECPay 狀態到支付狀態
   */
  private mapECPayStatusToPaymentStatus(status: ECPayTradeStatus): PaymentStatus {
    switch (status) {
      case ECPayTradeStatus.PAID:
        return PaymentStatus.SUCCEEDED;
      case ECPayTradeStatus.UNPAID:
        return PaymentStatus.PENDING;
      case ECPayTradeStatus.FAILED:
        return PaymentStatus.FAILED;
      case ECPayTradeStatus.REFUND:
      case ECPayTradeStatus.PARTIAL_REFUND:
        return PaymentStatus.REFUNDED;
      default:
        return PaymentStatus.PENDING;
    }
  }

  /**
   * 映射回傳碼到支付狀態
   */
  private mapRtnCodeToPaymentStatus(rtnCode: number): PaymentStatus {
    if (rtnCode === 1) {
      return PaymentStatus.SUCCEEDED;
    } else {
      return PaymentStatus.FAILED;
    }
  }

  /**
   * 獲取 Webhook 事件類型
   */
  private getWebhookEventType(rtnCode: number): string {
    return rtnCode === 1 ? 'payment.succeeded' : 'payment.failed';
  }

  /**
   * 驗證檢查碼
   */
  private verifyCheckMacValue(params: ECPayCallbackParams): boolean {
    const receivedCheckMac = params.CheckMacValue;
    const calculatedCheckMac = this.generateCheckMacValue(params);
    return receivedCheckMac === calculatedCheckMac;
  }

  /**
   * 設定配置
   */
  setConfig(config: ECPayConfig): void {
    this.config = config;
    this.logger.log('ECPay configuration updated');
  }

  /**
   * 獲取配置
   */
  getConfig(): ECPayConfig {
    return { ...this.config };
  }
}
