/**
 * 通知類型枚舉
 */
export enum NotificationType {
  /** 支付成功 */
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  /** 支付失敗 */
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  /** 支付重試 */
  PAYMENT_RETRY = 'PAYMENT_RETRY',
  /** 訂閱續費提醒 */
  SUBSCRIPTION_RENEWAL_REMINDER = 'SUBSCRIPTION_RENEWAL_REMINDER',
  /** 訂閱即將到期 */
  SUBSCRIPTION_EXPIRING = 'SUBSCRIPTION_EXPIRING',
  /** 訂閱已取消 */
  SUBSCRIPTION_CANCELLED = 'SUBSCRIPTION_CANCELLED',
  /** 支付方式即將過期 */
  PAYMENT_METHOD_EXPIRING = 'PAYMENT_METHOD_EXPIRING',
  /** 支付方式失效 */
  PAYMENT_METHOD_INVALID = 'PAYMENT_METHOD_INVALID',
  /** 帳單產生 */
  INVOICE_GENERATED = 'INVOICE_GENERATED',
  /** 退款處理 */
  REFUND_PROCESSED = 'REFUND_PROCESSED',
  /** 系統維護 */
  SYSTEM_MAINTENANCE = 'SYSTEM_MAINTENANCE',
  /** 安全警告 */
  SECURITY_ALERT = 'SECURITY_ALERT',
}

/**
 * 通知管道枚舉
 */
export enum NotificationChannel {
  /** 電子郵件 */
  EMAIL = 'EMAIL',
  /** 簡訊 */
  SMS = 'SMS',
  /** 推播通知 */
  PUSH = 'PUSH',
  /** 應用內通知 */
  IN_APP = 'IN_APP',
  /** Webhook */
  WEBHOOK = 'WEBHOOK',
  /** Line */
  LINE = 'LINE',
  /** Slack */
  SLACK = 'SLACK',
}

/**
 * 通知優先級枚舉
 */
export enum NotificationPriority {
  /** 低優先級 */
  LOW = 'LOW',
  /** 一般優先級 */
  NORMAL = 'NORMAL',
  /** 高優先級 */
  HIGH = 'HIGH',
  /** 緊急 */
  URGENT = 'URGENT',
  /** 關鍵 */
  CRITICAL = 'CRITICAL',
}

/**
 * 通知狀態枚舉
 */
export enum NotificationStatus {
  /** 待發送 */
  PENDING = 'PENDING',
  /** 發送中 */
  SENDING = 'SENDING',
  /** 已發送 */
  SENT = 'SENT',
  /** 已送達 */
  DELIVERED = 'DELIVERED',
  /** 已讀取 */
  READ = 'READ',
  /** 發送失敗 */
  FAILED = 'FAILED',
  /** 已取消 */
  CANCELLED = 'CANCELLED',
  /** 已過期 */
  EXPIRED = 'EXPIRED',
}

/**
 * 通知收件人資訊
 */
export interface NotificationRecipient {
  /** 用戶ID */
  userId: string;
  /** 電子郵件 */
  email?: string;
  /** 手機號碼 */
  phone?: string;
  /** 偏好語言 */
  preferredLanguage?: string;
  /** 偏好管道 */
  preferredChannels: NotificationChannel[];
  /** 時區 */
  timezone?: string;
  /** 是否已驗證電子郵件 */
  emailVerified?: boolean;
  /** 是否已驗證手機 */
  phoneVerified?: boolean;
}

/**
 * 通知內容
 */
export interface NotificationContent {
  /** 標題 */
  title: string;
  /** 內容 */
  body: string;
  /** HTML內容（郵件用） */
  htmlBody?: string;
  /** 動作按鈕 */
  actions?: Array<{
    label: string;
    url: string;
    style?: 'primary' | 'secondary' | 'danger';
  }>;
  /** 附件 */
  attachments?: Array<{
    filename: string;
    contentType: string;
    data: Buffer | string;
  }>;
  /** 圖片URL */
  imageUrl?: string;
  /** 圖示URL */
  iconUrl?: string;
}

