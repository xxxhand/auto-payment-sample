import { SubscriptionStatus, PaymentStatus, PaymentFailureCategory } from '../enums/codes.const';

/**
 * 狀態轉換結果
 */
export class TransitionResult {
  constructor(
    public readonly isValid: boolean,
    public readonly message?: string,
    public readonly metadata?: Record<string, any>,
  ) {}

  static valid(message?: string, metadata?: Record<string, any>): TransitionResult {
    return new TransitionResult(true, message, metadata);
  }

  static invalid(message: string, metadata?: Record<string, any>): TransitionResult {
    return new TransitionResult(false, message, metadata);
  }
}

/**
 * 狀態轉換上下文
 */
export interface TransitionContext {
  reason?: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
  actor?: string; // 執行轉換的使用者或系統
}

/**
 * 訂閱狀態機
 * 管理訂閱狀態的轉換邏輯和驗證規則
 */
export class SubscriptionStateMachine {
  /**
   * 有效的狀態轉換對應表
   */
  private static readonly VALID_TRANSITIONS = new Map<SubscriptionStatus, SubscriptionStatus[]>([
    [SubscriptionStatus.PENDING, [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE, SubscriptionStatus.EXPIRED, SubscriptionStatus.RETRY, SubscriptionStatus.CANCELED]],
    [SubscriptionStatus.TRIALING, [SubscriptionStatus.ACTIVE, SubscriptionStatus.EXPIRED, SubscriptionStatus.CANCELED]],
    [SubscriptionStatus.ACTIVE, [SubscriptionStatus.PAUSED, SubscriptionStatus.GRACE_PERIOD, SubscriptionStatus.RETRY, SubscriptionStatus.CANCELED, SubscriptionStatus.REFUNDED]],
    [SubscriptionStatus.PAUSED, [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED, SubscriptionStatus.EXPIRED]],
    [SubscriptionStatus.GRACE_PERIOD, [SubscriptionStatus.ACTIVE, SubscriptionStatus.RETRY, SubscriptionStatus.PAST_DUE, SubscriptionStatus.EXPIRED, SubscriptionStatus.CANCELED]],
    [SubscriptionStatus.RETRY, [SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE_PERIOD, SubscriptionStatus.PAST_DUE, SubscriptionStatus.EXPIRED, SubscriptionStatus.CANCELED]],
    [SubscriptionStatus.PAST_DUE, [SubscriptionStatus.ACTIVE, SubscriptionStatus.RETRY, SubscriptionStatus.EXPIRED, SubscriptionStatus.CANCELED]],
    [SubscriptionStatus.CANCELED, [SubscriptionStatus.REFUNDED]],
    // 終止狀態無法轉換
    [SubscriptionStatus.EXPIRED, []],
    [SubscriptionStatus.REFUNDED, []],
  ]);

  /**
   * 檢查狀態轉換是否有效
   */
  static canTransition(fromStatus: SubscriptionStatus, toStatus: SubscriptionStatus): boolean {
    const validTransitions = this.VALID_TRANSITIONS.get(fromStatus);
    return validTransitions?.includes(toStatus) ?? false;
  }

  /**
   * 驗證狀態轉換
   */
  static validateTransition(fromStatus: SubscriptionStatus, toStatus: SubscriptionStatus, context: TransitionContext = {}): TransitionResult {
    // 檢查基本轉換有效性
    if (!this.canTransition(fromStatus, toStatus)) {
      return TransitionResult.invalid(`Invalid transition from ${fromStatus} to ${toStatus}`);
    }

    // 相同狀態不需要轉換
    if (fromStatus === toStatus) {
      return TransitionResult.valid('No state change required');
    }

    // 根據目標狀態進行特定驗證
    switch (toStatus) {
      case SubscriptionStatus.ACTIVE:
        return this.validateTransitionToActive(fromStatus, context);
      case SubscriptionStatus.GRACE_PERIOD:
        return this.validateTransitionToGracePeriod(fromStatus, context);
      case SubscriptionStatus.RETRY:
        return this.validateTransitionToRetry(fromStatus, context);
      case SubscriptionStatus.CANCELED:
        return this.validateTransitionToCanceled(fromStatus, context);
      case SubscriptionStatus.REFUNDED:
        return this.validateTransitionToRefunded(fromStatus, context);
      default:
        return TransitionResult.valid();
    }
  }

