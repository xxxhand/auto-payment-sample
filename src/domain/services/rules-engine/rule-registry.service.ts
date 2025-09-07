import { Injectable, Logger } from '@nestjs/common';
import { IRuleRegistry, IRuleDefinition, RuleType } from './interfaces/rules-engine.interface';

/**
 * 規則註冊表實現
 * 負責管理規則的註冊、查詢和組織
 */
@Injectable()
export class RuleRegistry implements IRuleRegistry {
  private readonly logger = new Logger(RuleRegistry.name);
  private readonly rules = new Map<string, IRuleDefinition>();
  private readonly rulesByType = new Map<RuleType, IRuleDefinition[]>();

  /**
   * 註冊規則
   */
  registerRule(rule: IRuleDefinition): void {
    try {
      // 驗證規則
      this.validateRule(rule);

      // 如果規則已存在，先移除舊的
      if (this.rules.has(rule.id)) {
        this.unregisterRule(rule.id);
      }

      // 註冊新規則
      this.rules.set(rule.id, rule);

      // 按類型組織規則
      if (!this.rulesByType.has(rule.type)) {
        this.rulesByType.set(rule.type, []);
      }

      const rulesOfType = this.rulesByType.get(rule.type)!;
      rulesOfType.push(rule);

      // 按優先級排序 (高優先級在前)
      rulesOfType.sort((a, b) => b.priority - a.priority);

      this.logger.log(`Rule registered: ${rule.id} (${rule.type}) with priority ${rule.priority}`);
    } catch (error) {
      this.logger.error(`Failed to register rule ${rule.id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 取消註冊規則
   */
  unregisterRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      this.logger.warn(`Rule not found for unregistration: ${ruleId}`);
      return;
    }

    // 從主映射中移除
    this.rules.delete(ruleId);

    // 從類型映射中移除
    const rulesOfType = this.rulesByType.get(rule.type);
    if (rulesOfType) {
      const index = rulesOfType.findIndex((r) => r.id === ruleId);
      if (index !== -1) {
        rulesOfType.splice(index, 1);
      }

      // 如果類型下沒有規則了，移除類型映射
      if (rulesOfType.length === 0) {
        this.rulesByType.delete(rule.type);
      }
    }

    this.logger.log(`Rule unregistered: ${ruleId}`);
  }

  /**
   * 獲取指定類型的所有規則
   */
  getRulesByType(type: RuleType): IRuleDefinition[] {
    return this.rulesByType.get(type) || [];
  }

  /**
   * 獲取所有規則
   */
  getAllRules(): IRuleDefinition[] {
    return Array.from(this.rules.values());
  }

  /**
   * 獲取特定規則
   */
  getRule(ruleId: string): IRuleDefinition | null {
    return this.rules.get(ruleId) || null;
  }

  /**
   * 清空所有規則
   */
  clearRules(): void {
    const ruleCount = this.rules.size;
    this.rules.clear();
    this.rulesByType.clear();
    this.logger.log(`Cleared ${ruleCount} rules from registry`);
  }

  /**
   * 獲取註冊表統計信息
   */
  getStatistics(): {
    totalRules: number;
    rulesByType: Record<RuleType, number>;
    enabledRules: number;
    disabledRules: number;
  } {
    const totalRules = this.rules.size;
    let enabledRules = 0;
    let disabledRules = 0;

    const rulesByType: Record<RuleType, number> = {
      [RuleType.PRICING]: 0,
      [RuleType.PROMOTION]: 0,
      [RuleType.RETRY]: 0,
      [RuleType.REFUND]: 0,
      [RuleType.BILLING]: 0,
    };

    for (const rule of this.rules.values()) {
      if (rule.enabled) {
        enabledRules++;
      } else {
        disabledRules++;
      }

      rulesByType[rule.type] = (rulesByType[rule.type] || 0) + 1;
    }

    return {
      totalRules,
      rulesByType,
      enabledRules,
      disabledRules,
    };
  }

  /**
   * 獲取指定類型的已啟用規則
   */
  getEnabledRulesByType(type: RuleType): IRuleDefinition[] {
    return this.getRulesByType(type).filter((rule) => rule.enabled);
  }

  /**
   * 獲取在指定時間有效的規則
   */
  getValidRulesAtTime(type: RuleType, timestamp: Date): IRuleDefinition[] {
    return this.getEnabledRulesByType(type).filter((rule) => this.isRuleValidAtTime(rule, timestamp));
  }

  /**
   * 驗證規則定義
   */
  private validateRule(rule: IRuleDefinition): void {
    if (!rule.id || rule.id.trim() === '') {
      throw new Error('Rule ID is required');
    }

    if (!rule.name || rule.name.trim() === '') {
      throw new Error('Rule name is required');
    }

    if (!Object.values(RuleType).includes(rule.type)) {
      throw new Error(`Invalid rule type: ${rule.type}`);
    }

    if (typeof rule.priority !== 'number' || rule.priority < 0) {
      throw new Error('Rule priority must be a non-negative number');
    }

    if (!Array.isArray(rule.conditions)) {
      throw new Error('Rule conditions must be an array');
    }

    if (!Array.isArray(rule.actions) || rule.actions.length === 0) {
      throw new Error('Rule must have at least one action');
    }

    // 驗證條件
    for (let i = 0; i < rule.conditions.length; i++) {
      const condition = rule.conditions[i];
      if (!condition.field || condition.field.trim() === '') {
        throw new Error(`Condition ${i}: field is required`);
      }
      if (!condition.operator) {
        throw new Error(`Condition ${i}: operator is required`);
      }
    }

    // 驗證動作
    for (let i = 0; i < rule.actions.length; i++) {
      const action = rule.actions[i];
      if (!action.actionType || action.actionType.trim() === '') {
        throw new Error(`Action ${i}: actionType is required`);
      }
      if (!action.parameters || typeof action.parameters !== 'object') {
        throw new Error(`Action ${i}: parameters must be an object`);
      }
    }

    // 驗證時間範圍
    if (rule.validFrom && rule.validTo && rule.validFrom > rule.validTo) {
      throw new Error('Rule validFrom must be before validTo');
    }
  }

  /**
   * 檢查規則是否在指定時間有效
   */
  private isRuleValidAtTime(rule: IRuleDefinition, timestamp: Date): boolean {
    if (rule.validFrom && timestamp < rule.validFrom) {
      return false;
    }

    if (rule.validTo && timestamp > rule.validTo) {
      return false;
    }

    return true;
  }
}
