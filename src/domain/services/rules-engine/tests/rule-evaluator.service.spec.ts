import { Test, TestingModule } from '@nestjs/testing';
import { RuleEvaluator } from '../rule-evaluator.service';
import { IRuleDefinition, IRuleExecutionContext, RuleType, RuleOperator } from '../interfaces/rules-engine.interface';

describe('RuleEvaluator', () => {
  let service: RuleEvaluator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RuleEvaluator],
    }).compile();

    service = module.get<RuleEvaluator>(RuleEvaluator);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('evaluateRule', () => {
    it('should return false for disabled rule', async () => {
      const rule: IRuleDefinition = {
        id: 'test-rule',
        name: 'Test Rule',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [],
        actions: [],
        enabled: false,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const context: IRuleExecutionContext = {
        data: {},
        timestamp: new Date(),
      };

      const result = await service.evaluateRule(rule, context);
      expect(result).toBe(false);
    });

    it('should return false for rule outside valid time range', async () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const rule: IRuleDefinition = {
        id: 'test-rule',
        name: 'Test Rule',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [],
        actions: [],
        enabled: true,
        validFrom: tomorrow, // 規則明天才生效
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const context: IRuleExecutionContext = {
        data: {},
        timestamp: now,
      };

      const result = await service.evaluateRule(rule, context);
      expect(result).toBe(false);
    });

    it('should evaluate EQUALS condition correctly', async () => {
      const rule: IRuleDefinition = {
        id: 'test-rule',
        name: 'Test Rule',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [
          {
            field: 'userType',
            operator: RuleOperator.EQUALS,
            value: 'premium',
          },
        ],
        actions: [],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const context: IRuleExecutionContext = {
        data: { userType: 'premium' },
        timestamp: new Date(),
      };

      const result = await service.evaluateRule(rule, context);
      expect(result).toBe(true);
    });

    it('should evaluate GREATER_THAN condition correctly', async () => {
      const rule: IRuleDefinition = {
        id: 'test-rule',
        name: 'Test Rule',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [
          {
            field: 'amount',
            operator: RuleOperator.GREATER_THAN,
            value: 1000,
          },
        ],
        actions: [],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const context: IRuleExecutionContext = {
        data: { amount: 1500 },
        timestamp: new Date(),
      };

      const result = await service.evaluateRule(rule, context);
      expect(result).toBe(true);
    });

    it('should evaluate nested field path correctly', async () => {
      const rule: IRuleDefinition = {
        id: 'test-rule',
        name: 'Test Rule',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [
          {
            field: 'user.subscription.status',
            operator: RuleOperator.EQUALS,
            value: 'active',
          },
        ],
        actions: [],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const context: IRuleExecutionContext = {
        data: {
          user: {
            subscription: {
              status: 'active',
            },
          },
        },
        timestamp: new Date(),
      };

      const result = await service.evaluateRule(rule, context);
      expect(result).toBe(true);
    });

    it('should evaluate multiple conditions with AND logic', async () => {
      const rule: IRuleDefinition = {
        id: 'test-rule',
        name: 'Test Rule',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [
          {
            field: 'userType',
            operator: RuleOperator.EQUALS,
            value: 'premium',
          },
          {
            field: 'amount',
            operator: RuleOperator.GREATER_THAN,
            value: 500,
          },
        ],
        actions: [],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const context: IRuleExecutionContext = {
        data: { userType: 'premium', amount: 1000 },
        timestamp: new Date(),
      };

      const result = await service.evaluateRule(rule, context);
      expect(result).toBe(true);

      // 測試條件不全滿足的情況
      context.data.amount = 300;
      const result2 = await service.evaluateRule(rule, context);
      expect(result2).toBe(false);
    });

    it('should evaluate CONTAINS condition for arrays', async () => {
      const rule: IRuleDefinition = {
        id: 'test-rule',
        name: 'Test Rule',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [
          {
            field: 'tags',
            operator: RuleOperator.CONTAINS,
            value: 'vip',
          },
        ],
        actions: [],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const context: IRuleExecutionContext = {
        data: { tags: ['new-user', 'vip', 'premium'] },
        timestamp: new Date(),
      };

      const result = await service.evaluateRule(rule, context);
      expect(result).toBe(true);
    });

    it('should evaluate IN condition correctly', async () => {
      const rule: IRuleDefinition = {
        id: 'test-rule',
        name: 'Test Rule',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [
          {
            field: 'country',
            operator: RuleOperator.IN,
            value: ['US', 'CA', 'UK'],
          },
        ],
        actions: [],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const context: IRuleExecutionContext = {
        data: { country: 'US' },
        timestamp: new Date(),
      };

      const result = await service.evaluateRule(rule, context);
      expect(result).toBe(true);
    });

    it('should evaluate REGEX condition correctly', async () => {
      const rule: IRuleDefinition = {
        id: 'test-rule',
        name: 'Test Rule',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [
          {
            field: 'email',
            operator: RuleOperator.REGEX,
            value: '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$',
          },
        ],
        actions: [],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const context: IRuleExecutionContext = {
        data: { email: 'test@example.com' },
        timestamp: new Date(),
      };

      const result = await service.evaluateRule(rule, context);
      expect(result).toBe(true);
    });
  });

  describe('executeRuleActions', () => {
    it('should execute SET_VALUE action', async () => {
      const rule: IRuleDefinition = {
        id: 'test-rule',
        name: 'Test Rule',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [],
        actions: [
          {
            actionType: 'SET_VALUE',
            parameters: {
              field: 'discount',
              value: 100,
            },
          },
        ],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const context: IRuleExecutionContext = {
        data: { discount: 0 },
        timestamp: new Date(),
      };

      const result = await service.executeRuleActions(rule, context);
      expect(result).toEqual({
        actionType: 'SET_VALUE',
        field: 'discount',
        value: 100,
        originalValue: 0,
      });
    });

    it('should execute CALCULATE_DISCOUNT action with percentage', async () => {
      const rule: IRuleDefinition = {
        id: 'test-rule',
        name: 'Test Rule',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [],
        actions: [
          {
            actionType: 'CALCULATE_DISCOUNT',
            parameters: {
              discountType: 'PERCENTAGE',
              discountValue: 10, // 10%
            },
          },
        ],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const context: IRuleExecutionContext = {
        data: { amount: 1000 },
        timestamp: new Date(),
      };

      const result = await service.executeRuleActions(rule, context);
      expect(result).toEqual({
        actionType: 'CALCULATE_DISCOUNT',
        originalAmount: 1000,
        discountAmount: 100,
        finalAmount: 900,
        discountType: 'PERCENTAGE',
        discountValue: 10,
      });
    });

    it('should execute CALCULATE_DISCOUNT action with fixed amount', async () => {
      const rule: IRuleDefinition = {
        id: 'test-rule',
        name: 'Test Rule',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [],
        actions: [
          {
            actionType: 'CALCULATE_DISCOUNT',
            parameters: {
              discountType: 'FIXED',
              discountValue: 150,
            },
          },
        ],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const context: IRuleExecutionContext = {
        data: { amount: 1000 },
        timestamp: new Date(),
      };

      const result = await service.executeRuleActions(rule, context);
      expect(result).toEqual({
        actionType: 'CALCULATE_DISCOUNT',
        originalAmount: 1000,
        discountAmount: 150,
        finalAmount: 850,
        discountType: 'FIXED',
        discountValue: 150,
      });
    });

    it('should execute APPLY_FREE_PERIOD action', async () => {
      const rule: IRuleDefinition = {
        id: 'test-rule',
        name: 'Test Rule',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [],
        actions: [
          {
            actionType: 'APPLY_FREE_PERIOD',
            parameters: {
              periodCount: 1,
              periodUnit: 'MONTH',
              description: 'First month free',
            },
          },
        ],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const context: IRuleExecutionContext = {
        data: {},
        timestamp: new Date(),
      };

      const result = await service.executeRuleActions(rule, context);
      expect(result).toMatchObject({
        actionType: 'APPLY_FREE_PERIOD',
        periodCount: 1,
        periodUnit: 'MONTH',
        description: 'First month free',
      });
      expect(result.appliedAt).toBeInstanceOf(Date);
    });

    it('should execute multiple actions', async () => {
      const rule: IRuleDefinition = {
        id: 'test-rule',
        name: 'Test Rule',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [],
        actions: [
          {
            actionType: 'SET_VALUE',
            parameters: {
              field: 'discount',
              value: 100,
            },
          },
          {
            actionType: 'APPLY_FREE_PERIOD',
            parameters: {
              periodCount: 1,
              periodUnit: 'MONTH',
              description: 'Bonus free month',
            },
          },
        ],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const context: IRuleExecutionContext = {
        data: { discount: 0 },
        timestamp: new Date(),
      };

      const result = await service.executeRuleActions(rule, context);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0].actionType).toBe('SET_VALUE');
      expect(result[1].actionType).toBe('APPLY_FREE_PERIOD');
    });
  });
});
