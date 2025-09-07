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
 * 訂閱狀態列舉 - 完整狀態機設計
 */
export enum SubscriptionStatus {
  /** 待啟用（首次支付處理中） */
  PENDING = 'PENDING',
  /** 試用期 */
  TRIALING = 'TRIALING',
  /** 活躍 */
  ACTIVE = 'ACTIVE',
  /** 已暫停（用戶主動暫停） */
  PAUSED = 'PAUSED',
  /** 寬限期（支付失敗，但仍提供服務） */
  GRACE_PERIOD = 'GRACE_PERIOD',
  /** 重試中（支付失敗，正在重試） */
  RETRY = 'RETRY',
  /** 逾期未付 */
  PAST_DUE = 'PAST_DUE',
  /** 已過期（重試失敗，服務終止） */
  EXPIRED = 'EXPIRED',
  /** 已取消（用戶主動取消） */
  CANCELED = 'CANCELED',
  /** 已退款 */
  REFUNDED = 'REFUNDED',
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
 * 支付狀態列舉 - 完整支付狀態機
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
  /** 重試中 */
  RETRYING = 'RETRYING',
  /** 已取消 */
  CANCELED = 'CANCELED',
  /** 已退款 */
  REFUNDED = 'REFUNDED',
  /** 部分退款 */
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
}

/**
 * 支付失敗類型列舉
 */
export enum PaymentFailureCategory {
  /** 可立即重試（網路錯誤等） */
  RETRIABLE = 'RETRIABLE',
  /** 延後重試（餘額不足等） */
  DELAYED_RETRY = 'DELAYED_RETRY',
  /** 不可重試（卡片停用等） */
  NON_RETRIABLE = 'NON_RETRIABLE',
}

/**
 * 方案變更類型列舉
 */
export enum PlanChangeType {
  /** 立即生效 */
  IMMEDIATE = 'IMMEDIATE',
  /** 下期生效 */
  NEXT_CYCLE = 'NEXT_CYCLE',
  /** 升級 */
  UPGRADE = 'UPGRADE',
  /** 降級 */
  DOWNGRADE = 'DOWNGRADE',
}

/**
 * 取消原因列舉
 */
export enum CancellationReason {
  /** 用戶主動取消 */
  USER_REQUESTED = 'USER_REQUESTED',
  /** 支付失敗 */
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  /** 重複計費爭議 */
  BILLING_DISPUTE = 'BILLING_DISPUTE',
  /** 服務不符預期 */
  SERVICE_DISSATISFACTION = 'SERVICE_DISSATISFACTION',
  /** 找到替代服務 */
  FOUND_ALTERNATIVE = 'FOUND_ALTERNATIVE',
  /** 暫時不需要 */
  TEMPORARILY_UNUSED = 'TEMPORARILY_UNUSED',
  /** 價格過高 */
  TOO_EXPENSIVE = 'TOO_EXPENSIVE',
  /** 系統管理員操作 */
  ADMIN_ACTION = 'ADMIN_ACTION',
  /** 其他 */
  OTHER = 'OTHER',
}

/**
 * 優惠類型列舉
 */
export enum PromotionType {
  /** 百分比折扣 */
  PERCENTAGE_DISCOUNT = 'PERCENTAGE_DISCOUNT',
  /** 固定金額折扣 */
  FIXED_AMOUNT_DISCOUNT = 'FIXED_AMOUNT_DISCOUNT',
  /** 免費試用期 */
  FREE_TRIAL = 'FREE_TRIAL',
  /** 階段性折扣 */
  STAGED_DISCOUNT = 'STAGED_DISCOUNT',
  /** 首次訂閱優惠 */
  FIRST_SUBSCRIPTION_DISCOUNT = 'FIRST_SUBSCRIPTION_DISCOUNT',
  /** 續約優惠 */
  RENEWAL_DISCOUNT = 'RENEWAL_DISCOUNT',
}

/**
 * 退款狀態列舉
 */
export enum RefundStatus {
  /** 已請求 */
  REQUESTED = 'REQUESTED',
  /** 審核中 */
  PENDING = 'PENDING',
  /** 已批准 */
  APPROVED = 'APPROVED',
  /** 處理中 */
  PROCESSING = 'PROCESSING',
  /** 成功 */
  SUCCEEDED = 'SUCCEEDED',
  /** 失敗 */
  FAILED = 'FAILED',
  /** 已取消 */
  CANCELED = 'CANCELED',
}

/**
 * 重試策略類型列舉
 */
export enum RetryStrategyType {
  /** 線性間隔 */
  LINEAR = 'LINEAR',
  /** 指數退避 */
  EXPONENTIAL_BACKOFF = 'EXPONENTIAL_BACKOFF',
  /** 固定間隔 */
  FIXED_INTERVAL = 'FIXED_INTERVAL',
  /** 自定義 */
  CUSTOM = 'CUSTOM',
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

/**
 * 產品狀態列舉
 */
export enum ProductStatus {
  /** 草稿 */
  DRAFT = 'DRAFT',
  /** 活躍 */
  ACTIVE = 'ACTIVE',
  /** 暫停 */
  SUSPENDED = 'SUSPENDED',
  /** 已下架 */
  RETIRED = 'RETIRED',
}

/**
 * 產品類型列舉
 */
export enum ProductType {
  /** 訂閱制 */
  SUBSCRIPTION = 'SUBSCRIPTION',
  /** 一次性付費 */
  ONE_TIME = 'ONE_TIME',
  /** 使用量計費 */
  USAGE_BASED = 'USAGE_BASED',
  /** 混合計費 */
  HYBRID = 'HYBRID',
}

/**
 * 計劃狀態列舉
 */
export enum PlanStatus {
  /** 草稿 */
  DRAFT = 'DRAFT',
  /** 活躍 */
  ACTIVE = 'ACTIVE',
  /** 暫停 */
  SUSPENDED = 'SUSPENDED',
  /** 已下架 */
  RETIRED = 'RETIRED',
}

/**
 * 計劃類型列舉
 */
export enum PlanType {
  /** 標準計劃 */
  STANDARD = 'STANDARD',
  /** 企業計劃 */
  ENTERPRISE = 'ENTERPRISE',
  /** 試用計劃 */
  TRIAL = 'TRIAL',
  /** 免費計劃 */
  FREE = 'FREE',
}
