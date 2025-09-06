import { BaseEntity } from './base-entity.abstract';
import { BillingAttemptStatus, BillingAttemptType, RetryStrategy } from '../enums/codes.const';

/**
 * 計費嘗試實體
 * 記錄每次自動扣款的嘗試過程
 */
export class BillingAttemptEntity extends BaseEntity {
  /** 所屬訂閱 ID */
  public subscriptionId: string = '';

  /** 關聯的支付記錄 ID */
  public paymentId?: string;

  /** 嘗試狀態 */
  public status: BillingAttemptStatus = BillingAttemptStatus.PENDING;

  /** 嘗試類型 */
  public attemptType: BillingAttemptType = BillingAttemptType.SCHEDULED;

  /** 嘗試次數（針對同一個計費週期） */
  public attemptNumber: number = 1;

  /** 計費金額 */
  public amount: number = 0;

  /** 貨幣代碼 */
  public currency: string = 'TWD';

  /** 預定執行時間 */
  public scheduledAt: Date = new Date();

  /** 實際開始時間 */
  public startedAt?: Date;

  /** 完成時間 */
  public completedAt?: Date;

  /** 下次重試時間 */
  public nextRetryAt?: Date;

  /** 失敗原因 */
  public failureReason?: string;

  /** 錯誤碼 */
  public errorCode?: string;

  /** 錯誤詳情 */
  public errorDetails?: string;

  /** 重試策略 */
  public retryStrategy?: RetryStrategy;

  /** 處理持續時間（毫秒） */
  public processingDuration?: number;

  /** 嘗試元資料 */
  public metadata: Record<string, any> = {};

  constructor(subscriptionId: string, amount: number, scheduledAt: Date, attemptType: BillingAttemptType = BillingAttemptType.SCHEDULED) {
    super();
    this.subscriptionId = subscriptionId;
    this.amount = amount;
    this.scheduledAt = scheduledAt;
    this.attemptType = attemptType;
  }

  /**
   * 檢查是否為成功狀態
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
   * 檢查是否處理中
   */
  public isProcessing(): boolean {
    return this.status === BillingAttemptStatus.PROCESSING;
  }

  /**
   * 檢查是否待處理
   */
  public isPending(): boolean {
    return this.status === BillingAttemptStatus.PENDING;
  }

  /**
   * 開始處理
   */
  public startProcessing(): void {
    this.status = BillingAttemptStatus.PROCESSING;
    this.startedAt = new Date();
    this.touch();
  }

  /**
   * 標記成功
   */
  public markSucceeded(paymentId: string): void {
    this.status = BillingAttemptStatus.SUCCEEDED;
    this.paymentId = paymentId;
    this.completedAt = new Date();
    this.calculateProcessingDuration();
    this.touch();
  }

  /**
   * 標記失敗
   */
  public markFailed(reason: string, errorCode?: string, errorDetails?: string): void {
    this.status = BillingAttemptStatus.FAILED;
    this.failureReason = reason;
    this.errorCode = errorCode;
    this.errorDetails = errorDetails;
    this.completedAt = new Date();
    this.calculateProcessingDuration();
    this.touch();
  }

  /**
   * 標記跳過
   */
  public markSkipped(reason: string): void {
    this.status = BillingAttemptStatus.SKIPPED;
    this.failureReason = reason;
    this.completedAt = new Date();
    this.touch();
  }

  /**
   * 安排重試
   */
  public scheduleRetry(nextRetryAt: Date, retryStrategy: RetryStrategy): void {
    this.nextRetryAt = nextRetryAt;
    this.retryStrategy = retryStrategy;
    this.touch();
  }

  /**
   * 計算處理持續時間
   */
  private calculateProcessingDuration(): void {
    if (this.startedAt && this.completedAt) {
      this.processingDuration = this.completedAt.getTime() - this.startedAt.getTime();
    }
  }

  /**
   * 檢查是否可以重試
   */
  public canRetry(maxRetries: number = 5): boolean {
    return this.isFailed() && this.attemptNumber < maxRetries;
  }

  /**
   * 設定嘗試次數
   */
  public setAttemptNumber(attemptNumber: number): void {
    this.attemptNumber = attemptNumber;
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
   * 取得處理時間（秒）
   */
  public getProcessingTimeInSeconds(): number {
    return this.processingDuration ? this.processingDuration / 1000 : 0;
  }

  /**
   * 檢查是否超時
   */
  public isTimedOut(timeoutMs: number = 30000): boolean {
    return this.processingDuration ? this.processingDuration > timeoutMs : false;
  }
}