  /**
   * 整合規則引擎的狀態轉換驗證
   */
  static validateTransitionWithRules(
    fromStatus: SubscriptionStatus,
    toStatus: SubscriptionStatus,
    context: TransitionContext,
    rulesEngineResult?: {
      shouldTransition: boolean;
      reason?: string;
      metadata?: Record<string, any>;
    },
  ): TransitionResult {
    // 先執行基本驗證
    const basicValidation = this.validateTransition(fromStatus, toStatus, context);
    if (!basicValidation.isValid) {
      return basicValidation;
    }

    // 如果有規則引擎結果，優先採用
    if (rulesEngineResult) {
      if (!rulesEngineResult.shouldTransition) {
        return TransitionResult.invalid(rulesEngineResult.reason || 'Transition blocked by business rules', rulesEngineResult.metadata);
      }

      return TransitionResult.valid(rulesEngineResult.reason || basicValidation.message, { ...basicValidation.metadata, ...rulesEngineResult.metadata });
    }

    return basicValidation;
  }

  /**
   * 取得所有可能的下一個狀態
   */
  static getPossibleNextStates(currentStatus: SubscriptionStatus): SubscriptionStatus[] {
    return this.VALID_TRANSITIONS.get(currentStatus) || [];
  }

  /**
   * 檢查是否為終止狀態
   */
  static isTerminalState(status: SubscriptionStatus): boolean {
    return [SubscriptionStatus.EXPIRED, SubscriptionStatus.REFUNDED].includes(status);
  }

  /**
   * 檢查是否為活躍狀態
   */
  static isActiveState(status: SubscriptionStatus): boolean {
    return [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE_PERIOD].includes(status);
  }

  /**
   * 驗證轉換到活躍狀態
   */
  private static validateTransitionToActive(fromStatus: SubscriptionStatus, context: TransitionContext): TransitionResult {
    switch (fromStatus) {
      case SubscriptionStatus.PENDING:
        if (!context.metadata?.paymentSuccessful) {
          return TransitionResult.invalid('Payment must be successful to activate subscription');
        }
        break;
      case SubscriptionStatus.GRACE_PERIOD:
      case SubscriptionStatus.RETRY:
      case SubscriptionStatus.PAST_DUE:
        if (!context.metadata?.paymentResolved) {
          return TransitionResult.invalid('Payment issue must be resolved to reactivate subscription');
        }
        break;
    }
    return TransitionResult.valid('Subscription activated successfully');
  }

  /**
   * 驗證轉換到寬限期狀態
   */
  private static validateTransitionToGracePeriod(fromStatus: SubscriptionStatus, context: TransitionContext): TransitionResult {
    if (fromStatus !== SubscriptionStatus.ACTIVE && fromStatus !== SubscriptionStatus.RETRY) {
      return TransitionResult.invalid('Grace period can only be entered from ACTIVE or RETRY state');
    }

    if (!context.metadata?.paymentFailed) {
      return TransitionResult.invalid('Grace period requires payment failure');
    }

    return TransitionResult.valid('Subscription entered grace period');
  }

