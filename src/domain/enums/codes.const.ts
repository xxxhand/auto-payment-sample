/**
 * 自動扣款系統 - 領域列舉常數
 * 統一管理所有狀態、類型等列舉定義
 */

/**
 * 客戶狀態列舉
 */
export enum CustomerStatus {
  /** 活躍 */
  ACTIVE = 'ACTIVE',
  /** 非活躍 */
  INACTIVE = 'INACTIVE',
  /** 已刪除 */
  DELETED = 'DELETED',
}

/**
 * 支付方式類型列舉
 */
export enum PaymentMethodType {
  /** 信用卡 */
  CREDIT_CARD = 'CREDIT_CARD',
  /** 金融卡 */
  DEBIT_CARD = 'DEBIT_CARD',
  /** 銀行轉帳 */
  BANK_TRANSFER = 'BANK_TRANSFER',
  /** 電子錢包 */
  E_WALLET = 'E_WALLET',
  /** 其他 */
  OTHER = 'OTHER',
}

/**
 * 支付方式狀態列舉
 */
export enum PaymentMethodStatus {
  /** 活躍 */
  ACTIVE = 'ACTIVE',
  /** 非活躍 */
  INACTIVE = 'INACTIVE',
  /** 已過期 */
  EXPIRED = 'EXPIRED',
  /** 已刪除 */
  DELETED = 'DELETED',
}

/**
 * 訂閱狀態列舉
 */
export enum SubscriptionStatus {
  /** 試用期 */
  TRIALING = 'TRIALING',
  /** 活躍 */
  ACTIVE = 'ACTIVE',
  /** 已暫停 */
  PAUSED = 'PAUSED',
  /** 逾期未付 */
  PAST_DUE = 'PAST_DUE',
  /** 已取消 */
  CANCELED = 'CANCELED',
  /** 已過期 */
  EXPIRED = 'EXPIRED',
}

/**
 * 計費週期列舉
 */
export enum BillingCycle {
  /** 每日 */
  DAILY = 'DAILY',
  /** 每週 */
  WEEKLY = 'WEEKLY',
  /** 每月 */
  MONTHLY = 'MONTHLY',
  /** 每季 */
  QUARTERLY = 'QUARTERLY',
  /** 每年 */
  YEARLY = 'YEARLY',
}

/**
 * 支付狀態列舉
 */
export enum PaymentStatus {
  /** 待處理 */
  PENDING = 'PENDING',
  /** 處理中 */
  PROCESSING = 'PROCESSING',
  /** 成功 */
  SUCCEEDED = 'SUCCEEDED',
  /** 失敗 */
  FAILED = 'FAILED',
  /** 已取消 */
  CANCELED = 'CANCELED',
  /** 已退款 */
  REFUNDED = 'REFUNDED',
}

/**
 * 計費嘗試狀態列舉
 */
export enum BillingAttemptStatus {
  /** 待處理 */
  PENDING = 'PENDING',
  /** 處理中 */
  PROCESSING = 'PROCESSING',
  /** 成功 */
  SUCCEEDED = 'SUCCEEDED',
  /** 失敗 */
  FAILED = 'FAILED',
  /** 已跳過 */
  SKIPPED = 'SKIPPED',
}

/**
 * 計費嘗試類型列舉
 */
export enum BillingAttemptType {
  /** 排程計費 */
  SCHEDULED = 'SCHEDULED',
  /** 手動重試 */
  MANUAL_RETRY = 'MANUAL_RETRY',
  /** 自動重試 */
  AUTO_RETRY = 'AUTO_RETRY',
  /** 立即計費 */
  IMMEDIATE = 'IMMEDIATE',
}

/**
 * 重試策略介面
 */
export interface RetryStrategy {
  /** 策略名稱 */
  name: string;
  /** 重試間隔（秒） */
  intervalSeconds: number;
  /** 最大重試次數 */
  maxAttempts: number;
  /** 是否使用指數退避 */
  exponentialBackoff: boolean;
  /** 退避倍數 */
  backoffMultiplier?: number;
}
