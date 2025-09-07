import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { RulesEngine } from '../rules-engine.service';
import { RuleRegistry } from '../rule-registry.service';
import { RuleEvaluator } from '../rule-evaluator.service';
import { IRuleDefinition, IRuleExecutionContext, RuleType, RuleOperator } from '../interfaces/rules-engine.interface';

describe('RulesEngine', () => {
  let service: RulesEngine;
  let ruleRegistry: RuleRegistry;
  let ruleEvaluator: RuleEvaluator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RulesEngine, RuleRegistry, RuleEvaluator],
    }).compile();

    service = module.get<RulesEngine>(RulesEngine);
    ruleRegistry = module.get<RuleRegistry>(RuleRegistry);
    ruleEvaluator = module.get<RuleEvaluator>(RuleEvaluator);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('execute', () => {
    it('should execute rules of specified type and return results', async () => {
      // 註冊測試規則
      const rule: IRuleDefinition = {
        id: 'test-promotion',
        name: 'Test Promotion Rule',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [
          {
            field: 'amount',
            operator: RuleOperator.GREATER_THAN,
            value: 100,
          },
        ],
        actions: [
          {
            actionType: 'CALCULATE_DISCOUNT',
            parameters: {
              discountType: 'PERCENTAGE',
              discountValue: 10,
            },
          },
        ],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      ruleRegistry.registerRule(rule);

      const context: IRuleExecutionContext = {
        data: { amount: 1000 },
        timestamp: new Date(),
      };

      const result = await service.execute(RuleType.PROMOTION, context);

      expect(result.success).toBe(true);
      expect(result.appliedRules).toHaveLength(1);
      expect(result.appliedRules[0]).toBe('test-promotion');
      expect(result.result).toMatchObject({
        actionType: 'CALCULATE_DISCOUNT',
        originalAmount: 1000,
        discountAmount: 100,
        finalAmount: 900,
      });
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should skip rules that do not match conditions', async () => {
      const rule: IRuleDefinition = {
        id: 'test-promotion',
        name: 'Test Promotion Rule',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [
          {
            field: 'amount',
            operator: RuleOperator.GREATER_THAN,
            value: 1000, // 條件不匹配
          },
        ],
        actions: [
          {
            actionType: 'CALCULATE_DISCOUNT',
            parameters: {
              discountType: 'PERCENTAGE',
              discountValue: 10,
            },
          },
        ],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      ruleRegistry.registerRule(rule);

      const context: IRuleExecutionContext = {
        data: { amount: 500 }, // 不滿足條件
        timestamp: new Date(),
      };

      const result = await service.execute(RuleType.PROMOTION, context);

      expect(result.success).toBe(true);
      expect(result.appliedRules).toHaveLength(0);
    });

    it('should handle rule execution errors gracefully', async () => {
      const rule: IRuleDefinition = {
        id: 'invalid-rule',
        name: 'Invalid Rule',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [],
        actions: [
          {
            actionType: 'INVALID_ACTION', // 無效的動作類型
            parameters: {},
          },
        ],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      ruleRegistry.registerRule(rule);

      const context: IRuleExecutionContext = {
        data: {},
        timestamp: new Date(),
      };

      const result = await service.execute(RuleType.PROMOTION, context);

      expect(result.success).toBe(false);
      expect(result.appliedRules).toHaveLength(0);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBe(1);
      expect(result.errors![0].ruleId).toBe('invalid-rule');
      expect(result.errors![0].message).toContain('Unknown action type');
    });

    it('should execute multiple rules in priority order', async () => {
      const rule1: IRuleDefinition = {
        id: 'low-priority-rule',
        name: 'Low Priority Rule',
        type: RuleType.PROMOTION,
        priority: 1, // 低優先級
        conditions: [],
        actions: [
          {
            actionType: 'SET_VALUE',
            parameters: { field: 'discount', value: 50 },
          },
        ],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const rule2: IRuleDefinition = {
        id: 'high-priority-rule',
        name: 'High Priority Rule',
        type: RuleType.PROMOTION,
        priority: 5, // 高優先級
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

      ruleRegistry.registerRule(rule1);
      ruleRegistry.registerRule(rule2);

      const context: IRuleExecutionContext = {
        data: { discount: 0 },
        timestamp: new Date(),
      };

      const result = await service.execute(RuleType.PROMOTION, context);

      expect(result.success).toBe(true);
      expect(result.appliedRules).toHaveLength(2);
      // 由於規則按優先級排序（高到低），高優先級規則會先被應用
      expect(result.appliedRules[0]).toBe('high-priority-rule');
      expect(result.appliedRules[1]).toBe('low-priority-rule');
    });

    it('should return empty result for type with no rules', async () => {
      const context: IRuleExecutionContext = {
        data: {},
        timestamp: new Date(),
      };

      const result = await service.execute(RuleType.BILLING, context);

      expect(result.success).toBe(true);
      expect(result.appliedRules).toHaveLength(0);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should include metadata in execution result', async () => {
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

      ruleRegistry.registerRule(rule);

      const context: IRuleExecutionContext = {
        data: {},
        timestamp: new Date(),
      };

      const result = await service.execute(RuleType.PROMOTION, context);

      expect(result.metadata).toBeDefined();
      expect(result.metadata!.totalRulesEvaluated).toBe(1);
      expect(result.metadata!.rulesApplied).toBe(1);
      expect(result.metadata!.type).toBe(RuleType.PROMOTION);
    });
  });

  describe('executeRule', () => {
    it('should execute a single rule by ID', async () => {
      const rule: IRuleDefinition = {
        id: 'direct-rule',
        name: 'Direct Rule',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [
          {
            field: 'userType',
            operator: RuleOperator.EQUALS,
            value: 'premium',
          },
        ],
        actions: [
          {
            actionType: 'SET_VALUE',
            parameters: { field: 'discount', value: 200 },
          },
        ],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      ruleRegistry.registerRule(rule);

      const context: IRuleExecutionContext = {
        data: { userType: 'premium', discount: 0 },
        timestamp: new Date(),
      };

      const result = await service.executeRule('direct-rule', context);

      expect(result.success).toBe(true);
      expect(result.appliedRules).toHaveLength(1);
      expect(result.appliedRules[0]).toBe('direct-rule');
      expect(result.result).toEqual({
        actionType: 'SET_VALUE',
        field: 'discount',
        value: 200,
        originalValue: 0,
      });
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle rule with unmatched conditions', async () => {
      const rule: IRuleDefinition = {
        id: 'unmatched-rule',
        name: 'Unmatched Rule',
        type: RuleType.PROMOTION,
        priority: 1,
        conditions: [
          {
            field: 'userType',
            operator: RuleOperator.EQUALS,
            value: 'premium',
          },
        ],
        actions: [
          {
            actionType: 'SET_VALUE',
            parameters: { field: 'discount', value: 200 },
          },
        ],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      ruleRegistry.registerRule(rule);

      const context: IRuleExecutionContext = {
        data: { userType: 'basic' }, // 不匹配條件
        timestamp: new Date(),
      };

      const result = await service.executeRule('unmatched-rule', context);

      expect(result.success).toBe(true);
      expect(result.appliedRules).toHaveLength(0);
      expect(result.result).toBeUndefined();
    });

    it('should handle non-existent rule', async () => {
      const context: IRuleExecutionContext = {
        data: {},
        timestamp: new Date(),
      };

      const result = await service.executeRule('non-existent', context);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].message).toContain('Rule not found');
    });
  });

  describe('loadRules', () => {
    it('should handle rule loading', async () => {
      // 由於 loadRules 需要 IRuleLoader 介面實現，這裡測試基本功能
      const mockLoader = {
        loadRules: jest.fn().mockResolvedValue([
          {
            id: 'loaded-rule-1',
            name: 'Loaded Rule 1',
            type: RuleType.PROMOTION,
            priority: 1,
            conditions: [],
            actions: [{ actionType: 'SET_VALUE', parameters: { field: 'discount', value: 100 } }],
            enabled: true,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
        reloadRules: jest.fn(),
      };

      await service.loadRules(mockLoader);

      expect(mockLoader.loadRules).toHaveBeenCalled();
    });
  });

  describe('registerRule', () => {
    it('should register rule via registry', () => {
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

      expect(ruleRegistry.getRule('test-rule')).toEqual(rule);
    });
  });

  describe('getStatistics', () => {
    it('should return registry statistics', () => {
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

      ruleRegistry.registerRule(rule);

      const stats = service.getStatistics();
      expect(stats.totalRules).toBe(1);
      expect(stats.enabledRules).toBe(1);
      expect(stats.disabledRules).toBe(0);
    });
  });
});
