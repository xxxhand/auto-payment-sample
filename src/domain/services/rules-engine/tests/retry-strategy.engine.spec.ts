import { Test, TestingModule } from '@nestjs/testing';
import { RetryStrategyEngine, RetryDecisionContext } from '../retry-strategy.engine';
import { RuleRegistry } from '../rule-registry.service';
import { PaymentFailureCategory, RetryStrategyType } from '../../../enums/codes.const';

describe('RetryStrategyEngine', () => {
  let engine: RetryStrategyEngine;
  let ruleRegistry: RuleRegistry;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RetryStrategyEngine, RuleRegistry],
    }).compile();

    engine = module.get<RetryStrategyEngine>(RetryStrategyEngine);
    ruleRegistry = module.get<RuleRegistry>(RuleRegistry);
  });

  describe('evaluateRetryDecision', () => {
    it('should allow retry for retriable failure category', async () => {
      const context: RetryDecisionContext = {
        paymentId: 'pay-123',
        subscriptionId: 'sub-123',
        failureCategory: PaymentFailureCategory.RETRIABLE,
        failureReason: 'INSUFFICIENT_FUNDS',
        attemptNumber: 1,
        lastAttemptDate: new Date(),
        totalFailureCount: 1,
        customerTier: 'BASIC',
        paymentAmount: 1000,
        currency: 'TWD',
      };

      const result = await engine.evaluateRetryDecision(context);

      expect(result.shouldRetry).toBe(true);
      expect(result.retryStrategy).toBe(RetryStrategyType.LINEAR);
      expect(result.maxRetries).toBe(3);
      expect(result.nextRetryDate).toBeInstanceOf(Date);
      expect(result.escalateToManual).toBe(false);
      expect(result.notifyCustomer).toBe(false);
    });

    it('should not allow retry for non-retriable failure', async () => {
      const context: RetryDecisionContext = {
        paymentId: 'pay-123',
        subscriptionId: 'sub-123',
        failureCategory: PaymentFailureCategory.NON_RETRIABLE,
        failureReason: 'CARD_DECLINED',
        attemptNumber: 1,
        lastAttemptDate: new Date(),
        totalFailureCount: 1,
        customerTier: 'BASIC',
        paymentAmount: 1000,
        currency: 'TWD',
      };

      const result = await engine.evaluateRetryDecision(context);

      expect(result.shouldRetry).toBe(false);
      expect(result.retryStrategy).toBe(RetryStrategyType.NONE);
      expect(result.maxRetries).toBe(0);
      expect(result.escalateToManual).toBe(true);
      expect(result.notifyCustomer).toBe(true);
    });

    it('should not retry when max attempts exceeded', async () => {
      const context: RetryDecisionContext = {
        paymentId: 'pay-123',
        subscriptionId: 'sub-123',
        failureCategory: PaymentFailureCategory.RETRIABLE,
        failureReason: 'INSUFFICIENT_FUNDS',
        attemptNumber: 3, // 已達最大重試次數
        lastAttemptDate: new Date(),
        totalFailureCount: 3,
        customerTier: 'BASIC',
        paymentAmount: 1000,
        currency: 'TWD',
      };

      const result = await engine.evaluateRetryDecision(context);

      expect(result.shouldRetry).toBe(false);
      expect(result.reason).toBe('Maximum retry attempts exceeded');
      expect(result.escalateToManual).toBe(true);
    });

    it('should extend retry limit for premium customers', async () => {
      const context: RetryDecisionContext = {
        paymentId: 'pay-123',
        subscriptionId: 'sub-123',
        failureCategory: PaymentFailureCategory.DELAYED_RETRY,
        failureReason: 'TEMPORARY_ISSUE',
        attemptNumber: 5, // 超過普通限制，但應該允許高級客戶
        lastAttemptDate: new Date(),
        totalFailureCount: 5,
        customerTier: 'PREMIUM',
        paymentAmount: 1000,
        currency: 'TWD',
      };

      const result = await engine.evaluateRetryDecision(context);

      expect(result.shouldRetry).toBe(true);
      expect(result.maxRetries).toBe(7); // 高級客戶延長到7次
      expect(result.appliedRules).toContain('retry-premium-customer-extended');
    });

    it('should immediately escalate high-value payments after multiple failures', async () => {
      const context: RetryDecisionContext = {
        paymentId: 'pay-123',
        subscriptionId: 'sub-123',
        failureCategory: PaymentFailureCategory.RETRIABLE,
        failureReason: 'INSUFFICIENT_FUNDS',
        attemptNumber: 3,
        lastAttemptDate: new Date(),
        totalFailureCount: 3,
        customerTier: 'BASIC',
        paymentAmount: 15000, // 高金額
        currency: 'TWD',
      };

      const result = await engine.evaluateRetryDecision(context);

      expect(result.shouldRetry).toBe(false);
      expect(result.escalateToManual).toBe(true);
      expect(result.reason).toBe('High-value payment requires manual review');
      expect(result.appliedRules).toContain('retry-high-amount-immediate-escalation');
    });

    it('should block retry for fraud suspected cases', async () => {
      const context: RetryDecisionContext = {
        paymentId: 'pay-123',
        subscriptionId: 'sub-123',
        failureCategory: PaymentFailureCategory.RETRIABLE,
        failureReason: 'FRAUD_SUSPECTED',
        attemptNumber: 1,
        lastAttemptDate: new Date(),
        totalFailureCount: 1,
        customerTier: 'BASIC',
        paymentAmount: 1000,
        currency: 'TWD',
      };

      const result = await engine.evaluateRetryDecision(context);

      expect(result.shouldRetry).toBe(false);
      expect(result.escalateToManual).toBe(true);
      expect(result.reason).toBe('Security concern detected - no retry allowed');
      expect(result.appliedRules).toContain('retry-fraud-suspected-block');
    });
  });

  describe('calculateNextRetryTime', () => {
    it('should calculate linear retry intervals', () => {
      const strategy = {
        strategyType: RetryStrategyType.LINEAR,
        maxRetries: 3,
        baseDelayMinutes: 5,
        maxDelayMinutes: 60,
      };

      const firstRetry = engine.calculateNextRetryTime(1, strategy);
      const secondRetry = engine.calculateNextRetryTime(2, strategy);

      expect(firstRetry.getTime() - Date.now()).toBeGreaterThan(4 * 60 * 1000); // 至少4分鐘
      expect(firstRetry.getTime() - Date.now()).toBeLessThan(6 * 60 * 1000); // 不超過6分鐘

      expect(secondRetry.getTime() - Date.now()).toBeGreaterThan(9 * 60 * 1000); // 至少9分鐘
      expect(secondRetry.getTime() - Date.now()).toBeLessThan(11 * 60 * 1000); // 不超過11分鐘
    });

    it('should calculate exponential backoff intervals', () => {
      const strategy = {
        strategyType: RetryStrategyType.EXPONENTIAL_BACKOFF,
        maxRetries: 3,
        baseDelayMinutes: 5,
        maxDelayMinutes: 60,
        multiplier: 2,
      };

      const firstRetry = engine.calculateNextRetryTime(1, strategy);
      const secondRetry = engine.calculateNextRetryTime(2, strategy);
      const thirdRetry = engine.calculateNextRetryTime(3, strategy);

      expect(firstRetry.getTime() - Date.now()).toBeCloseTo(5 * 60 * 1000, -3); // 5分鐘
      expect(secondRetry.getTime() - Date.now()).toBeCloseTo(10 * 60 * 1000, -3); // 10分鐘
      expect(thirdRetry.getTime() - Date.now()).toBeCloseTo(20 * 60 * 1000, -3); // 20分鐘
    });

    it('should respect maximum delay limits', () => {
      const strategy = {
        strategyType: RetryStrategyType.EXPONENTIAL_BACKOFF,
        maxRetries: 5,
        baseDelayMinutes: 30,
        maxDelayMinutes: 60, // 限制最大1小時
        multiplier: 2,
      };

      const longRetry = engine.calculateNextRetryTime(4, strategy);

      // 第4次重試應該是30 * 2^3 = 240分鐘，但被限制在60分鐘
      expect(longRetry.getTime() - Date.now()).toBeCloseTo(60 * 60 * 1000, -4);
    });

    it('should handle fixed interval strategy', () => {
      const strategy = {
        strategyType: RetryStrategyType.FIXED_INTERVAL,
        maxRetries: 3,
        baseDelayMinutes: 15,
        maxDelayMinutes: 60,
      };

      const firstRetry = engine.calculateNextRetryTime(1, strategy);
      const secondRetry = engine.calculateNextRetryTime(2, strategy);

      expect(firstRetry.getTime() - Date.now()).toBeCloseTo(15 * 60 * 1000, -3);
      expect(secondRetry.getTime() - Date.now()).toBeCloseTo(15 * 60 * 1000, -3);
    });
  });

  describe('getRetryStrategy', () => {
    it('should return correct default strategies', () => {
      const retriableStrategy = engine.getRetryStrategy(PaymentFailureCategory.RETRIABLE);
      expect(retriableStrategy.strategyType).toBe(RetryStrategyType.LINEAR);
      expect(retriableStrategy.maxRetries).toBe(3);
      expect(retriableStrategy.baseDelayMinutes).toBe(5);

      const delayedRetryStrategy = engine.getRetryStrategy(PaymentFailureCategory.DELAYED_RETRY);
      expect(delayedRetryStrategy.strategyType).toBe(RetryStrategyType.EXPONENTIAL_BACKOFF);
      expect(delayedRetryStrategy.maxRetries).toBe(5);
      expect(delayedRetryStrategy.multiplier).toBe(2);

      const nonRetriableStrategy = engine.getRetryStrategy(PaymentFailureCategory.NON_RETRIABLE);
      expect(nonRetriableStrategy.strategyType).toBe(RetryStrategyType.NONE);
      expect(nonRetriableStrategy.maxRetries).toBe(0);
    });
  });

  describe('integration with rule registry', () => {
    it('should register default retry rules', () => {
      const stats = ruleRegistry.getStatistics();
      expect(stats.totalRules).toBeGreaterThan(0);

      const premiumExtendRule = ruleRegistry.getRule('retry-premium-customer-extended');
      expect(premiumExtendRule).toBeDefined();
      expect(premiumExtendRule?.name).toBe('高級客戶延長重試規則');

      const highAmountRule = ruleRegistry.getRule('retry-high-amount-immediate-escalation');
      expect(highAmountRule).toBeDefined();
      expect(highAmountRule?.name).toBe('高額支付立即升級規則');
    });

    it('should apply multiple rules in correct priority order', async () => {
      // 測試高金額 + 高級客戶的情況
      const context: RetryDecisionContext = {
        paymentId: 'pay-123',
        subscriptionId: 'sub-123',
        failureCategory: PaymentFailureCategory.RETRIABLE,
        failureReason: 'INSUFFICIENT_FUNDS',
        attemptNumber: 3,
        lastAttemptDate: new Date(),
        totalFailureCount: 3,
        customerTier: 'PREMIUM',
        paymentAmount: 15000, // 高金額，觸發立即升級規則（更高優先級）
        currency: 'TWD',
      };

      const result = await engine.evaluateRetryDecision(context);

      // 高優先級的升級規則應該覆蓋延長重試規則
      expect(result.shouldRetry).toBe(false);
      expect(result.escalateToManual).toBe(true);
      expect(result.appliedRules).toContain('retry-high-amount-immediate-escalation');
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle missing customer tier', async () => {
      const context: RetryDecisionContext = {
        paymentId: 'pay-123',
        subscriptionId: 'sub-123',
        failureCategory: PaymentFailureCategory.RETRIABLE,
        failureReason: 'INSUFFICIENT_FUNDS',
        attemptNumber: 1,
        lastAttemptDate: new Date(),
        totalFailureCount: 1,
        // customerTier 故意省略
        paymentAmount: 1000,
        currency: 'TWD',
      };

      const result = await engine.evaluateRetryDecision(context);

      expect(result.shouldRetry).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.originalFailureCategory).toBe(PaymentFailureCategory.RETRIABLE);
    });

    it('should provide comprehensive metadata', async () => {
      const context: RetryDecisionContext = {
        paymentId: 'pay-123',
        subscriptionId: 'sub-123',
        failureCategory: PaymentFailureCategory.DELAYED_RETRY,
        failureReason: 'TEMPORARY_ISSUE',
        attemptNumber: 2,
        lastAttemptDate: new Date(),
        totalFailureCount: 2,
        customerTier: 'BASIC',
        paymentAmount: 1000,
        currency: 'TWD',
      };

      const result = await engine.evaluateRetryDecision(context);

      expect(result.metadata).toMatchObject({
        originalFailureCategory: PaymentFailureCategory.DELAYED_RETRY,
        strategyType: RetryStrategyType.EXPONENTIAL_BACKOFF,
        evaluatedRules: expect.any(Number),
        appliedRules: expect.any(Number),
        timestamp: expect.any(Date),
      });
    });

    it('should handle attempt number edge cases', async () => {
      // 測試 attemptNumber = 0 的情況
      const contextZero: RetryDecisionContext = {
        paymentId: 'pay-123',
        subscriptionId: 'sub-123',
        failureCategory: PaymentFailureCategory.RETRIABLE,
        failureReason: 'INSUFFICIENT_FUNDS',
        attemptNumber: 0,
        lastAttemptDate: new Date(),
        totalFailureCount: 0,
        customerTier: 'BASIC',
        paymentAmount: 1000,
        currency: 'TWD',
      };

      const resultZero = await engine.evaluateRetryDecision(contextZero);
      expect(resultZero.shouldRetry).toBe(true);

      // 測試負數 attemptNumber
      const contextNegative: RetryDecisionContext = {
        ...contextZero,
        attemptNumber: -1,
      };

      const resultNegative = await engine.evaluateRetryDecision(contextNegative);
      expect(resultNegative.shouldRetry).toBe(true);
    });
  });
});
