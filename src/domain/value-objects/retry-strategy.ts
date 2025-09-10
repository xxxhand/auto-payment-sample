import { RetryStrategyType } from '../enums/codes.const';

/**
 * 重試策略值物件
 * 封裝支付重試的策略和配置邏輯
 */
export class RetryStrategyVO {
  private readonly _type: RetryStrategyType;
  private readonly _maxAttempts: number;
  private readonly _baseIntervalMinutes: number;
  private readonly _backoffMultiplier: number;
  private readonly _maxIntervalMinutes: number;
  private readonly _jitterEnabled: boolean;

  constructor(
    type: RetryStrategyType = RetryStrategyType.EXPONENTIAL_BACKOFF,
    maxAttempts: number = 3,
    baseIntervalMinutes: number = 60,
    backoffMultiplier: number = 2,
    maxIntervalMinutes: number = 1440, // 24小時
    jitterEnabled: boolean = true,
  ) {
    this.validateInputs(maxAttempts, baseIntervalMinutes, backoffMultiplier, maxIntervalMinutes);

    this._type = type;
    this._maxAttempts = maxAttempts;
    this._baseIntervalMinutes = baseIntervalMinutes;
    this._backoffMultiplier = backoffMultiplier;
    this._maxIntervalMinutes = maxIntervalMinutes;
    this._jitterEnabled = jitterEnabled;
  }

  get type(): RetryStrategyType {
    return this._type;
  }

  get maxAttempts(): number {
    return this._maxAttempts;
  }

  get baseIntervalMinutes(): number {
    return this._baseIntervalMinutes;
  }

  get backoffMultiplier(): number {
    return this._backoffMultiplier;
  }

  get maxIntervalMinutes(): number {
    return this._maxIntervalMinutes;
  }

  get jitterEnabled(): boolean {
    return this._jitterEnabled;
  }

  /**
   * 計算下次重試的間隔時間（分鐘）
   */
  calculateNextRetryInterval(attemptNumber: number): number {
    if (attemptNumber <= 0) {
      throw new Error('Attempt number must be positive');
    }

    if (attemptNumber > this._maxAttempts) {
      throw new Error('Exceeded maximum retry attempts');
    }

    let intervalMinutes: number;

    switch (this._type) {
      case RetryStrategyType.NONE:
        return 0;

      case RetryStrategyType.FIXED_INTERVAL:
        intervalMinutes = this._baseIntervalMinutes;
        break;

      case RetryStrategyType.LINEAR:
        intervalMinutes = this._baseIntervalMinutes * attemptNumber;
        break;

      case RetryStrategyType.EXPONENTIAL_BACKOFF:
        intervalMinutes = this._baseIntervalMinutes * Math.pow(this._backoffMultiplier, attemptNumber - 1);
        break;

      case RetryStrategyType.CUSTOM:
        intervalMinutes = this.calculateCustomInterval(attemptNumber);
        break;

      default:
        intervalMinutes = this._baseIntervalMinutes;
    }

    // 限制最大間隔時間
    intervalMinutes = Math.min(intervalMinutes, this._maxIntervalMinutes);

    // 添加隨機抖動以避免雷擊效應
    if (this._jitterEnabled) {
      intervalMinutes = this.applyJitter(intervalMinutes);
    }

    return Math.max(1, Math.round(intervalMinutes)); // 至少1分鐘
  }

  /**
   * 計算下次重試的具體時間
   */
  calculateNextRetryTime(attemptNumber: number, fromTime: Date = new Date()): Date {
    const intervalMinutes = this.calculateNextRetryInterval(attemptNumber);
    return new Date(fromTime.getTime() + intervalMinutes * 60 * 1000);
  }

  /**
   * 檢查是否可以重試
   */
  canRetry(attemptNumber: number): boolean {
    return this._type !== RetryStrategyType.NONE && attemptNumber < this._maxAttempts;
  }

  /**
   * 獲取所有重試間隔時間表
   */
  getRetrySchedule(): number[] {
    const schedule: number[] = [];
    for (let i = 1; i <= this._maxAttempts; i++) {
      schedule.push(this.calculateNextRetryInterval(i));
    }
    return schedule;
  }

  /**
   * 計算總的重試等待時間
   */
  getTotalRetryDuration(): number {
    return this.getRetrySchedule().reduce((total, interval) => total + interval, 0);
  }