/**
 * 通知模板變數
 */
export interface NotificationTemplateVariables {
  [key: string]: string | number | boolean | Date | null | undefined;
}

/**
 * 通知發送選項
 */
export interface NotificationDeliveryOptions {
  /** 發送時間 */
  sendAt?: Date;
  /** 過期時間 */
  expiresAt?: Date;
  /** 最大重試次數 */
  maxRetries?: number;
  /** 重試間隔（分鐘） */
  retryIntervalMinutes?: number;
  /** 是否允許合併 */
  allowBatching?: boolean;
  /** 批次大小 */
  batchSize?: number;
  /** 是否追蹤開啟 */
  trackOpening?: boolean;
  /** 是否追蹤點擊 */
  trackClicks?: boolean;
}

/**
 * 通知發送結果
 */
export interface NotificationDeliveryResult {
  /** 是否成功 */
  success: boolean;
  /** 管道 */
  channel: NotificationChannel;
  /** 發送時間 */
  sentAt: Date;
  /** 送達時間 */
  deliveredAt?: Date;
  /** 錯誤訊息 */
  error?: string;
  /** 外部ID */
  externalId?: string;
  /** 元數據 */
  metadata?: Record<string, any>;
}

/**
 * 通知值物件
 * 封裝通知的完整業務邏輯，包括發送規則、優先級處理、重試邏輯等
 */
export class NotificationVO {
  private readonly _id: string;
  private readonly _type: NotificationType;
  private readonly _priority: NotificationPriority;
  private readonly _recipient: NotificationRecipient;
  private readonly _content: NotificationContent;
  private readonly _channels: NotificationChannel[];
  private readonly _templateId?: string;
  private readonly _templateVariables: NotificationTemplateVariables;
  private readonly _deliveryOptions: NotificationDeliveryOptions;
  private readonly _metadata: Record<string, any>;
  private readonly _createdAt: Date;
  private _status: NotificationStatus;
  private _deliveryResults: NotificationDeliveryResult[];
  private _retryCount: number;
  private _lastAttemptAt?: Date;
  private _deliveredAt?: Date;
  private _readAt?: Date;

  constructor(data: {
    id?: string;
    type: NotificationType;
    priority?: NotificationPriority;
    recipient: NotificationRecipient;
    content: NotificationContent;
    channels?: NotificationChannel[];
    templateId?: string;
    templateVariables?: NotificationTemplateVariables;
    deliveryOptions?: NotificationDeliveryOptions;
    metadata?: Record<string, any>;
    status?: NotificationStatus;
  }) {
    this.validateConstructorData(data);

    this._id = data.id ?? this.generateId();
    this._type = data.type;
    this._priority = data.priority ?? NotificationPriority.NORMAL;
    this._recipient = data.recipient;
    this._content = data.content;
    this._channels = data.channels ?? this.determineOptimalChannels();
    this._templateId = data.templateId;
    this._templateVariables = data.templateVariables ?? {};
    this._deliveryOptions = this.normalizeDeliveryOptions(data.deliveryOptions ?? {});
    this._metadata = data.metadata ?? {};
    this._createdAt = new Date();
    this._status = data.status ?? NotificationStatus.PENDING;
    this._deliveryResults = [];
    this._retryCount = 0;
  }

  get id(): string {
    return this._id;
  }

  get type(): NotificationType {
    return this._type;
  }

  get priority(): NotificationPriority {
    return this._priority;
  }

  get recipient(): NotificationRecipient {
    return { ...this._recipient };
  }

  get content(): NotificationContent {
    return { ...this._content };
  }

  get channels(): NotificationChannel[] {
    return [...this._channels];
  }

  get templateId(): string | undefined {
    return this._templateId;
  }

  get templateVariables(): NotificationTemplateVariables {
    return { ...this._templateVariables };
  }

  get deliveryOptions(): NotificationDeliveryOptions {
    return { ...this._deliveryOptions };
  }

