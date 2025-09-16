import { ObjectId } from 'mongodb';
import { IBaseModel } from './base-model.interface';
import { PaymentStatus, PaymentFailureCategory } from '../../domain/enums/codes.const';

/**
 * 支付記錄資料模型
 */
export interface IPaymentModel extends IBaseModel {
  /** 所屬訂閱 ID */
  subscriptionId: ObjectId;

  /** 所屬客戶 ID */
  customerId: ObjectId;

  /** 使用的支付方式 ID */
  paymentMethodId: ObjectId;

  /** 支付狀態 */
  status: PaymentStatus;

  /** 支付金額（以分為單位） */
  amount: number;

  /** 貨幣代碼 */
  currency: string;

  /** 支付描述 */
  description?: string;

  /** 第三方支付系統的交易 ID */
  externalTransactionId?: string;

  /** 計費週期開始日期 */
  billingPeriodStart: Date;

  /** 計費週期結束日期 */
  billingPeriodEnd: Date;

  /** 支付嘗試次數 */
  attemptCount: number;

  /** 最後嘗試時間 */
  lastAttemptAt?: Date;

  /** 成功支付時間 */
  paidAt?: Date;

  /** 失敗時間 */
  failedAt?: Date;

  /** 失敗原因 */
  failureReason?: string;

  /** 失敗錯誤碼 */
  failureCode?: string;

  /** 退款時間 */
  refundedAt?: Date;

  /** 退款金額 */
  refundedAmount?: number;

  /** 退款原因 */
  refundReason?: string;

  /** 發票號碼 */
  invoiceNumber?: string;

  /** 收據號碼 */
  receiptNumber?: string;

  /** 支付元資料 */
  metadata: Record<string, any>;

  /** 第三方支付的支付/扣款ID（擴充） */
  providerPaymentId?: string;
  providerChargeId?: string;

  /** 失敗詳情（擴充） */
  failureDetails?: {
    errorCode?: string;
    errorMessage?: string;
    providerErrorCode?: string;
    providerErrorMessage?: string;
    category: PaymentFailureCategory; // 原註解: number
    isRetriable: boolean;
    failedAt: Date;
    metadata?: Record<string, any>;
  };

  /** 重試狀態（擴充） */
  retryState?: {
    attemptNumber: number;
    maxRetries: number;
    nextRetryAt?: Date;
    lastFailureReason?: string;
    failureCategory?: PaymentFailureCategory; // 原註解: number
    retryStrategy: string;
  };
}