  /**
   * 驗證轉換到重試狀態
   */
  private static validateTransitionToRetry(fromStatus: SubscriptionStatus, context: TransitionContext): TransitionResult {
    const validFromStates = [SubscriptionStatus.PENDING, SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE_PERIOD, SubscriptionStatus.PAST_DUE];

    if (!validFromStates.includes(fromStatus)) {
      return TransitionResult.invalid('Invalid state for retry transition');
    }

    // 整合重試策略引擎決策
    if (context.metadata?.retryDecision) {
      const retryDecision = context.metadata.retryDecision;
      if (!retryDecision.shouldRetry) {
        return TransitionResult.invalid(retryDecision.reason || 'Retry not allowed by strategy engine');
      }
    }

    if (!context.metadata?.isRetriable) {
      return TransitionResult.invalid('Payment failure is not retriable');
    }

    const maxRetries = context.metadata?.maxRetries || 3;
    const currentRetries = context.metadata?.currentRetries || 0;

    if (currentRetries >= maxRetries) {
      return TransitionResult.invalid('Maximum retry attempts exceeded');
    }

    return TransitionResult.valid('Subscription entered retry state', {
      nextRetryDate: context.metadata?.nextRetryDate,
      retryStrategy: context.metadata?.retryStrategy,
    });
  }

  /**
   * 驗證轉換到取消狀態
   */
  private static validateTransitionToCanceled(fromStatus: SubscriptionStatus, context: TransitionContext): TransitionResult {
    if (this.isTerminalState(fromStatus)) {
      return TransitionResult.invalid('Cannot cancel subscription from terminal state');
    }

    if (!context.reason) {
      return TransitionResult.invalid('Cancellation reason is required');
    }

    return TransitionResult.valid('Subscription canceled successfully');
  }

  /**
   * 驗證轉換到退款狀態
   */
  private static validateTransitionToRefunded(fromStatus: SubscriptionStatus, context: TransitionContext): TransitionResult {
    if (fromStatus !== SubscriptionStatus.CANCELED) {
      return TransitionResult.invalid('Refund can only be processed for canceled subscriptions');
    }

    if (!context.metadata?.refundApproved) {
      return TransitionResult.invalid('Refund must be approved before processing');
    }

    return TransitionResult.valid('Subscription refunded successfully');
  }
}

/**
 * 支付狀態機
 * 管理支付狀態的轉換邏輯和驗證規則
 */
export class PaymentStateMachine {
  /**
   * 有效的狀態轉換對應表
   */
  private static readonly VALID_TRANSITIONS = new Map<PaymentStatus, PaymentStatus[]>([
    [PaymentStatus.PENDING, [PaymentStatus.PROCESSING, PaymentStatus.CANCELED]],
    [PaymentStatus.PROCESSING, [PaymentStatus.SUCCEEDED, PaymentStatus.FAILED, PaymentStatus.CANCELED]],
    [PaymentStatus.FAILED, [PaymentStatus.RETRYING, PaymentStatus.CANCELED]],
    [PaymentStatus.RETRYING, [PaymentStatus.PROCESSING, PaymentStatus.CANCELED]],
    [PaymentStatus.SUCCEEDED, [PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED]],
    [PaymentStatus.PARTIALLY_REFUNDED, [PaymentStatus.REFUNDED]],
    // 終止狀態無法轉換
    [PaymentStatus.CANCELED, []],
    [PaymentStatus.REFUNDED, []],
  ]);

  /**
   * 支付失敗分類對應的重試策略
   */
  private static readonly RETRY_STRATEGIES = new Map<
    PaymentFailureCategory,
    {
      canRetry: boolean;
      maxRetries: number;
      delayMinutes: number[];
    }
  >([
    [
      PaymentFailureCategory.RETRIABLE,
      {
        canRetry: true,
        maxRetries: 3,
        delayMinutes: [5, 15, 60], // 5分鐘、15分鐘、1小時後重試
      },
    ],
    [
      PaymentFailureCategory.DELAYED_RETRY,
      {
        canRetry: true,
        maxRetries: 5,
        delayMinutes: [60, 180, 360, 720, 1440], // 1小時、3小時、6小時、12小時、24小時
      },
    ],
    [
      PaymentFailureCategory.NON_RETRIABLE,
      {
        canRetry: false,
        maxRetries: 0,
        delayMinutes: [],
      },
    ],
  ]);