  get metadata(): Record<string, any> {
    return { ...this._metadata };
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get status(): NotificationStatus {
    return this._status;
  }

  get deliveryResults(): NotificationDeliveryResult[] {
    return [...this._deliveryResults];
  }

  get retryCount(): number {
    return this._retryCount;
  }

  get lastAttemptAt(): Date | undefined {
    return this._lastAttemptAt;
  }

  get deliveredAt(): Date | undefined {
    return this._deliveredAt;
  }

  get readAt(): Date | undefined {
    return this._readAt;
  }

  /**
   * 檢查是否可以發送
   */
  canSend(): boolean {
    // 檢查狀態
    if (![NotificationStatus.PENDING, NotificationStatus.FAILED].includes(this._status)) {
      return false;
    }

    // 檢查過期時間
    if (this._deliveryOptions.expiresAt && new Date() > this._deliveryOptions.expiresAt) {
      return false;
    }

    // 檢查重試次數
    if (this._deliveryOptions.maxRetries && this._retryCount >= this._deliveryOptions.maxRetries) {
      return false;
    }

    // 檢查收件人資訊
    return this.hasValidRecipientForChannels();
  }

  /**
   * 檢查是否應該現在發送
   */
  shouldSendNow(): boolean {
    if (!this.canSend()) {
      return false;
    }

    // 檢查發送時間
    if (this._deliveryOptions.sendAt && new Date() < this._deliveryOptions.sendAt) {
      return false;
    }

    // 檢查重試間隔
    if (this._lastAttemptAt && this._deliveryOptions.retryIntervalMinutes) {
      const nextRetryTime = new Date(this._lastAttemptAt.getTime() + this._deliveryOptions.retryIntervalMinutes * 60 * 1000);
      if (new Date() < nextRetryTime) {
        return false;
      }
    }

    return true;
  }

  /**
   * 檢查是否已過期
   */
  isExpired(): boolean {
    return this._deliveryOptions.expiresAt !== undefined && new Date() > this._deliveryOptions.expiresAt;
  }

  /**
   * 檢查是否為高優先級
   */
  isHighPriority(): boolean {
    return [NotificationPriority.HIGH, NotificationPriority.URGENT, NotificationPriority.CRITICAL].includes(this._priority);
  }

  /**
   * 檢查是否為緊急通知
   */
  isUrgent(): boolean {
    return [NotificationPriority.URGENT, NotificationPriority.CRITICAL].includes(this._priority);
  }

  /**
   * 獲取優先級分數
   */
  getPriorityScore(): number {
    const scores = {
      [NotificationPriority.LOW]: 1,
      [NotificationPriority.NORMAL]: 2,
      [NotificationPriority.HIGH]: 3,
      [NotificationPriority.URGENT]: 4,
      [NotificationPriority.CRITICAL]: 5,
    };
    return scores[this._priority];
  }

  /**
   * 計算重試延遲時間
   */
  calculateRetryDelay(): number {
    if (!this._deliveryOptions.retryIntervalMinutes) {
      return 0;
    }

    // 指數退避重試
    const baseDelay = this._deliveryOptions.retryIntervalMinutes;
    return baseDelay * Math.pow(2, this._retryCount);
  }

  /**
   * 獲取下次重試時間
   */
  getNextRetryTime(): Date | null {
    if (!this.canSend() || !this._lastAttemptAt) {
      return null;
    }

    const delayMinutes = this.calculateRetryDelay();
    return new Date(this._lastAttemptAt.getTime() + delayMinutes * 60 * 1000);
  }

  /**
   * 標記為發送中
   */
  markAsSending(): NotificationVO {
    return this.withStatus(NotificationStatus.SENDING, { lastAttemptAt: new Date() });
  }

  /**
   * 標記為已發送
   */
  markAsSent(results: NotificationDeliveryResult[]): NotificationVO {
    const hasSuccessfulDelivery = results.some((r) => r.success);
    const newStatus = hasSuccessfulDelivery ? NotificationStatus.SENT : NotificationStatus.FAILED;

    return this.withStatus(newStatus, {
      deliveryResults: [...this._deliveryResults, ...results],
      retryCount: newStatus === NotificationStatus.FAILED ? this._retryCount + 1 : this._retryCount,
    });
  }

  /**
   * 標記為已送達
   */
  markAsDelivered(channel: NotificationChannel, deliveredAt: Date = new Date()): NotificationVO {
    const updatedResults = this._deliveryResults.map((result) => (result.channel === channel && result.success ? { ...result, deliveredAt } : result));

    return this.withStatus(NotificationStatus.DELIVERED, {
      deliveryResults: updatedResults,
      deliveredAt,
    });
  }

  /**
   * 標記為已讀取
   */
  markAsRead(readAt: Date = new Date()): NotificationVO {
    return this.withStatus(NotificationStatus.READ, { readAt });
  }

  /**
   * 標記為失敗
   */
  markAsFailed(error: string): NotificationVO {
    return this.withStatus(NotificationStatus.FAILED, {
      retryCount: this._retryCount + 1,
      deliveryResults: [
        ...this._deliveryResults,
        {
          success: false,
          channel: this._channels[0], // 預設使用第一個管道
          sentAt: new Date(),
          error,
        },
      ],
    });
  }

  /**
   * 標記為已取消
   */
  markAsCancelled(): NotificationVO {
    return this.withStatus(NotificationStatus.CANCELLED);
  }

  /**
   * 標記為已過期
   */
  markAsExpired(): NotificationVO {
    return this.withStatus(NotificationStatus.EXPIRED);
  }

  /**
   * 獲取個人化內容
   */
  getPersonalizedContent(): NotificationContent {
    const personalizedContent = { ...this._content };

    // 替換模板變數
    personalizedContent.title = this.replaceTemplateVariables(personalizedContent.title);
    personalizedContent.body = this.replaceTemplateVariables(personalizedContent.body);

    if (personalizedContent.htmlBody) {
      personalizedContent.htmlBody = this.replaceTemplateVariables(personalizedContent.htmlBody);
    }

    return personalizedContent;
  }

  /**
   * 獲取適用的管道
   */
  getApplicableChannels(): NotificationChannel[] {
    return this._channels.filter((channel) => this.isChannelAvailable(channel));
  }

  /**
   * 檢查特定管道是否可用
   */
  isChannelAvailable(channel: NotificationChannel): boolean {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return !!this._recipient.email && !!this._recipient.emailVerified;

      case NotificationChannel.SMS:
        return !!this._recipient.phone && !!this._recipient.phoneVerified;

      case NotificationChannel.PUSH:
      case NotificationChannel.IN_APP:
        return true; // 這些通常依賴於用戶ID

      case NotificationChannel.WEBHOOK:
      case NotificationChannel.LINE:
      case NotificationChannel.SLACK:
        return !!this._metadata[`${channel.toLowerCase()}_url`];

      default:
        return false;
    }
  }

