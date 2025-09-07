/**
 * 支付閘道抽象介面
 * 定義所有支付閘道必須實作的核心方法
 */
export interface IPaymentGateway {
  /**
   * 獲取支付閘道名稱
   */
  getName(): string;

  /**
   * 創建支付
   */
  createPayment(options: PaymentCreateOptions): Promise<PaymentResult>;

  /**
   * 確認支付 (用於需要額外確認步驟的支付)
   */
  confirmPayment(paymentId: string, options?: PaymentConfirmOptions): Promise<PaymentResult>;

  /**
   * 獲取支付狀態
   */
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;

  /**
   * 創建退款
   */
  createRefund(paymentId: string, options?: RefundOptions): Promise<RefundResult>;

  /**
   * 獲取退款狀態
   */
  getRefundStatus(refundId: string): Promise<RefundStatus>;

  /**
   * 處理 Webhook 事件
   */
  handleWebhook(payload: any, signature?: string): Promise<WebhookResult>;

  /**
   * 創建訂閱支付 (可選，如果支援訂閱)
   */
  createSubscription?(options: SubscriptionCreateOptions): Promise<SubscriptionResult>;

  /**
   * 更新訂閱 (可選，如果支援訂閱)
   */
  updateSubscription?(subscriptionId: string, options: SubscriptionUpdateOptions): Promise<SubscriptionResult>;

  /**
   * 取消訂閱 (可選，如果支援訂閱)
   */
  cancelSubscription?(subscriptionId: string): Promise<SubscriptionResult>;
}

/**
 * 支付狀態枚舉
 */
export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
  REQUIRES_ACTION = 'REQUIRES_ACTION', // 需要客戶額外操作 (如 3D Secure)
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  REFUNDED = 'REFUNDED',
}

/**
 * 退款狀態枚舉
 */
export enum RefundStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
}

/**
 * 支付創建選項
 */
export interface PaymentCreateOptions {
  amount: number;
  currency: string;
  paymentMethodId?: string;
  paymentMethodType?: string;
  customerId?: string;
  description?: string;
  confirm?: boolean;
  metadata?: Record<string, any>;
  returnUrl?: string;
  cancelUrl?: string;
}

/**
 * 支付確認選項
 */
export interface PaymentConfirmOptions {
  paymentMethodId?: string;
  returnUrl?: string;
  metadata?: Record<string, any>;
}

/**
 * 退款選項
 */
export interface RefundOptions {
  amount?: number; // 未指定則為全額退款
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * 支付結果統一格式
 */
export interface PaymentResult {
  success: boolean;
  paymentId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  clientSecret?: string; // 用於前端確認支付
  nextAction?: {
    type: string;
    redirectUrl?: string;
    [key: string]: any;
  };
  gatewayResponse: any;
  errorMessage?: string;
  errorCode?: string;
  metadata?: Record<string, any>;
}

/**
 * 退款結果統一格式
 */
export interface RefundResult {
  success: boolean;
  refundId: string;
  paymentId: string;
  status: RefundStatus;
  amount: number;
  currency: string;
  gatewayResponse: any;
  errorMessage?: string;
  errorCode?: string;
  metadata?: Record<string, any>;
}

/**
 * Webhook 處理結果
 */
export interface WebhookResult {
  success: boolean;
  eventType: string;
  paymentId?: string;
  subscriptionId?: string;
  refundId?: string;
  status?: string;
  data: any;
  errorMessage?: string;
}

/**
 * 訂閱創建選項
 */
export interface SubscriptionCreateOptions {
  customerId: string;
  planId: string;
  paymentMethodId?: string;
  trialPeriodDays?: number;
  metadata?: Record<string, any>;
}

/**
 * 訂閱更新選項
 */
export interface SubscriptionUpdateOptions {
  planId?: string;
  paymentMethodId?: string;
  trialEnd?: Date;
  metadata?: Record<string, any>;
}

/**
 * 訂閱結果
 */
export interface SubscriptionResult {
  success: boolean;
  subscriptionId: string;
  customerId: string;
  planId: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  gatewayResponse: any;
  errorMessage?: string;
  errorCode?: string;
  metadata?: Record<string, any>;
}

/**
 * 閘道選擇標準
 */
export interface GatewaySelectionCriteria {
  amount: number;
  currency: string;
  paymentMethodType?: string;
  region?: string;
  customerId?: string;
  preferredGateway?: string;
}

/**
 * 支付方式類型
 */
export enum PaymentMethodType {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  PAYPAL = 'paypal',
  APPLE_PAY = 'apple_pay',
  GOOGLE_PAY = 'google_pay',
  BANK_TRANSFER = 'bank_transfer',
  ATM = 'atm',
  CONVENIENCE_STORE = 'convenience_store',
  ALIPAY = 'alipay',
  WECHAT_PAY = 'wechat_pay',
}

/**
 * 支付閘道配置介面
 */
export interface PaymentGatewayConfig {
  name: string;
  enabled: boolean;
  testMode: boolean;
  apiKey?: string;
  secretKey?: string;
  merchantId?: string;
  webhookSecret?: string;
  supportedCurrencies: string[];
  supportedPaymentMethods: PaymentMethodType[];
  minimumAmount?: number;
  maximumAmount?: number;
  processingFeeRate?: number;
  settings?: Record<string, any>;
}
