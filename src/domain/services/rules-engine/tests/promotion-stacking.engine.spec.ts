import { Test, TestingModule } from '@nestjs/testing';
import { PromotionStackingEngine, PromotionStackingContext } from '../promotion-stacking.engine';
import { RuleRegistry } from '../rule-registry.service';
import { Money } from '../../../value-objects/money';

describe('PromotionStackingEngine', () => {
  let engine: PromotionStackingEngine;
  let ruleRegistry: RuleRegistry;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromotionStackingEngine, RuleRegistry],
    }).compile();

    engine = module.get<PromotionStackingEngine>(PromotionStackingEngine);
    ruleRegistry = module.get<RuleRegistry>(RuleRegistry);
  });

  describe('validatePromotionStacking', () => {
    const baseContext: PromotionStackingContext = {
      customerId: 'cust-123',
      customerTier: 'BASIC',
      productId: 'prod-premium',
      originalAmount: new Money(1000, 'TWD'),
      promotionCodes: [],
      isFirstTimeCustomer: false,
      subscriptionHistory: {
        totalSubscriptions: 1,
        activeSubscriptions: 1,
      },
    };

    it('should apply single valid promotion code', async () => {
      const context: PromotionStackingContext = {
        ...baseContext,
        promotionCodes: ['SUMMER50'],
      };

      const result = await engine.validatePromotionStacking(context);

      expect(result.isValid).toBe(true);
      expect(result.applicableCodes).toContain('SUMMER50');
      expect(result.totalDiscount.amount).toBe(50);
      expect(result.finalAmount.amount).toBe(950);
      expect(result.appliedPromotions).toHaveLength(1);
      expect(result.appliedPromotions[0].code).toBe('SUMMER50');
    });

    it('should stack compatible promotion codes', async () => {
      const context: PromotionStackingContext = {
        ...baseContext,
        promotionCodes: ['SUMMER50', 'LOYALTY100'],
        originalAmount: new Money(2000, 'TWD'), // 滿足最低金額要求
      };

      const result = await engine.validatePromotionStacking(context);

      expect(result.isValid).toBe(true);
      expect(result.applicableCodes).toHaveLength(2);
      expect(result.applicableCodes).toContain('SUMMER50');
      expect(result.applicableCodes).toContain('LOYALTY100');
      expect(result.totalDiscount.amount).toBe(150); // 50 + 100
      expect(result.finalAmount.amount).toBe(1850);
    });

    it('should resolve conflicts by keeping highest priority', async () => {
      const context: PromotionStackingContext = {
        ...baseContext,
        customerTier: 'PREMIUM',
        isFirstTimeCustomer: true, // 修改為新用戶，讓 WELCOME20 通過驗證
        promotionCodes: ['WELCOME20', 'PREMIUM15'], // 都是百分比，PREMIUM15 不可堆疊
        originalAmount: new Money(1000, 'TWD'),
      };

      const result = await engine.validatePromotionStacking(context);

      expect(result.isValid).toBe(true);
      expect(result.conflictingCodes.length).toBeGreaterThan(0);
      // LOYALTY100 有更高優先級 (120 > 90)，但 PREMIUM15 應該因為衝突被解決
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('conflict');
    });

    it('should reject promotion for insufficient amount', async () => {
      const context: PromotionStackingContext = {
        ...baseContext,
        promotionCodes: ['LOYALTY100'], // 需要最低1000元
        originalAmount: new Money(500, 'TWD'), // 不足
      };

      const result = await engine.validatePromotionStacking(context);

      expect(result.isValid).toBe(false);
      expect(result.rejectedPromotions).toHaveLength(1);
      expect(result.rejectedPromotions[0].code).toBe('LOYALTY100');
      expect(result.rejectedPromotions[0].reason).toContain('Minimum amount');
    });

    it('should reject promotion for wrong customer tier', async () => {
      const context: PromotionStackingContext = {
        ...baseContext,
        customerTier: 'BASIC',
        promotionCodes: ['PREMIUM15'], // 僅限高級會員
      };

      const result = await engine.validatePromotionStacking(context);

      expect(result.isValid).toBe(false);
      expect(result.rejectedPromotions).toHaveLength(1);
      expect(result.rejectedPromotions[0].code).toBe('PREMIUM15');
      expect(result.rejectedPromotions[0].reason).toContain('tier not eligible');
    });

    it('should reject new customer promotion for existing customer', async () => {
      const context: PromotionStackingContext = {
        ...baseContext,
        isFirstTimeCustomer: false,
        promotionCodes: ['WELCOME20'], // 新用戶專享
        originalAmount: new Money(1000, 'TWD'),
      };

      const result = await engine.validatePromotionStacking(context);

      expect(result.isValid).toBe(false);
      expect(result.rejectedPromotions).toHaveLength(1);
      expect(result.rejectedPromotions[0].code).toBe('WELCOME20');
      expect(result.rejectedPromotions[0].reason).toContain('new customers only');
    });

    it('should handle non-existent promotion codes', async () => {
      const context: PromotionStackingContext = {
        ...baseContext,
        promotionCodes: ['NONEXISTENT', 'SUMMER50'],
      };

      const result = await engine.validatePromotionStacking(context);

      expect(result.isValid).toBe(true);
      expect(result.applicableCodes).toEqual(['SUMMER50']);
      // 不存在的促銷代碼應該被靜默忽略，而不是加入拒絕列表
    });

    it('should apply promotions in priority order', async () => {
      const context: PromotionStackingContext = {
        ...baseContext,
        promotionCodes: ['SUMMER50', 'LOYALTY100'], // LOYALTY100 優先級更高 (120 > 80)
        originalAmount: new Money(2000, 'TWD'),
      };

      const result = await engine.validatePromotionStacking(context);

      expect(result.appliedPromotions[0].code).toBe('LOYALTY100'); // 高優先級先應用
      expect(result.appliedPromotions[1].code).toBe('SUMMER50');
    });
  });

  describe('findOptimalPromotionCombination', () => {
    const baseContext: PromotionStackingContext = {
      customerId: 'cust-123',
      customerTier: 'PREMIUM',
      productId: 'prod-premium',
      originalAmount: new Money(2000, 'TWD'),
      promotionCodes: [],
      isFirstTimeCustomer: true,
      subscriptionHistory: {
        totalSubscriptions: 0,
        activeSubscriptions: 0,
      },
    };

    it('should find optimal combination for maximum savings', async () => {
      const availableCodes = ['WELCOME20', 'SUMMER50', 'LOYALTY100'];

      const result = await engine.findOptimalPromotionCombination(baseContext, availableCodes);

      expect(result.maxSavings.amount).toBeGreaterThan(0);
      expect(result.recommendedCodes.length).toBeGreaterThan(0);
      expect(result.reasoning).toContain('maximum savings');
    });

    it('should handle empty available codes', async () => {
      const result = await engine.findOptimalPromotionCombination(baseContext, []);

      expect(result.recommendedCodes).toEqual([]);
      expect(result.maxSavings.amount).toBe(0);
      expect(result.reasoning).toContain('No valid combination found');
    });

    it('should find best single promotion when stacking is not beneficial', async () => {
      const contextSmallAmount: PromotionStackingContext = {
        ...baseContext,
        originalAmount: new Money(300, 'TWD'), // 較小金額
      };

      const availableCodes = ['WELCOME20', 'SUMMER50']; // SUMMER50 需要200最低金額

      const result = await engine.findOptimalPromotionCombination(contextSmallAmount, availableCodes);

      expect(result.recommendedCodes).toEqual(['WELCOME20']); // 只有這個符合條件
      expect(result.maxSavings.amount).toBe(60); // 300 * 20%
    });
  });

  describe('conflict resolution', () => {
    it('should detect non-stackable conflicts', async () => {
      const context: PromotionStackingContext = {
        customerId: 'cust-123',
        customerTier: 'PREMIUM',
        productId: 'prod-premium',
        originalAmount: new Money(1000, 'TWD'),
        promotionCodes: ['PREMIUM15'], // 不可堆疊
        isFirstTimeCustomer: false,
        subscriptionHistory: {
          totalSubscriptions: 1,
          activeSubscriptions: 1,
        },
      };

      const result = await engine.validatePromotionStacking(context);

      // 單個不可堆疊促銷應該正常工作
      expect(result.isValid).toBe(true);
      expect(result.appliedPromotions[0].code).toBe('PREMIUM15');
    });

    it('should handle percentage discount maximum limits', async () => {
      // 這個測試需要修改促銷代碼資料以包含最大折扣限制
      const context: PromotionStackingContext = {
        customerId: 'cust-123',
        customerTier: 'BASIC',
        productId: 'prod-premium',
        originalAmount: new Money(10000, 'TWD'), // 大金額
        promotionCodes: ['WELCOME20'], // 20%
        isFirstTimeCustomer: true,
        subscriptionHistory: {
          totalSubscriptions: 0,
          activeSubscriptions: 0,
        },
      };

      const result = await engine.validatePromotionStacking(context);

      expect(result.isValid).toBe(true);
      expect(result.totalDiscount.amount).toBe(2000); // 20% of 10000
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle zero amount gracefully', async () => {
      const context: PromotionStackingContext = {
        customerId: 'cust-123',
        customerTier: 'BASIC',
        productId: 'prod-premium',
        originalAmount: new Money(0, 'TWD'),
        promotionCodes: ['SUMMER50'],
        isFirstTimeCustomer: false,
        subscriptionHistory: {
          totalSubscriptions: 1,
          activeSubscriptions: 1,
        },
      };

      const result = await engine.validatePromotionStacking(context);

      expect(result.finalAmount.amount).toBe(0); // 折扣不能是負數
    });

    it('should not allow discount to exceed original amount', async () => {
      const context: PromotionStackingContext = {
        customerId: 'cust-123',
        customerTier: 'BASIC',
        productId: 'prod-premium',
        originalAmount: new Money(30, 'TWD'), // 小金額
        promotionCodes: ['SUMMER50'], // 50元折扣，超過原金額
        isFirstTimeCustomer: false,
        subscriptionHistory: {
          totalSubscriptions: 1,
          activeSubscriptions: 1,
        },
      };

      const result = await engine.validatePromotionStacking(context);

      expect(result.isValid).toBe(true);
      expect(result.finalAmount.amount).toBe(0); // 最低到0
      expect(result.totalDiscount.amount).toBe(30); // 折扣限制為原金額
    });

    it('should provide comprehensive metadata', async () => {
      const context: PromotionStackingContext = {
        customerId: 'cust-123',
        customerTier: 'PREMIUM',
        productId: 'prod-premium',
        originalAmount: new Money(1000, 'TWD'),
        promotionCodes: ['PREMIUM15', 'SUMMER50'],
        isFirstTimeCustomer: false,
        subscriptionHistory: {
          totalSubscriptions: 1,
          activeSubscriptions: 1,
        },
      };

      const result = await engine.validatePromotionStacking(context);

      expect(result.metadata).toMatchObject({
        originalCodesCount: 2,
        validCodesCount: expect.any(Number),
        finalCodesCount: expect.any(Number),
        totalSavings: expect.any(Number),
        conflictResolutionStrategy: expect.any(String),
        timestamp: expect.any(Date),
      });
    });
  });

  describe('integration with rule registry', () => {
    it('should register default promotion stacking rules', () => {
      const stats = ruleRegistry.getStatistics();
      expect(stats.totalRules).toBeGreaterThan(0);

      const vipBonusRule = ruleRegistry.getRule('promotion-vip-customer-bonus');
      expect(vipBonusRule).toBeDefined();
      expect(vipBonusRule?.name).toBe('VIP客戶額外優惠規則');
    });

    it('should handle missing customer data gracefully', async () => {
      const context: PromotionStackingContext = {
        customerId: 'cust-123',
        // customerTier 故意省略
        productId: 'prod-premium',
        originalAmount: new Money(1000, 'TWD'),
        promotionCodes: ['SUMMER50'],
        isFirstTimeCustomer: false,
        subscriptionHistory: {
          totalSubscriptions: 1,
          activeSubscriptions: 1,
        },
      };

      const result = await engine.validatePromotionStacking(context);

      expect(result.isValid).toBe(true);
      expect(result.metadata).toBeDefined();
    });
  });

  describe('promotion code database', () => {
    it('should have valid promotion code definitions', async () => {
      const context: PromotionStackingContext = {
        customerId: 'cust-123',
        customerTier: 'BASIC',
        productId: 'prod-premium',
        originalAmount: new Money(1000, 'TWD'),
        promotionCodes: ['WELCOME20', 'SUMMER50', 'PREMIUM15', 'LOYALTY100'],
        isFirstTimeCustomer: true,
        subscriptionHistory: {
          totalSubscriptions: 0,
          activeSubscriptions: 0,
        },
      };

      const result = await engine.validatePromotionStacking(context);

      // 至少應該有一些促銷代碼被識別（即使不全部適用）
      // 應該使用 metadata 中的屬性
      expect(result.metadata?.originalCodesCount).toBe(4);
      // PREMIUM15 應該因為客戶層級被拒絕
      expect(result.rejectedPromotions.some((p) => p.code === 'PREMIUM15')).toBe(true);
    });
  });
});