  /**
   * 獲取發送統計
   */
  getDeliveryStats(): {
    totalAttempts: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    deliveryRate: number;
    averageDeliveryTime?: number;
  } {
    const totalAttempts = this._deliveryResults.length;
    const successfulDeliveries = this._deliveryResults.filter((r) => r.success).length;
    const failedDeliveries = totalAttempts - successfulDeliveries;

    const deliveryTimes = this._deliveryResults.filter((r) => r.success && r.deliveredAt).map((r) => r.deliveredAt!.getTime() - r.sentAt.getTime());

    const averageDeliveryTime = deliveryTimes.length > 0 ? deliveryTimes.reduce((sum, time) => sum + time, 0) / deliveryTimes.length : undefined;

    return {
      totalAttempts,
      successfulDeliveries,
      failedDeliveries,
      deliveryRate: totalAttempts > 0 ? successfulDeliveries / totalAttempts : 0,
      averageDeliveryTime,
    };
  }

  /**
   * 檢查是否相等
   */
  equals(other: NotificationVO): boolean {
    return this._id === other._id;
  }

  /**
   * 轉換為JSON
   */
  toJSON() {
    return {
      id: this._id,
      type: this._type,
      priority: this._priority,
      recipient: this.recipient,
      content: this.getPersonalizedContent(),
      channels: this._channels,
      applicableChannels: this.getApplicableChannels(),
      deliveryOptions: this._deliveryOptions,
      status: this._status,
      deliveryStats: this.getDeliveryStats(),
      canSend: this.canSend(),
      shouldSendNow: this.shouldSendNow(),
      isExpired: this.isExpired(),
      isHighPriority: this.isHighPriority(),
      priorityScore: this.getPriorityScore(),
      nextRetryTime: this.getNextRetryTime(),
      createdAt: this._createdAt,
      lastAttemptAt: this._lastAttemptAt,
      deliveredAt: this._deliveredAt,
      readAt: this._readAt,
      retryCount: this._retryCount,
    };
  }

