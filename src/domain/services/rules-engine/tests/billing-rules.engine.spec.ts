import { Test, TestingModule } from '@nestjs/testing';
import { BillingRulesEngine, BillingDecisionContext } from '../billing-rules.engine';
import { RuleRegistry } from '../rule-registry.service';
import { Money } from '../../../value-objects/money';
import { BillingCycleVO } from '../../../value-objects/billing-cycle';
import { SubscriptionStatus, BillingCycle } from '../../../enums/codes.const';

describe('BillingRulesEngine', () => {
  let engine: BillingRulesEngine;
  let ruleRegistry: RuleRegistry;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BillingRulesEngine, RuleRegistry],
    }).compile();

    engine = module.get<BillingRulesEngine>(BillingRulesEngine);
    ruleRegistry = module.get<RuleRegistry>(RuleRegistry);
  });

  describe('evaluateBillingDecision', () => {
    it('should allow billing for normal active subscription', async () => {
      const context: BillingDecisionContext = {
        subscriptionId: 'sub-123',
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        currentAmount: new Money(1000, 'TWD'),
        billingCycle: new BillingCycleVO(BillingCycle.MONTHLY, 1),
        lastPaymentDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        failureCount: 0,
        paymentMethodValid: true,
        customerTier: 'BASIC',
      };

      const result = await engine.evaluateBillingDecision(context);

      expect(result.shouldAttemptBilling).toBe(true);
      expect(result.recommendedAmount.amount).toBe(1000);
      expect(result.reason).toBe('Standard billing');
      expect(result.appliedRules).toEqual([]);
    });

    it('should block billing for invalid payment method', async () => {
      const context: BillingDecisionContext = {
        subscriptionId: 'sub-123',
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        currentAmount: new Money(1000, 'TWD'),
        billingCycle: new BillingCycleVO(BillingCycle.MONTHLY, 1),
        failureCount: 0,
        paymentMethodValid: false,
        customerTier: 'BASIC',
      };

      const result = await engine.evaluateBillingDecision(context);

      expect(result.shouldAttemptBilling).toBe(false);
      expect(result.reason).toBe('Payment method is invalid or expired');
      expect(result.appliedRules).toContain('billing-block-inactive-payment-method');
    });

    it('should block billing for expired grace period', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 昨天
      const context: BillingDecisionContext = {
        subscriptionId: 'sub-123',
        subscriptionStatus: SubscriptionStatus.PAST_DUE,
        currentAmount: new Money(1000, 'TWD'),
        billingCycle: new BillingCycleVO(BillingCycle.MONTHLY, 1),
        failureCount: 1,
        gracePeriodEndDate: pastDate,
        paymentMethodValid: true,
        customerTier: 'BASIC',
      };

      const result = await engine.evaluateBillingDecision(context);

      expect(result.shouldAttemptBilling).toBe(false);
      expect(result.reason).toBe('Grace period has expired');
      expect(result.appliedRules).toContain('billing-grace-period-expired');
    });

    it('should apply premium tier discount', async () => {
      const context: BillingDecisionContext = {
        subscriptionId: 'sub-123',
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        currentAmount: new Money(1000, 'TWD'),
        billingCycle: new BillingCycleVO(BillingCycle.MONTHLY, 1),
        failureCount: 0,
        paymentMethodValid: true,
        customerTier: 'PREMIUM',
      };

      const result = await engine.evaluateBillingDecision(context);

      expect(result.shouldAttemptBilling).toBe(true);
      expect(result.recommendedAmount.amount).toBe(950); // 5% 折扣
      expect(result.reason).toBe('Amount adjusted by rule: 高級會員扣款優惠');
      expect(result.appliedRules).toContain('billing-premium-tier-discount');
    });

    it('should delay billing for high failure count', async () => {
      const context: BillingDecisionContext = {
        subscriptionId: 'sub-123',
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        currentAmount: new Money(1000, 'TWD'),
        billingCycle: new BillingCycleVO(BillingCycle.MONTHLY, 1),
        failureCount: 3,
        paymentMethodValid: true,
        customerTier: 'BASIC',
      };

      const result = await engine.evaluateBillingDecision(context);

      expect(result.shouldAttemptBilling).toBe(true);
      expect(result.billingDelay).toBe(60); // 延遲60分鐘
      expect(result.reason).toBe('Delayed by rule: 高失敗次數延遲規則');
      expect(result.appliedRules).toContain('billing-high-failure-count-delay');
    });
  });

  describe('calculateGracePeriodEndDate', () => {
    it('should calculate correct grace period end date', () => {
      const failureDate = new Date('2024-01-01T10:00:00Z');
      const endDate = engine.calculateGracePeriodEndDate(failureDate, 5);

      const expectedEndDate = new Date('2024-01-06T10:00:00Z');
      expect(endDate).toEqual(expectedEndDate);
    });

    it('should use default grace period of 3 days', () => {
      const failureDate = new Date('2024-01-01T10:00:00Z');
      const endDate = engine.calculateGracePeriodEndDate(failureDate);

      const expectedEndDate = new Date('2024-01-04T10:00:00Z');
      expect(endDate).toEqual(expectedEndDate);
    });
  });

  describe('calculateProrationAmount', () => {
    it('should calculate correct proration amount for upgrade', () => {
      const fromAmount = new Money(500, 'TWD');
      const toAmount = new Money(1000, 'TWD');
      const billingCycle = new BillingCycleVO(BillingCycle.MONTHLY, 1);
      const changeDate = new Date('2024-01-15T00:00:00Z'); // 月中
      const periodEndDate = new Date('2024-02-01T00:00:00Z'); // 月末

      const prorationAmount = engine.calculateProrationAmount(fromAmount, toAmount, billingCycle, changeDate, periodEndDate);

      // 應該是差額的一半左右 (17天/31天 ≈ 55%)
      expect(prorationAmount.amount).toBeGreaterThan(200);
      expect(prorationAmount.amount).toBeLessThan(300);
      expect(prorationAmount.currency).toBe('TWD');
    });

    it('should return zero for past period end date', () => {
      const fromAmount = new Money(500, 'TWD');
      const toAmount = new Money(1000, 'TWD');
      const billingCycle = new BillingCycleVO(BillingCycle.MONTHLY, 1);
      const changeDate = new Date('2024-01-15T00:00:00Z');
      const periodEndDate = new Date('2024-01-10T00:00:00Z'); // 過去日期

      const prorationAmount = engine.calculateProrationAmount(fromAmount, toAmount, billingCycle, changeDate, periodEndDate);

      expect(prorationAmount.amount).toBe(0);
    });

    it('should handle downgrade correctly', () => {
      const fromAmount = new Money(1000, 'TWD');
      const toAmount = new Money(500, 'TWD');
      const billingCycle = new BillingCycleVO(BillingCycle.MONTHLY, 1);
      const changeDate = new Date('2024-01-15T00:00:00Z');
      const periodEndDate = new Date('2024-02-01T00:00:00Z');

      const prorationAmount = engine.calculateProrationAmount(fromAmount, toAmount, billingCycle, changeDate, periodEndDate);

      // 降級應該是負數（退款）
      expect(prorationAmount.amount).toBeLessThan(0);
      expect(prorationAmount.currency).toBe('TWD');
    });
  });

  describe('integration with rule registry', () => {
    it('should register default billing rules', () => {
      const stats = ruleRegistry.getStatistics();
      expect(stats.totalRules).toBeGreaterThan(0);

      // 檢查特定規則是否已註冊
      const invalidPaymentRule = ruleRegistry.getRule('billing-block-inactive-payment-method');
      expect(invalidPaymentRule).toBeDefined();
      expect(invalidPaymentRule?.name).toBe('無效付款方式阻擋規則');

      const premiumDiscountRule = ruleRegistry.getRule('billing-premium-tier-discount');
      expect(premiumDiscountRule).toBeDefined();
      expect(premiumDiscountRule?.name).toBe('高級會員扣款優惠');
    });

    it('should respect rule priorities', async () => {
      const context: BillingDecisionContext = {
        subscriptionId: 'sub-123',
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        currentAmount: new Money(1000, 'TWD'),
        billingCycle: new BillingCycleVO(BillingCycle.MONTHLY, 1),
        failureCount: 3, // 觸發延遲規則
        paymentMethodValid: true,
        customerTier: 'PREMIUM', // 觸發折扣規則
      };

      const result = await engine.evaluateBillingDecision(context);

      // 應該同時應用兩個規則
      expect(result.appliedRules).toContain('billing-premium-tier-discount');
      expect(result.appliedRules).toContain('billing-high-failure-count-delay');
      expect(result.recommendedAmount.amount).toBe(950); // 折扣已應用
      expect(result.billingDelay).toBe(60); // 延遲已應用
    });
  });

  describe('error handling', () => {
    it('should handle missing metadata gracefully', async () => {
      const context: BillingDecisionContext = {
        subscriptionId: 'sub-123',
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        currentAmount: new Money(1000, 'TWD'),
        billingCycle: new BillingCycleVO(BillingCycle.MONTHLY, 1),
        failureCount: 0,
        paymentMethodValid: true,
        // customerTier 故意省略
      };

      const result = await engine.evaluateBillingDecision(context);

      expect(result.shouldAttemptBilling).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.evaluatedRules).toBeGreaterThan(0);
    });

    it('should provide meaningful metadata in results', async () => {
      const context: BillingDecisionContext = {
        subscriptionId: 'sub-123',
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        currentAmount: new Money(1000, 'TWD'),
        billingCycle: new BillingCycleVO(BillingCycle.MONTHLY, 1),
        failureCount: 0,
        paymentMethodValid: true,
        customerTier: 'BASIC',
      };

      const result = await engine.evaluateBillingDecision(context);

      expect(result.metadata).toMatchObject({
        evaluatedRules: expect.any(Number),
        appliedRules: expect.any(Number),
        timestamp: expect.any(Date),
      });
    });
  });
});
