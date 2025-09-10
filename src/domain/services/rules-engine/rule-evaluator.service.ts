import { Injectable, Logger } from '@nestjs/common';
import { IRuleEvaluator, IRuleDefinition, IRuleExecutionContext, IRuleCondition, RuleOperator, IRuleAction } from './interfaces/rules-engine.interface';

/**
 * 規則評估器實現
 * 負責評估規則條件和執行規則動作
 */
@Injectable()
export class RuleEvaluator implements IRuleEvaluator {
  private readonly logger = new Logger(RuleEvaluator.name);

  /**
   * 評估單個規則是否滿足條件
   */
  async evaluateRule(rule: IRuleDefinition, context: IRuleExecutionContext): Promise<boolean> {
    try {
      // 檢查規則是否啟用
      if (!rule.enabled) {
        return false;
      }

      // 檢查時間範圍
      if (!this.isRuleValidAtTime(rule, context.timestamp)) {
        return false;
      }

      // 評估所有條件 (AND 邏輯)
      for (const condition of rule.conditions) {
        if (!(await this.evaluateCondition(condition, context))) {
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.error(`Error evaluating rule ${rule.id}: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * 執行規則動作
   */
  async executeRuleActions(rule: IRuleDefinition, context: IRuleExecutionContext): Promise<any> {
    const results: any[] = [];

    for (const action of rule.actions) {
      try {
        const result = await this.executeAction(action, context);
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to execute action ${action.actionType} for rule ${rule.id}`, error);
        throw error;
      }
    }

    return results.length === 1 ? results[0] : results;
  }

  /**
   * 評估單個條件
   */
  private async evaluateCondition(condition: IRuleCondition, context: IRuleExecutionContext): Promise<boolean> {
    const fieldValue = this.getFieldValue(condition.field, context.data);
    const expectedValue = condition.value;

    switch (condition.operator) {
      case RuleOperator.EQUALS:
        return fieldValue === expectedValue;

      case RuleOperator.NOT_EQUALS:
        return fieldValue !== expectedValue;

      case RuleOperator.GREATER_THAN:
        return this.compareValues(fieldValue, expectedValue) > 0;

      case RuleOperator.LESS_THAN:
        return this.compareValues(fieldValue, expectedValue) < 0;

      case RuleOperator.GREATER_THAN_OR_EQUAL:
        return this.compareValues(fieldValue, expectedValue) >= 0;

      case RuleOperator.LESS_THAN_OR_EQUAL:
        return this.compareValues(fieldValue, expectedValue) <= 0;

      case RuleOperator.CONTAINS:
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(expectedValue);
        }
        if (typeof fieldValue === 'string') {
          return fieldValue.includes(expectedValue);
        }
        return false;

      case RuleOperator.NOT_CONTAINS:
        if (Array.isArray(fieldValue)) {
          return !fieldValue.includes(expectedValue);
        }
        if (typeof fieldValue === 'string') {
          return !fieldValue.includes(expectedValue);
        }
        return true;

      case RuleOperator.IN:
        if (Array.isArray(expectedValue)) {
          return expectedValue.includes(fieldValue);
        }
        return false;

      case RuleOperator.NOT_IN:
        if (Array.isArray(expectedValue)) {
          return !expectedValue.includes(fieldValue);
        }
        return true;

      case RuleOperator.REGEX:
        if (typeof fieldValue === 'string' && typeof expectedValue === 'string') {
          const regex = new RegExp(expectedValue);
          return regex.test(fieldValue);
        }
        return false;

      default:
        this.logger.warn(`Unsupported operator: ${condition.operator}`);
        return false;
    }
  }

  /**
   * 執行單個動作
   */
  private async executeAction(action: IRuleAction, context: IRuleExecutionContext): Promise<any> {
    switch (action.actionType) {
      case 'SET_VALUE':
        return this.executeSetValueAction(action, context);

      case 'CALCULATE_DISCOUNT':
        return this.executeCalculateDiscountAction(action, context);

      case 'APPLY_FREE_PERIOD':
        return this.executeApplyFreePeriodAction(action, context);

      case 'MODIFY_RETRY_COUNT':
        return this.executeModifyRetryCountAction(action, context);

      case 'SET_RETRY_DELAY':
        return this.executeSetRetryDelayAction(action, context);

      case 'APPROVE_REFUND':
        return this.executeApproveRefundAction(action, context);

      case 'REJECT_REFUND':
        return this.executeRejectRefundAction(action, context);

      default:
        const errorMessage = `Unknown action type: ${action.actionType}`;
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
    }
  }

