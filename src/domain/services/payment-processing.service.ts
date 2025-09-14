import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { PaymentGatewayManager } from './payment/payment-gateway-manager.service';
import { PaymentService } from './payment.service';
import { PaymentMethodRepository } from '../../infra/repositories/payment-method.repository';
import { Money } from '../value-objects/money';
import { PaymentFailureCategory } from '../enums/codes.const';
import { mapFailureCategoryFromGateway, isCategoryRetriable } from '../utils/payment-failure.util';

export interface PaymentProcessingResult {
  success: boolean;
  transactionId?: string;
  errorCode?: string;
  errorMessage?: string;
  failureCategory?: PaymentFailureCategory;
  isRetriable?: boolean;
  processingTime?: number;
}

/**
 * 支付處理服務
 * 協調支付流程、閘道選擇和錯誤處理
 */
@Injectable()
export class PaymentProcessingService {
  private readonly logger = new Logger(PaymentProcessingService.name);

  constructor(
    private readonly paymentGatewayManager: PaymentGatewayManager,
    @Inject(forwardRef(() => PaymentService)) private readonly paymentService: PaymentService,
    private readonly paymentMethodRepository: PaymentMethodRepository,
  ) {}

  /**
   * 處理支付
   */
  async processPayment(paymentId: string, paymentMethodId: string, amount: Money): Promise<PaymentProcessingResult> {
    const startTime = Date.now();

    this.logger.log(`Processing payment`, {
      paymentId,
      paymentMethodId,
      amount: amount.amount,
      currency: amount.currency,
    });

    try {
      // 1. 獲取支付方式詳情
      const paymentMethod = await this.paymentMethodRepository.findById(paymentMethodId);
      if (!paymentMethod) {
        return {
          success: false,
          errorCode: 'PAYMENT_METHOD_NOT_FOUND',
          errorMessage: '支付方式不存在',
          failureCategory: PaymentFailureCategory.NON_RETRIABLE,
          isRetriable: false,
        };
      }

      if (!paymentMethod.isAvailable()) {
        return {
          success: false,
          errorCode: 'PAYMENT_METHOD_UNAVAILABLE',
          errorMessage: '支付方式不可用',
          failureCategory: PaymentFailureCategory.NON_RETRIABLE,
          isRetriable: false,
        };
      }

      // 2. 選擇支付閘道
      const gatewayName = this.selectPaymentGateway(paymentMethod.type, amount);

      // 3. 準備支付選項
      const paymentOptions = {
        paymentId,
        customerId: paymentMethod.customerId,
        paymentMethodId,
        paymentMethodType: this.mapPaymentMethodType(paymentMethod.type),
        amount: amount.amount,
        currency: amount.currency,
        description: `Payment for subscription`,
        metadata: {
          paymentMethodId,
          processingTimestamp: new Date().toISOString(),
        },
      };

      // 4. 執行支付
      const result = await this.paymentGatewayManager.processPayment(gatewayName, paymentOptions);

      const processingTime = Date.now() - startTime;

      if (result.success) {
        this.logger.log(`Payment processed successfully`, {
          paymentId,
          transactionId: result.paymentId,
          processingTime,
        });

        return {
          success: true,
          transactionId: result.paymentId,
          processingTime,
        };
      } else {
        this.logger.warn(`Payment processing failed`, {
          paymentId,
          status: result.status,
          processingTime,
        });

        // 優先採用 gateway 提供的 errorCode / errorMessage；否則根據 status 推斷
        const errorCode = result.errorCode || this.mapGatewayErrorCode(result.status);
        const errorMessage = result.errorMessage || this.mapGatewayErrorMessage(result.status);
        const failureCategory = mapFailureCategoryFromGateway(result.status, errorCode);
        const isRetriable = isCategoryRetriable(failureCategory);

        return {
          success: false,
          errorCode,
          errorMessage,
          failureCategory,
          isRetriable,
          processingTime,
        };
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(`Payment processing error`, {
        paymentId,
        error: error.message,
        processingTime,
      });

      return {
        success: false,
        errorCode: 'PROCESSING_ERROR',
        errorMessage: error.message,
        failureCategory: PaymentFailureCategory.RETRIABLE,
        isRetriable: true,
        processingTime,
      };
    }
  }

  /**
   * 選擇支付閘道
   */
  private selectPaymentGateway(paymentMethodType: string, amount: Money): string {
    // 根據支付方式類型和金額選擇最適合的閘道
    if (amount.currency === 'TWD') {
      return 'ecpay'; // 台灣市場使用 ECPay
    }

    return 'mock'; // 其他情況使用模擬閘道
  }

  /**
   * 映射支付方式類型
   */
  private mapPaymentMethodType(type: string): string {
    const typeMap: Record<string, string> = {
      CREDIT_CARD: 'credit_card',
      BANK_ACCOUNT: 'webatm',
      DIGITAL_WALLET: 'credit_card',
    };

    return typeMap[type] || 'credit_card';
  }

  /**
   * 映射閘道錯誤代碼
   */
  private mapGatewayErrorCode(status: string): string {
    const errorMap: Record<string, string> = {
      FAILED: 'GATEWAY_FAILED',
      DECLINED: 'CARD_DECLINED',
      TIMEOUT: 'GATEWAY_TIMEOUT',
      INVALID: 'INVALID_REQUEST',
    };

    return errorMap[status] || 'UNKNOWN_ERROR';
  }

  /**
   * 映射閘道錯誤訊息
   */
  private mapGatewayErrorMessage(status: string): string {
    const messageMap: Record<string, string> = {
      FAILED: '支付處理失敗',
      DECLINED: '信用卡被拒絕',
      TIMEOUT: '支付閘道逾時',
      INVALID: '無效的支付請求',
    };

    return messageMap[status] || '未知錯誤';
  }

  /**
   * 判斷失敗類別
   */
  // mapping 與 retriable 判斷改由 util 提供

  /**
   * 判斷是否可重試
   */
  private isRetriableError(status: string): boolean {
    // 已由 isCategoryRetriable 決定；此函式保留相容性
    const retriableStatuses = ['TIMEOUT', 'NETWORK_ERROR', 'TEMPORARY_ERROR'];
    return retriableStatuses.includes(status);
  }

  /**
   * 退款處理
   */
  async processRefund(paymentId: string, refundAmount: Money, reason?: string): Promise<PaymentProcessingResult> {
    this.logger.log(`Processing refund`, {
      paymentId,
      amount: refundAmount.amount,
      currency: refundAmount.currency,
      reason,
    });

    try {
      // 獲取原支付記錄
      const payment = await this.paymentService.getPaymentById(paymentId);
      if (!payment) {
        return {
          success: false,
          errorCode: 'PAYMENT_NOT_FOUND',
          errorMessage: '找不到原支付記錄',
          failureCategory: PaymentFailureCategory.NON_RETRIABLE,
          isRetriable: false,
        };
      }

      if (!payment.isSuccessful()) {
        return {
          success: false,
          errorCode: 'PAYMENT_NOT_SUCCESSFUL',
          errorMessage: '只能對成功的支付進行退款',
          failureCategory: PaymentFailureCategory.NON_RETRIABLE,
          isRetriable: false,
        };
      }

      // 處理退款
      await this.paymentService.processRefund(paymentId, refundAmount.amount, reason);

      return {
        success: true,
        transactionId: `refund_${Date.now()}`,
      };
    } catch (error) {
      this.logger.error(`Refund processing error`, {
        paymentId,
        error: error.message,
      });

      return {
        success: false,
        errorCode: 'REFUND_ERROR',
        errorMessage: error.message,
        failureCategory: PaymentFailureCategory.RETRIABLE,
        isRetriable: true,
      };
    }
  }
}
