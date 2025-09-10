import { BaseEntity } from './base-entity.abstract';
import { BillingAttemptStatus, BillingAttemptType, RetryStrategyType } from '../enums/codes.const';
import { Money } from '../value-objects/money';

/**
 * 嘗試結果詳情
 */
interface AttemptResult {
  /** 是否成功 */
  success: boolean;
  /** 響應訊息 */
  message?: string;
  /** 錯誤代碼 */
  errorCode?: string;
  /** 外部交易ID */
  externalTransactionId?: string;
  /** 支付閘道回應 */
  gatewayResponse?: Record<string, any>;
  /** 處理時間（毫秒） */
  processingTimeMs?: number;
}

/**
 * 重試配置
 */
interface RetryConfig {
  /** 重試策略 */
  strategy: RetryStrategyType;
  /** 最大重試次數 */
  maxRetries: number;
  /** 重試間隔（分鐘） */
  retryIntervalMinutes: number;
  /** 指數退避倍數 */
  backoffMultiplier?: number;
  /** 最大重試間隔（小時） */
  maxRetryIntervalHours?: number;
}

/**
 * 計費嘗試實體
 * 記錄每次自動扣款的嘗試過程
 */
export class BillingAttemptEntity extends BaseEntity {
  /** 所屬訂閱 ID */
  public subscriptionId: string = '';

  /** 所屬客戶 ID */
  public customerId: string = '';

  /** 關聯的支付實體 ID */
  public paymentId: string = '';

  /** 使用的支付方式 ID */
  public paymentMethodId: string = '';

  /** 嘗試類型 */
  public type: BillingAttemptType = BillingAttemptType.SCHEDULED;

  /** 嘗試狀態 */
  public status: BillingAttemptStatus = BillingAttemptStatus.PENDING;

  /** 計費金額 */
  public amount: Money = new Money(0, 'TWD');

  /** 計費期間開始日期 */
  public billingPeriodStart: Date = new Date();

  /** 計費期間結束日期 */
  public billingPeriodEnd: Date = new Date();

  /** 嘗試次數（從1開始） */
  public attemptNumber: number = 1;

  /** 是否為重試嘗試 */
  public isRetry: boolean = false;

  /** 原始嘗試 ID（如果是重試） */
  public originalAttemptId?: string;

  /** 排程執行時間 */
  public scheduledAt: Date = new Date();

  /** 實際開始執行時間 */
  public startedAt?: Date;

  /** 完成時間 */
  public completedAt?: Date;

  /** 嘗試結果 */
  public result?: AttemptResult;

  /** 重試配置 */
  public retryConfig: RetryConfig = {
    strategy: RetryStrategyType.EXPONENTIAL_BACKOFF,
    maxRetries: 3,
    retryIntervalMinutes: 60,
    backoffMultiplier: 2,
    maxRetryIntervalHours: 24,
  };

  /** 下次重試時間 */
  public nextRetryAt?: Date;

  /** 失敗原因分類 */
  public failureCategory?: 'PAYMENT_METHOD' | 'INSUFFICIENT_FUNDS' | 'NETWORK' | 'SYSTEM' | 'VALIDATION';

  /** 是否可重試 */
  public isRetriable: boolean = true;

  /** 相關手續費 */
  public fees?: Money;

  /** 稅額 */
  public taxAmount?: Money;

  /** 元資料 */
  public metadata: Record<string, any> = {};

  constructor(
    subscriptionId: string,
    customerId: string,
    paymentId: string,
    paymentMethodId: string,
    amount: Money,
    billingPeriodStart: Date,
    billingPeriodEnd: Date,
    type: BillingAttemptType = BillingAttemptType.SCHEDULED,
  ) {
    super();
    this.subscriptionId = subscriptionId;
    this.customerId = customerId;
    this.paymentId = paymentId;
    this.paymentMethodId = paymentMethodId;
    this.amount = amount;
    this.billingPeriodStart = billingPeriodStart;
    this.billingPeriodEnd = billingPeriodEnd;
    this.type = type;
  }

