import { BaseEntity } from './base-entity.abstract';
import { PaymentStatus } from '../enums/codes.const';

/**
 * 支付記錄實體
 * 代表每次的扣款記錄
 */
export class PaymentEntity extends BaseEntity {
  /** 所屬訂閱 ID */
  public subscriptionId: string = '';

  /** 所屬客戶 ID */
  public customerId: string = '';

  /** 使用的支付方式 ID */
  public paymentMethodId: string = '';

  /** 支付狀態 */
  public status: PaymentStatus = PaymentStatus.PENDING;

  /** 支付金額（以分為單位） */
  public amount: number = 0;

  /** 貨幣代碼 */
  public currency: string = 'TWD';

  /** 支付描述 */
  public description?: string;

  /** 第三方支付系統的交易 ID */
  public externalTransactionId?: string;

  /** 計費週期開始日期 */
  public billingPeriodStart: Date = new Date();

  /** 計費週期結束日期 */
  public billingPeriodEnd: Date = new Date();

  /** 支付嘗試次數 */
  public attemptCount: number = 0;

  /** 最後嘗試時間 */
  public lastAttemptAt?: Date;

  /** 成功支付時間 */
  public paidAt?: Date;

  /** 失敗時間 */
  public failedAt?: Date;

  /** 失敗原因 */
  public failureReason?: string;

  /** 失敗錯誤碼 */
  public failureCode?: string;

  /** 退款時間 */
  public refundedAt?: Date;

  /** 退款金額 */
  public refundedAmount?: number;

  /** 退款原因 */
  public refundReason?: string;

  /** 發票號碼 */
  public invoiceNumber?: string;

  /** 收據號碼 */
  public receiptNumber?: string;

  /** 支付元資料 */
  public metadata: Record<string, any> = {};

  constructor(subscriptionId: string, customerId: string, paymentMethodId: string, amount: number, billingPeriodStart: Date, billingPeriodEnd: Date) {
    super();
    this.subscriptionId = subscriptionId;
    this.customerId = customerId;
    this.paymentMethodId = paymentMethodId;
    this.amount = amount;
    this.billingPeriodStart = billingPeriodStart;
    this.billingPeriodEnd = billingPeriodEnd;
  }

  /**
   * 檢查是否為成功支付
   */
  public isSuccessful(): boolean {
    return this.status === PaymentStatus.SUCCEEDED;
  }

  /**
   * 檢查是否失敗
   */
  public isFailed(): boolean {
    return this.status === PaymentStatus.FAILED;
  }

  /**
   * 檢查是否處理中
   */
  public isPending(): boolean {
    return this.status === PaymentStatus.PENDING;
  }

  /**
   * 檢查是否已退款
   */
  public isRefunded(): boolean {
    return this.status === PaymentStatus.REFUNDED;
  }

  /**
   * 開始支付嘗試
   */
  public startAttempt(): void {
    this.status = PaymentStatus.PROCESSING;
    this.attemptCount += 1;
    this.lastAttemptAt = new Date();
    this.touch();
  }

  /**
   * 標記支付成功
   */
  public markSucceeded(externalTransactionId?: string): void {
    this.status = PaymentStatus.SUCCEEDED;
    this.paidAt = new Date();
    if (externalTransactionId) {
      this.externalTransactionId = externalTransactionId;
    }
    this.touch();
  }

  /**
   * 標記支付失敗
   */
  public markFailed(reason: string, errorCode?: string): void {
    this.status = PaymentStatus.FAILED;
    this.failedAt = new Date();
    this.failureReason = reason;
    if (errorCode) {
      this.failureCode = errorCode;
    }
    this.touch();
  }

  /**
   * 標記支付取消
   */
  public markCanceled(): void {
    this.status = PaymentStatus.CANCELED;
    this.touch();
  }

  /**
   * 處理退款
   */
  public processRefund(refundAmount: number, reason: string): void {
    if (!this.isSuccessful()) {
      throw new Error('只能對成功的支付進行退款');
    }

    this.status = PaymentStatus.REFUNDED;
    this.refundedAt = new Date();
    this.refundedAmount = refundAmount;
    this.refundReason = reason;
    this.touch();
  }

  /**
   * 設定發票資訊
   */
  public setInvoiceInfo(invoiceNumber: string, receiptNumber?: string): void {
    this.invoiceNumber = invoiceNumber;
    if (receiptNumber) {
      this.receiptNumber = receiptNumber;
    }
    this.touch();
  }

  /**
   * 設定外部交易 ID
   */
  public setExternalTransactionId(transactionId: string): void {
    this.externalTransactionId = transactionId;
    this.touch();
  }

  /**
   * 更新元資料
   */
  public updateMetadata(metadata: Record<string, any>): void {
    this.metadata = { ...this.metadata, ...metadata };
    this.touch();
  }

  /**
   * 檢查是否可以重試
   */
  public canRetry(maxAttempts: number = 5): boolean {
    return this.isFailed() && this.attemptCount < maxAttempts;
  }

  /**
   * 計算已退款比例
   */
  public getRefundedRatio(): number {
    if (!this.refundedAmount || this.amount === 0) return 0;
    return this.refundedAmount / this.amount;
  }

  /**
   * 檢查是否為部分退款
   */
  public isPartiallyRefunded(): boolean {
    const ratio = this.getRefundedRatio();
    return ratio > 0 && ratio < 1;
  }

  /**
   * 檢查是否為全額退款
   */
  public isFullyRefunded(): boolean {
    return this.getRefundedRatio() === 1;
  }

  /**
   * 取得剩餘金額
   */
  public getRemainingAmount(): number {
    if (!this.refundedAmount) return this.amount;
    return this.amount - this.refundedAmount;
  }
}