  /**
   * 執行設定值動作
   */
  private executeSetValueAction(action: IRuleAction, context: IRuleExecutionContext): any {
    const { field, value } = action.parameters;
    return {
      actionType: 'SET_VALUE',
      field,
      value,
      originalValue: this.getFieldValue(field, context.data),
    };
  }

  /**
   * 執行計算折扣動作
   */
  private executeCalculateDiscountAction(action: IRuleAction, context: IRuleExecutionContext): any {
    const { discountType, discountValue, maxDiscount } = action.parameters;
    const originalAmount = this.getFieldValue('amount', context.data) || 0;

    let discountAmount = 0;

    if (discountType === 'PERCENTAGE') {
      discountAmount = (originalAmount * discountValue) / 100;
    } else if (discountType === 'FIXED') {
      discountAmount = discountValue;
    }

    // 應用最大折扣限制
    if (maxDiscount && discountAmount > maxDiscount) {
      discountAmount = maxDiscount;
    }

    return {
      actionType: 'CALCULATE_DISCOUNT',
      originalAmount,
      discountAmount,
      finalAmount: originalAmount - discountAmount,
      discountType,
      discountValue,
    };
  }

  /**
   * 執行免費期間動作
   */
  private executeApplyFreePeriodAction(action: IRuleAction, context: IRuleExecutionContext): any {
    const { periodCount, periodUnit, description } = action.parameters;

    return {
      actionType: 'APPLY_FREE_PERIOD',
      periodCount,
      periodUnit,
      description,
      appliedAt: new Date(),
      contextData: context.data,
    };
  }

  /**
   * 執行修改重試次數動作
   */
  private executeModifyRetryCountAction(action: IRuleAction, context: IRuleExecutionContext): any {
    const { retryCount, reason } = action.parameters;

    return {
      actionType: 'MODIFY_RETRY_COUNT',
      newRetryCount: retryCount,
      reason,
      appliedAt: new Date(),
      contextTimestamp: context.timestamp,
    };
  }

  /**
   * 執行設定重試延遲動作
   */
  private executeSetRetryDelayAction(action: IRuleAction, context: IRuleExecutionContext): any {
    const { delayMinutes, reason } = action.parameters;

    return {
      actionType: 'SET_RETRY_DELAY',
      delayMinutes,
      reason,
      nextRetryTime: new Date(Date.now() + delayMinutes * 60 * 1000),
      contextTimestamp: context.timestamp,
    };
  }

  /**
   * 執行批准退款動作
   */
  private executeApproveRefundAction(action: IRuleAction, context: IRuleExecutionContext): any {
    const { refundAmount, reason } = action.parameters;

    return {
      actionType: 'APPROVE_REFUND',
      refundAmount: refundAmount || this.getFieldValue('refundAmount', context.data),
      reason,
      approvedAt: new Date(),
    };
  }

  /**
   * 執行拒絕退款動作
   */
  private executeRejectRefundAction(action: IRuleAction, context: IRuleExecutionContext): any {
    const { reason } = action.parameters;

    return {
      actionType: 'REJECT_REFUND',
      reason,
      rejectedAt: new Date(),
      contextData: context.data,
    };
  }

  /**
   * 檢查規則是否在有效時間範圍內
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

  /**
   * 獲取字段值 (支持嵌套路徑)
   */
  private getFieldValue(fieldPath: string, data: any): any {
    if (!fieldPath || !data) {
      return undefined;
    }

    const paths = fieldPath.split('.');
    let value = data;

    for (const path of paths) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = value[path];
    }

    return value;
  }

  /**
   * 比較兩個值 (支持數字、日期、字符串)
   */
  private compareValues(value1: any, value2: any): number {
    // 處理數字比較
    if (typeof value1 === 'number' && typeof value2 === 'number') {
      return value1 - value2;
    }

    // 處理日期比較
    if (value1 instanceof Date && value2 instanceof Date) {
      return value1.getTime() - value2.getTime();
    }

    // 處理字符串比較
    if (typeof value1 === 'string' && typeof value2 === 'string') {
      return value1.localeCompare(value2);
    }

    // 嘗試轉換為數字進行比較
    const num1 = Number(value1);
    const num2 = Number(value2);

    if (!isNaN(num1) && !isNaN(num2)) {
      return num1 - num2;
    }

    // 轉換為字符串進行比較
    return String(value1).localeCompare(String(value2));
  }
}
