import { PaymentFailureCategory, RetryStrategyType } from '../enums/codes.const';

export interface RetryPolicyConfig {
  strategy: RetryStrategyType;
  maxRetries: number;
  baseDelayMinutes: number;
  maxDelayMinutes?: number;
  multiplier?: number; // for exponential
}

export class RetryPolicy {
  constructor(
    public readonly category: PaymentFailureCategory,
    public readonly config: RetryPolicyConfig,
  ) {}

  static forCategory(category: PaymentFailureCategory): RetryPolicy {
    switch (category) {
      case PaymentFailureCategory.RETRIABLE:
        return new RetryPolicy(category, {
          strategy: RetryStrategyType.EXPONENTIAL_BACKOFF,
          maxRetries: 5,
          baseDelayMinutes: 5,
          maxDelayMinutes: 60,
          multiplier: 2,
        });
      case PaymentFailureCategory.DELAYED_RETRY:
        return new RetryPolicy(category, {
          strategy: RetryStrategyType.FIXED_INTERVAL,
          maxRetries: 3,
          baseDelayMinutes: 60, // 1 hour
          maxDelayMinutes: 1440, // 24 hours
        });
      case PaymentFailureCategory.NON_RETRIABLE:
      default:
        return new RetryPolicy(category, {
          strategy: RetryStrategyType.NONE,
          maxRetries: 0,
          baseDelayMinutes: 0,
        });
    }
  }

  nextRetryAt(attemptNumber: number, now: Date = new Date()): Date | undefined {
    if (attemptNumber >= this.config.maxRetries || this.config.strategy === RetryStrategyType.NONE) {
      return undefined;
    }

    const minutes = this.calculateDelayMinutes(attemptNumber + 1); // next attempt number
    return new Date(now.getTime() + minutes * 60 * 1000);
  }

  calculateDelayMinutes(attemptNumber: number): number {
    const { strategy, baseDelayMinutes, multiplier = 2, maxDelayMinutes } = this.config;
    let delay = baseDelayMinutes;

    switch (strategy) {
      case RetryStrategyType.LINEAR:
        delay = baseDelayMinutes * attemptNumber;
        break;
      case RetryStrategyType.EXPONENTIAL_BACKOFF:
        delay = baseDelayMinutes * Math.pow(multiplier, Math.max(0, attemptNumber - 1));
        break;
      case RetryStrategyType.FIXED_INTERVAL:
        delay = baseDelayMinutes;
        break;
      case RetryStrategyType.NONE:
      default:
        delay = 0;
    }

    if (maxDelayMinutes !== undefined) {
      delay = Math.min(delay, maxDelayMinutes);
    }

    return delay;
  }
}