  /**
   * 獲取策略描述
   */
  getDescription(): string {
    const typeDescriptions = {
      [RetryStrategyType.NONE]: '無重試',
      [RetryStrategyType.FIXED_INTERVAL]: `固定間隔 ${this._baseIntervalMinutes} 分鐘`,
      [RetryStrategyType.LINEAR]: `線性增長，基礎間隔 ${this._baseIntervalMinutes} 分鐘`,
      [RetryStrategyType.EXPONENTIAL_BACKOFF]: `指數退避，基礎間隔 ${this._baseIntervalMinutes} 分鐘，倍數 ${this._backoffMultiplier}`,
      [RetryStrategyType.CUSTOM]: '自定義策略',
    };

    return `${typeDescriptions[this._type]}，最多 ${this._maxAttempts} 次重試`;
  }

  /**
   * 檢查是否相等
   */
  equals(other: RetryStrategyVO): boolean {
    return (
      this._type === other._type &&
      this._maxAttempts === other._maxAttempts &&
      this._baseIntervalMinutes === other._baseIntervalMinutes &&
      this._backoffMultiplier === other._backoffMultiplier &&
      this._maxIntervalMinutes === other._maxIntervalMinutes &&
      this._jitterEnabled === other._jitterEnabled
    );
  }

  /**
   * 轉換為JSON
   */
  toJSON() {
    return {
      type: this._type,
      maxAttempts: this._maxAttempts,
      baseIntervalMinutes: this._baseIntervalMinutes,
      backoffMultiplier: this._backoffMultiplier,
      maxIntervalMinutes: this._maxIntervalMinutes,
      jitterEnabled: this._jitterEnabled,
      description: this.getDescription(),
      retrySchedule: this.getRetrySchedule(),
      totalDuration: this.getTotalRetryDuration(),
    };
  }

  /**
   * 從JSON創建
   */
  static fromJSON(data: any): RetryStrategyVO {
    return new RetryStrategyVO(data.type, data.maxAttempts, data.baseIntervalMinutes, data.backoffMultiplier, data.maxIntervalMinutes, data.jitterEnabled);
  }

  /**
   * 創建預設的指數退避策略
   */
  static exponentialBackoff(maxAttempts: number = 3, baseMinutes: number = 60): RetryStrategyVO {
    return new RetryStrategyVO(RetryStrategyType.EXPONENTIAL_BACKOFF, maxAttempts, baseMinutes);
  }

  /**
   * 創建固定間隔策略
   */
  static fixedInterval(maxAttempts: number = 3, intervalMinutes: number = 60): RetryStrategyVO {
    return new RetryStrategyVO(RetryStrategyType.FIXED_INTERVAL, maxAttempts, intervalMinutes);
  }

  /**
   * 創建線性增長策略
   */
  static linear(maxAttempts: number = 3, baseMinutes: number = 30): RetryStrategyVO {
    return new RetryStrategyVO(RetryStrategyType.LINEAR, maxAttempts, baseMinutes);
  }

  /**
   * 創建無重試策略
   */
  static noRetry(): RetryStrategyVO {
    return new RetryStrategyVO(RetryStrategyType.NONE, 0, 0);
  }

  /**
   * 創建積極重試策略（快速重試）
   */
  static aggressive(): RetryStrategyVO {
    return new RetryStrategyVO(RetryStrategyType.EXPONENTIAL_BACKOFF, 5, 5, 2, 120); // 5分鐘開始，最多2小時
  }

  /**
   * 創建保守重試策略（慢重試）
   */
  static conservative(): RetryStrategyVO {
    return new RetryStrategyVO(RetryStrategyType.EXPONENTIAL_BACKOFF, 3, 180, 2, 2880); // 3小時開始，最多2天
  }

  /**
   * 驗證輸入參數
   */
  private validateInputs(maxAttempts: number, baseInterval: number, backoffMultiplier: number, maxInterval: number): void {
    if (maxAttempts < 0) {
      throw new Error('Max attempts cannot be negative');
    }
    if (baseInterval < 0) {
      throw new Error('Base interval cannot be negative');
    }
    if (backoffMultiplier <= 0) {
      throw new Error('Backoff multiplier must be positive');
    }
    if (maxInterval < baseInterval) {
      throw new Error('Max interval cannot be less than base interval');
    }
  }

  /**
   * 計算自定義間隔
   */
  private calculateCustomInterval(attemptNumber: number): number {
    // 自定義策略：第1次快速重試，然後指數增長
    if (attemptNumber === 1) {
      return 5; // 5分鐘
    }
    if (attemptNumber === 2) {
      return 15; // 15分鐘
    }
    return this._baseIntervalMinutes * Math.pow(this._backoffMultiplier, attemptNumber - 3);
  }

  /**
   * 應用隨機抖動
   */
  private applyJitter(intervalMinutes: number): number {
    // 添加 ±25% 的隨機抖動
    const jitterRange = intervalMinutes * 0.25;
    const jitter = (Math.random() - 0.5) * 2 * jitterRange;
    return intervalMinutes + jitter;
  }
}