  /**
   * 從JSON創建
   */
  static fromJSON(data: any): NotificationVO {
    const notification = new NotificationVO({
      id: data.id,
      type: data.type,
      priority: data.priority,
      recipient: data.recipient,
      content: data.content,
      channels: data.channels,
      templateId: data.templateId,
      templateVariables: data.templateVariables,
      deliveryOptions: data.deliveryOptions,
      metadata: data.metadata,
      status: data.status,
    });

    // 恢復運行時狀態
    if (data.deliveryResults) {
      notification._deliveryResults = data.deliveryResults;
    }
    if (data.retryCount) {
      notification._retryCount = data.retryCount;
    }
    if (data.lastAttemptAt) {
      notification._lastAttemptAt = new Date(data.lastAttemptAt);
    }
    if (data.deliveredAt) {
      notification._deliveredAt = new Date(data.deliveredAt);
    }
    if (data.readAt) {
      notification._readAt = new Date(data.readAt);
    }

    return notification;
  }

  /**
   * 創建支付成功通知
   */
  static createPaymentSuccess(
    recipient: NotificationRecipient,
    paymentAmount: number,
    currency: string,
    options: { templateVariables?: NotificationTemplateVariables; metadata?: Record<string, any> } = {},
  ): NotificationVO {
    return new NotificationVO({
      type: NotificationType.PAYMENT_SUCCESS,
      priority: NotificationPriority.NORMAL,
      recipient,
      content: {
        title: '付款成功通知',
        body: `您的付款 ${currency} ${paymentAmount} 已成功處理。`,
      },
      templateVariables: {
        amount: paymentAmount,
        currency,
        ...options.templateVariables,
      },
      metadata: options.metadata,
    });
  }

  /**
   * 創建支付失敗通知
   */
  static createPaymentFailed(
    recipient: NotificationRecipient,
    paymentAmount: number,
    currency: string,
    reason: string,
    options: { templateVariables?: NotificationTemplateVariables; metadata?: Record<string, any> } = {},
  ): NotificationVO {
    return new NotificationVO({
      type: NotificationType.PAYMENT_FAILED,
      priority: NotificationPriority.HIGH,
      recipient,
      content: {
        title: '付款失敗通知',
        body: `您的付款 ${currency} ${paymentAmount} 處理失敗。原因：${reason}`,
        actions: [
          {
            label: '重新付款',
            url: '/payment/retry',
            style: 'primary',
          },
          {
            label: '聯繫客服',
            url: '/support',
            style: 'secondary',
          },
        ],
      },
      templateVariables: {
        amount: paymentAmount,
        currency,
        failureReason: reason,
        ...options.templateVariables,
      },
      metadata: options.metadata,
    });
  }

