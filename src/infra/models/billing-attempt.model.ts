import { ObjectId } from 'mongodb';
import { IBaseModel } from './base-model.interface';
import { BillingAttemptStatus, BillingAttemptType, RetryStrategy } from '../../domain/enums/codes.const';

/**
 * 計費嘗試資料模型
 */
export interface IBillingAttemptModel extends IBaseModel {
  /** 所屬訂閱 ID */
  subscriptionId: ObjectId;

  /** 關聯的支付記錄 ID */
  paymentId: ObjectId | null;

  /** 嘗試狀態 */
  status: BillingAttemptStatus;

  /** 嘗試類型 */
  attemptType: BillingAttemptType;

  /** 嘗試次數 */
  attemptNumber: number;

  /** 計費金額 */
  amount: number;

  /** 貨幣代碼 */
  currency: string;

  /** 預定執行時間 */
  scheduledAt: Date;

  /** 實際開始時間 */
  startedAt?: Date;

  /** 完成時間 */
  completedAt?: Date;

  /** 下次重試時間 */
  nextRetryAt?: Date;

  /** 失敗原因 */
  failureReason?: string;

  /** 錯誤碼 */
  errorCode?: string;

  /** 錯誤詳情 */
  errorDetails?: string;

  /** 重試策略 */
  retryStrategy?: RetryStrategy;

  /** 處理持續時間（毫秒） */
  processingDuration?: number;

  /** 嘗試元資料 */
  metadata: Record<string, any>;
}
