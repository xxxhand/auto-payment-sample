import { ObjectId } from 'mongodb';
import { IBaseModel } from './base-model.interface';
import { SubscriptionStatus, BillingCycle } from '../../domain/enums/codes.const';

/**
 * 訂閱資料模型
 */
export interface ISubscriptionModel extends IBaseModel {
  /** 所屬客戶 ID */
  customerId: ObjectId;

  /** 支付方式 ID */
  paymentMethodId: ObjectId;

  /** 訂閱方案名稱 */
  planName: string;

  /** 訂閱狀態 */
  status: SubscriptionStatus;

  /** 計費週期 */
  billingCycle: BillingCycle;

  /** 訂閱金額（以分為單位） */
  amount: number;

  /** 貨幣代碼 */
  currency: string;

  /** 試用期結束日期 */
  trialEndDate?: Date;

  /** 當前計費週期開始日期 */
  currentPeriodStart: Date;

  /** 當前計費週期結束日期 */
  currentPeriodEnd: Date;

  /** 下次計費日期 */
  nextBillingDate: Date;

  /** 訂閱開始日期 */
  startDate: Date;

  /** 訂閱結束日期 */
  endDate?: Date;

  /** 取消日期 */
  canceledDate?: Date;

  /** 取消原因 */
  cancelReason?: string;

  /** 連續失敗次數 */
  consecutiveFailures: number;

  /** 最後成功扣款日期 */
  lastSuccessfulBillingDate?: Date;

  /** 最後失敗扣款日期 */
  lastFailedBillingDate?: Date;

  /** 寬限期結束日期 */
  gracePeriodEndDate?: Date;

  /** 訂閱描述 */
  description?: string;

  /** 訂閱元資料 */
  metadata: Record<string, any>;
}
