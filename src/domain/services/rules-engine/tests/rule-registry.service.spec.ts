import { Test, TestingModule } from '@nestjs/testing';
import { RuleRegistry } from '../rule-registry.service';
import { IRuleDefinition, RuleType } from '../interfaces/rules-engine.interface';

describe('RuleRegistry', () => {
  let service: RuleRegistry;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RuleRegistry],
    }).compile();

    service = module.get<RuleRegistry>(RuleRegistry);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerRule', () => {
    it('should register a new rule successfully', () => {
      const rule: IRuleDefinition = {
        id: 'test-rule-1',
        name: 'Test Rule 1',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [],
        actions: [
          {
            actionType: 'SET_VALUE',
            parameters: { field: 'discount', value: 100 },
          },
        ],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.registerRule(rule);

      const registeredRule = service.getRule('test-rule-1');
      expect(registeredRule).toEqual(rule);
    });

    it('should replace rule with duplicate id', () => {
      const rule1: IRuleDefinition = {
        id: 'duplicate-rule',
        name: 'Rule 1',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [],
        actions: [
          {
            actionType: 'SET_VALUE',
            parameters: { field: 'discount', value: 100 },
          },
        ],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const rule2: IRuleDefinition = {
        id: 'duplicate-rule',
        name: 'Rule 2',
        type: RuleType.PRICING,
        priority: 2,
        conditions: [],
        actions: [
          {
            actionType: 'SET_VALUE',
            parameters: { field: 'price', value: 200 },
          },
        ],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.registerRule(rule1);
      service.registerRule(rule2); // 會覆蓋原有規則

      expect(service.getRule('duplicate-rule')?.name).toBe('Rule 2');
    });

    it('should throw error for invalid rule', () => {
      const invalidRule: IRuleDefinition = {
        id: '', // empty id should be invalid
        name: 'Invalid Rule',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [],
        actions: [],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() => service.registerRule(invalidRule)).toThrow('Rule ID is required');
    });
  });

  describe('getRule', () => {
    it('should return rule by id', () => {
      const rule: IRuleDefinition = {
        id: 'test-rule',
        name: 'Test Rule',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [],
        actions: [
          {
            actionType: 'SET_VALUE',
            parameters: { field: 'discount', value: 100 },
          },
        ],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.registerRule(rule);
      const result = service.getRule('test-rule');
      expect(result).toEqual(rule);
    });

    it('should return null for non-existent rule', () => {
      const result = service.getRule('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getRulesByType', () => {
    beforeEach(() => {
      const rules: IRuleDefinition[] = [
        {
          id: 'promo-1',
          name: 'Promotion 1',
          type: RuleType.PROMOTION,
          priority: 1,
          conditions: [],
          actions: [{ actionType: 'SET_VALUE', parameters: { field: 'discount', value: 100 } }],
          enabled: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'promo-2',
          name: 'Promotion 2',
          type: RuleType.PROMOTION,
          priority: 3,
          conditions: [],
          actions: [{ actionType: 'SET_VALUE', parameters: { field: 'discount', value: 200 } }],
          enabled: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'pricing-1',
          name: 'Pricing 1',
          type: RuleType.PRICING,
          priority: 2,
          conditions: [],
          actions: [{ actionType: 'SET_VALUE', parameters: { field: 'price', value: 500 } }],
          enabled: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      rules.forEach((rule) => service.registerRule(rule));
    });

    it('should return rules by type sorted by priority (high to low)', () => {
      const promoRules = service.getRulesByType(RuleType.PROMOTION);
      expect(promoRules).toHaveLength(2);
      expect(promoRules[0].id).toBe('promo-2'); // priority 3
      expect(promoRules[1].id).toBe('promo-1'); // priority 1
    });

    it('should return empty array for type with no rules', () => {
      const billingRules = service.getRulesByType(RuleType.BILLING);
      expect(billingRules).toHaveLength(0);
    });
  });

  describe('getEnabledRulesByType', () => {
    beforeEach(() => {
      const rules: IRuleDefinition[] = [
        {
          id: 'enabled-promo',
          name: 'Enabled Promotion',
          type: RuleType.PROMOTION,
          priority: 1,
          conditions: [],
          actions: [{ actionType: 'SET_VALUE', parameters: { field: 'discount', value: 100 } }],
          enabled: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'disabled-promo',
          name: 'Disabled Promotion',
          type: RuleType.PROMOTION,
          priority: 2,
          conditions: [],
          actions: [{ actionType: 'SET_VALUE', parameters: { field: 'discount', value: 200 } }],
          enabled: false,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      rules.forEach((rule) => service.registerRule(rule));
    });

    it('should only return enabled rules', () => {
      const enabledPromoRules = service.getEnabledRulesByType(RuleType.PROMOTION);
      expect(enabledPromoRules).toHaveLength(1);
      expect(enabledPromoRules[0].id).toBe('enabled-promo');
      expect(enabledPromoRules.every((rule) => rule.enabled)).toBe(true);
    });
  });

  describe('getAllRules', () => {
    it('should return all registered rules', () => {
      const rule1: IRuleDefinition = {
        id: 'rule-1',
        name: 'Rule 1',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [],
        actions: [{ actionType: 'SET_VALUE', parameters: { field: 'discount', value: 100 } }],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const rule2: IRuleDefinition = {
        id: 'rule-2',
        name: 'Rule 2',
        type: RuleType.PRICING,
        priority: 1,
        conditions: [],
        actions: [{ actionType: 'SET_VALUE', parameters: { field: 'price', value: 200 } }],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.registerRule(rule1);
      service.registerRule(rule2);

      const allRules = service.getAllRules();
      expect(allRules).toHaveLength(2);
      expect(allRules.map((rule) => rule.id)).toContain('rule-1');
      expect(allRules.map((rule) => rule.id)).toContain('rule-2');
    });
  });

  describe('unregisterRule', () => {
    it('should remove rule by id', () => {
      const rule: IRuleDefinition = {
        id: 'removable-rule',
        name: 'Removable Rule',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [],
        actions: [{ actionType: 'SET_VALUE', parameters: { field: 'discount', value: 100 } }],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.registerRule(rule);
      expect(service.getRule('removable-rule')).toBeDefined();

      service.unregisterRule('removable-rule');
      expect(service.getRule('removable-rule')).toBeNull();
    });

    it('should handle non-existent rule gracefully', () => {
      // Should not throw error
      expect(() => service.unregisterRule('non-existent')).not.toThrow();
    });
  });

  describe('clearRules', () => {
    it('should clear all rules', () => {
      const rule: IRuleDefinition = {
        id: 'test-rule',
        name: 'Test Rule',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [],
        actions: [{ actionType: 'SET_VALUE', parameters: { field: 'discount', value: 100 } }],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.registerRule(rule);
      expect(service.getAllRules()).toHaveLength(1);

      service.clearRules();
      expect(service.getAllRules()).toHaveLength(0);
    });
  });

  describe('getStatistics', () => {
    beforeEach(() => {
      const rules: IRuleDefinition[] = [
        {
          id: 'promo-1',
          name: 'Promotion 1',
          type: RuleType.PROMOTION,
          priority: 1,
          conditions: [],
          actions: [{ actionType: 'SET_VALUE', parameters: { field: 'discount', value: 100 } }],
          enabled: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'promo-2',
          name: 'Promotion 2',
          type: RuleType.PROMOTION,
          priority: 2,
          conditions: [],
          actions: [{ actionType: 'SET_VALUE', parameters: { field: 'discount', value: 200 } }],
          enabled: false,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'pricing-1',
          name: 'Pricing 1',
          type: RuleType.PRICING,
          priority: 1,
          conditions: [],
          actions: [{ actionType: 'SET_VALUE', parameters: { field: 'price', value: 500 } }],
          enabled: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      rules.forEach((rule) => service.registerRule(rule));
    });

    it('should return correct statistics', () => {
      const stats = service.getStatistics();

      expect(stats.totalRules).toBe(3);
      expect(stats.enabledRules).toBe(2);
      expect(stats.disabledRules).toBe(1);
      expect(stats.rulesByType).toEqual({
        [RuleType.PROMOTION]: 2,
        [RuleType.PRICING]: 1,
        [RuleType.RETRY]: 0,
        [RuleType.REFUND]: 0,
        [RuleType.BILLING]: 0,
      });
    });
  });

  describe('getValidRulesAtTime', () => {
    it('should return rules valid at given time', () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const validRule: IRuleDefinition = {
        id: 'valid-rule',
        name: 'Valid Rule',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [],
        actions: [{ actionType: 'SET_VALUE', parameters: { field: 'discount', value: 100 } }],
        enabled: true,
        validFrom: yesterday,
        validTo: tomorrow,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const expiredRule: IRuleDefinition = {
        id: 'expired-rule',
        name: 'Expired Rule',
        type: RuleType.PROMOTION,
        priority: 2,
        conditions: [],
        actions: [{ actionType: 'SET_VALUE', parameters: { field: 'discount', value: 200 } }],
        enabled: true,
        validTo: yesterday, // 已過期
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.registerRule(validRule);
      service.registerRule(expiredRule);

      const validRules = service.getValidRulesAtTime(RuleType.PROMOTION, now);
      expect(validRules).toHaveLength(1);
      expect(validRules[0].id).toBe('valid-rule');
    });
  });
});