  /**
   * 檢查狀態轉換是否有效
   */
  static canTransition(fromStatus: PaymentStatus, toStatus: PaymentStatus): boolean {
    const validTransitions = this.VALID_TRANSITIONS.get(fromStatus);
    return validTransitions?.includes(toStatus) ?? false;
  }

  /**
   * 驗證狀態轉換
   */
  static validateTransition(fromStatus: PaymentStatus, toStatus: PaymentStatus, context: TransitionContext = {}): TransitionResult {
    if (!this.canTransition(fromStatus, toStatus)) {
      return TransitionResult.invalid(`Invalid payment transition from ${fromStatus} to ${toStatus}`);
    }

    if (fromStatus === toStatus) {
      return TransitionResult.valid('No state change required');
    }

    // 根據目標狀態進行特定驗證
    switch (toStatus) {
      case PaymentStatus.RETRYING:
        return this.validateTransitionToRetrying(fromStatus, context);
      case PaymentStatus.REFUNDED:
      case PaymentStatus.PARTIALLY_REFUNDED:
        return this.validateTransitionToRefund(fromStatus, context);
      default:
        return TransitionResult.valid();
    }
  }

  /**
   * 取得重試策略
   */
  static getRetryStrategy(failureCategory: PaymentFailureCategory) {
    return this.RETRY_STRATEGIES.get(failureCategory);
  }

  /**
   * 計算下次重試時間
   */
  static calculateNextRetryTime(failureCategory: PaymentFailureCategory, retryAttempt: number): Date | null {
    const strategy = this.getRetryStrategy(failureCategory);
    if (!strategy || !strategy.canRetry || retryAttempt >= strategy.maxRetries) {
      return null;
    }

    const delayMinutes = strategy.delayMinutes[retryAttempt] || strategy.delayMinutes[strategy.delayMinutes.length - 1];
    return new Date(Date.now() + delayMinutes * 60 * 1000);
  }

  /**
   * 檢查是否為終止狀態
   */
  static isTerminalState(status: PaymentStatus): boolean {
    return [PaymentStatus.SUCCEEDED, PaymentStatus.CANCELED, PaymentStatus.REFUNDED].includes(status);
  }

  /**
   * 驗證轉換到重試狀態
   */
  private static validateTransitionToRetrying(fromStatus: PaymentStatus, context: TransitionContext): TransitionResult {
    if (fromStatus !== PaymentStatus.FAILED) {
      return TransitionResult.invalid('Can only retry from FAILED state');
    }

    const failureCategory = context.metadata?.failureCategory as PaymentFailureCategory;
    if (!failureCategory) {
      return TransitionResult.invalid('Failure category is required for retry');
    }

    const strategy = this.getRetryStrategy(failureCategory);
    if (!strategy || !strategy.canRetry) {
      return TransitionResult.invalid('Payment failure is not retriable');
    }

    const retryAttempt = context.metadata?.retryAttempt || 0;
    if (retryAttempt >= strategy.maxRetries) {
      return TransitionResult.invalid('Maximum retry attempts exceeded');
    }

    return TransitionResult.valid('Payment entered retry state');
  }

  /**
   * 驗證轉換到退款狀態
   */
  private static validateTransitionToRefund(fromStatus: PaymentStatus, context: TransitionContext): TransitionResult {
    if (fromStatus !== PaymentStatus.SUCCEEDED && fromStatus !== PaymentStatus.PARTIALLY_REFUNDED) {
      return TransitionResult.invalid('Can only refund from SUCCEEDED or PARTIALLY_REFUNDED state');
    }

    if (!context.metadata?.refundAmount) {
      return TransitionResult.invalid('Refund amount is required');
    }

    return TransitionResult.valid('Payment refund processed');
  }
}