  /**
   * 開始執行嘗試
   */
  public start(): void {
    if (this.status !== BillingAttemptStatus.PENDING) {
      throw new Error(`Cannot start attempt in status: ${this.status}`);
    }

    this.status = BillingAttemptStatus.PROCESSING;
    this.startedAt = new Date();
    this.touch();
  }

  /**
   * 標記為成功
   */
  public markSuccess(result: Partial<AttemptResult> = {}): void {
    if (this.status !== BillingAttemptStatus.PROCESSING) {
      throw new Error(`Cannot mark success from status: ${this.status}`);
    }

    this.status = BillingAttemptStatus.SUCCEEDED;
    this.completedAt = new Date();
    this.result = {
      success: true,
      processingTimeMs: this.startedAt ? Date.now() - this.startedAt.getTime() : undefined,
      ...result,
    };
    this.touch();
  }

  /**
   * 標記為失敗
   */
  public markFailure(errorMessage: string, errorCode?: string, failureCategory?: string, isRetriable: boolean = true): void {
    if (this.status !== BillingAttemptStatus.PROCESSING) {
      throw new Error(`Cannot mark failure from status: ${this.status}`);
    }

    this.status = BillingAttemptStatus.FAILED;
    this.completedAt = new Date();
    this.isRetriable = isRetriable;
    this.failureCategory = failureCategory as any;

    this.result = {
      success: false,
      message: errorMessage,
      errorCode,
      processingTimeMs: this.startedAt ? Date.now() - this.startedAt.getTime() : undefined,
    };

    // 計算下次重試時間
    if (isRetriable && this.attemptNumber < this.retryConfig.maxRetries) {
      this.calculateNextRetryTime();
    }

    this.touch();
  }

  /**
   * 標記為取消
   */
  public cancel(reason?: string): void {
    if (this.status === BillingAttemptStatus.SUCCEEDED || this.status === BillingAttemptStatus.CANCELLED) {
      throw new Error(`Cannot cancel attempt in status: ${this.status}`);
    }

    this.status = BillingAttemptStatus.CANCELLED;
    this.completedAt = new Date();
    this.metadata.cancellationReason = reason || 'Cancelled by system';
    this.touch();
  }

  /**
   * 建立重試嘗試
   */
  public createRetryAttempt(): BillingAttemptEntity {
    if (!this.canRetry()) {
      throw new Error('Cannot create retry attempt: maximum retries reached or not retriable');
    }

    const retryAttempt = new BillingAttemptEntity(
      this.subscriptionId,
      this.customerId,
      this.paymentId,
      this.paymentMethodId,
      this.amount,
      this.billingPeriodStart,
      this.billingPeriodEnd,
      BillingAttemptType.RETRY,
    );

    retryAttempt.attemptNumber = this.attemptNumber + 1;
    retryAttempt.isRetry = true;
    retryAttempt.originalAttemptId = this.id;
    retryAttempt.scheduledAt = this.nextRetryAt || new Date();
    retryAttempt.retryConfig = { ...this.retryConfig };

    return retryAttempt;
  }

  /**
   * 檢查是否可以重試
   */
  public canRetry(): boolean {
    return this.status === BillingAttemptStatus.FAILED && this.isRetriable && this.attemptNumber < this.retryConfig.maxRetries;
  }

  /**
   * 檢查是否已完成
   */
  public isCompleted(): boolean {
    return [BillingAttemptStatus.SUCCEEDED, BillingAttemptStatus.FAILED, BillingAttemptStatus.CANCELLED].includes(this.status);
  }

  /**
   * 檢查是否成功
   */
  public isSuccessful(): boolean {
    return this.status === BillingAttemptStatus.SUCCEEDED;
  }

  /**
   * 檢查是否失敗
   */
  public isFailed(): boolean {
    return this.status === BillingAttemptStatus.FAILED;
  }