  /**
   * 創建安全警告通知
   */
  static createSecurityAlert(
    recipient: NotificationRecipient,
    alertMessage: string,
    options: { templateVariables?: NotificationTemplateVariables; metadata?: Record<string, any> } = {},
  ): NotificationVO {
    return new NotificationVO({
      type: NotificationType.SECURITY_ALERT,
      priority: NotificationPriority.CRITICAL,
      recipient,
      content: {
        title: '安全警告',
        body: alertMessage,
        actions: [
          {
            label: '查看詳情',
            url: '/security/alerts',
            style: 'danger',
          },
        ],
      },
      channels: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PUSH],
      deliveryOptions: {
        maxRetries: 5,
        retryIntervalMinutes: 1,
      },
      templateVariables: options.templateVariables,
      metadata: options.metadata,
    });
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 決定最佳管道
   */
  private determineOptimalChannels(): NotificationChannel[] {
    const availableChannels: NotificationChannel[] = [];

    // 根據用戶偏好
    if (this._recipient.preferredChannels?.length > 0) {
      availableChannels.push(...this._recipient.preferredChannels);
    } else {
      // 預設管道選擇
      if (this._recipient.email && this._recipient.emailVerified) {
        availableChannels.push(NotificationChannel.EMAIL);
      }
      availableChannels.push(NotificationChannel.IN_APP);
    }

    // 高優先級通知增加更多管道
    if (this.isHighPriority()) {
      if (this._recipient.phone && this._recipient.phoneVerified) {
        availableChannels.push(NotificationChannel.SMS);
      }
      availableChannels.push(NotificationChannel.PUSH);
    }

    return [...new Set(availableChannels)]; // 去重
  }

  /**
   * 正規化發送選項
   */
  private normalizeDeliveryOptions(options: NotificationDeliveryOptions): NotificationDeliveryOptions {
    return {
      maxRetries: options.maxRetries ?? 3,
      retryIntervalMinutes: options.retryIntervalMinutes ?? 5,
      allowBatching: options.allowBatching ?? false,
      batchSize: options.batchSize ?? 100,
      trackOpening: options.trackOpening ?? true,
      trackClicks: options.trackClicks ?? true,
      ...options,
    };
  }

  /**
   * 驗證建構資料
   */
  private validateConstructorData(data: any): void {
    if (!data.type) {
      throw new Error('Notification type is required');
    }

    if (!data.recipient) {
      throw new Error('Notification recipient is required');
    }

    if (!data.recipient.userId) {
      throw new Error('Recipient user ID is required');
    }

    if (!data.content) {
      throw new Error('Notification content is required');
    }

    if (!data.content.title || !data.content.body) {
      throw new Error('Notification title and body are required');
    }
  }

  /**
   * 檢查收件人對管道的有效性
   */
  private hasValidRecipientForChannels(): boolean {
    return this._channels.some((channel) => this.isChannelAvailable(channel));
  }

  /**
   * 替換模板變數
   */
  private replaceTemplateVariables(text: string): string {
    let result = text;

    Object.entries(this._templateVariables).forEach(([key, value]) => {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(placeholder, String(value ?? ''));
    });

    return result;
  }

  /**
   * 創建新的通知實例（用於狀態更新）
   */
  private withStatus(
    status: NotificationStatus,
    updates: Partial<{
      deliveryResults: NotificationDeliveryResult[];
      retryCount: number;
      lastAttemptAt: Date;
      deliveredAt: Date;
      readAt: Date;
    }> = {},
  ): NotificationVO {
    const notification = new NotificationVO({
      id: this._id,
      type: this._type,
      priority: this._priority,
      recipient: this._recipient,
      content: this._content,
      channels: this._channels,
      templateId: this._templateId,
      templateVariables: this._templateVariables,
      deliveryOptions: this._deliveryOptions,
      metadata: this._metadata,
      status,
    });

    // 複製運行時狀態
    notification._deliveryResults = updates.deliveryResults ?? this._deliveryResults;
    notification._retryCount = updates.retryCount ?? this._retryCount;
    notification._lastAttemptAt = updates.lastAttemptAt ?? this._lastAttemptAt;
    notification._deliveredAt = updates.deliveredAt ?? this._deliveredAt;
    notification._readAt = updates.readAt ?? this._readAt;

    return notification;
  }
}