  /**
   * 檢查是否超時
   */
  public isTimeout(timeoutMinutes: number = 30): boolean {
    if (!this.startedAt) return false;
    const elapsed = Date.now() - this.startedAt.getTime();
    return elapsed > timeoutMinutes * 60 * 1000;
  }

  /**
   * 獲取處理時長（毫秒）
   */
  public getProcessingDuration(): number | undefined {
    if (!this.startedAt) return undefined;
    const endTime = this.completedAt || new Date();
    return endTime.getTime() - this.startedAt.getTime();
  }

  /**
   * 獲取等待時長（從排程到執行）
   */
  public getWaitingDuration(): number | undefined {
    if (!this.startedAt) return undefined;
    return this.startedAt.getTime() - this.scheduledAt.getTime();
  }

  /**
   * 更新重試配置
   */
  public updateRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
    this.touch();
  }

  /**
   * 設定費用
   */
  public setFees(fees: Money): void {
    this.fees = fees;
    this.touch();
  }

  /**
   * 設定稅額
   */
  public setTaxAmount(taxAmount: Money): void {
    this.taxAmount = taxAmount;
    this.touch();
  }

  /**
   * 獲取總金額（含費用和稅額）
   */
  public getTotalAmount(): Money {
    let total = this.amount;

    if (this.fees) {
      total = total.add(this.fees);
    }

    if (this.taxAmount) {
      total = total.add(this.taxAmount);
    }

    return total;
  }

  /**
   * 更新閘道回應
   */
  public updateGatewayResponse(response: Record<string, any>): void {
    if (!this.result) {
      this.result = { success: false };
    }
    this.result.gatewayResponse = response;
    this.touch();
  }

  /**
   * 添加元資料
   */
  public addMetadata(key: string, value: any): void {
    this.metadata[key] = value;
    this.touch();
  }

  /**
   * 計算下次重試時間
   */
  private calculateNextRetryTime(): void {
    const { strategy, retryIntervalMinutes, backoffMultiplier, maxRetryIntervalHours } = this.retryConfig;

    let intervalMinutes = retryIntervalMinutes;

    if (strategy === RetryStrategyType.EXPONENTIAL_BACKOFF && backoffMultiplier) {
      intervalMinutes = retryIntervalMinutes * Math.pow(backoffMultiplier, this.attemptNumber - 1);
    }

    // 限制最大重試間隔
    if (maxRetryIntervalHours) {
      intervalMinutes = Math.min(intervalMinutes, maxRetryIntervalHours * 60);
    }

    this.nextRetryAt = new Date(Date.now() + intervalMinutes * 60 * 1000);
  }

  /**
   * 序列化為JSON
   */
  public toJSON(): any {
    return {
      id: this.id,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      subscriptionId: this.subscriptionId,
      customerId: this.customerId,
      paymentId: this.paymentId,
      paymentMethodId: this.paymentMethodId,
      type: this.type,
      status: this.status,
      amount: this.amount.toJSON(),
      billingPeriodStart: this.billingPeriodStart.toISOString(),
      billingPeriodEnd: this.billingPeriodEnd.toISOString(),
      attemptNumber: this.attemptNumber,
      isRetry: this.isRetry,
      originalAttemptId: this.originalAttemptId,
      scheduledAt: this.scheduledAt.toISOString(),
      startedAt: this.startedAt?.toISOString(),
      completedAt: this.completedAt?.toISOString(),
      result: this.result,
      retryConfig: this.retryConfig,
      nextRetryAt: this.nextRetryAt?.toISOString(),
      failureCategory: this.failureCategory,
      isRetriable: this.isRetriable,
      fees: this.fees?.toJSON(),
      taxAmount: this.taxAmount?.toJSON(),
      totalAmount: this.getTotalAmount().toJSON(),
      processingDuration: this.getProcessingDuration(),
      waitingDuration: this.getWaitingDuration(),
      metadata: this.metadata,
    };
  }
}
