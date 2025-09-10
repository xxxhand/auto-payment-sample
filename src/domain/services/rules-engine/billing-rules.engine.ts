import { Injectable, Logger } from '@nestjs/common';
import { Money } from '../../value-objects/money';
import { BillingCycleVO } from '../../value-objects/billing-cycle';
import { SubscriptionStatus } from '../../enums/codes.const';
import { IRuleDefinition, IRuleExecutionContext, RuleType, RuleConditionOperator } from './interfaces/rules.interface';
import { RuleRegistry } from './rule-registry.service';

/**
 * 扣款決策上下文
 */
export interface BillingDecisionContext {
  subscriptionId: string;
  subscriptionStatus: SubscriptionStatus;
  currentAmount: Money;
  billingCycle: BillingCycleVO;
  lastPaymentDate?: Date;
  failureCount: number;
  gracePeriodEndDate?: Date;
  paymentMethodValid: boolean;
  customerTier?: string;
  metadata?: Record<string, any>;
}

/**
 * 扣款決策結果
 */
export interface BillingDecisionResult {
  shouldAttemptBilling: boolean;
  recommendedAmount: Money;
  billingDelay?: number; // 延遲分鐘數
  reason: string;
  nextAttemptDate?: Date;
  appliedRules: string[];
  metadata?: Record<string, any>;
}

/**
 * 扣款規則引擎
 * 負責自動扣款的決策邏輯和業務規則
 */
@Injectable()
export class BillingRulesEngine {
  private readonly logger = new Logger(BillingRulesEngine.name);

  constructor(private readonly ruleRegistry: RuleRegistry) {
    this.initializeBillingRules();
  }

  /**
   * 評估扣款決策
   */
  async evaluateBillingDecision(context: BillingDecisionContext): Promise<BillingDecisionResult> {
    const ruleContext: IRuleExecutionContext = {
      data: {
        subscription: {
          id: context.subscriptionId,
          status: context.subscriptionStatus,
          amount: context.currentAmount.amount,
          currency: context.currentAmount.currency,
          failureCount: context.failureCount,
          gracePeriodEndDate: context.gracePeriodEndDate,
          paymentMethodValid: context.paymentMethodValid,
          customerTier: context.customerTier,
        },
        billingCycle: {
          type: context.billingCycle.type,
          intervalDays: context.billingCycle.intervalDays,
        },
        lastPaymentDate: context.lastPaymentDate,
        metadata: context.metadata,
      },
      timestamp: new Date(),
    };

    // 獲取適用的扣款規則
    const billingRules = this.ruleRegistry.getEnabledRulesByType(RuleType.BILLING);
    let shouldAttemptBilling = true;
    let recommendedAmount = context.currentAmount;
    let billingDelay = 0;
    let reason = 'Standard billing';
    const appliedRules: string[] = [];
    let nextAttemptDate: Date | undefined;

    // 按優先級執行規則
    for (const rule of billingRules) {
      const ruleResult = await this.evaluateBillingRule(rule, ruleContext);

      if (ruleResult.applied) {
        appliedRules.push(rule.id);

        if (ruleResult.blockBilling) {
          shouldAttemptBilling = false;
          reason = ruleResult.reason || `Blocked by rule: ${rule.name}`;
          nextAttemptDate = ruleResult.nextAttemptDate;
          break;
        }

        if (ruleResult.adjustAmount) {
          recommendedAmount = new Money(ruleResult.adjustAmount, context.currentAmount.currency);
          reason = `Amount adjusted by rule: ${rule.name}`;
        }

        if (ruleResult.delayBilling && ruleResult.delayMinutes) {
          billingDelay = Math.max(billingDelay, ruleResult.delayMinutes);
          reason = `Delayed by rule: ${rule.name}`;
        }
      }
    }

    return {
      shouldAttemptBilling,
      recommendedAmount,
      billingDelay: billingDelay > 0 ? billingDelay : undefined,
      reason,
      nextAttemptDate,
      appliedRules,
      metadata: {
        evaluatedRules: billingRules.length,
        appliedRules: appliedRules.length,
        timestamp: new Date(),
      },
    };
  }

  /**
   * 計算寬限期結束日期
   */
  calculateGracePeriodEndDate(failureDate: Date, gracePeriodDays: number = 3): Date {
    return new Date(failureDate.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);
  }

  /**
   * 計算按比例費用
   */
  calculateProrationAmount(fromPlanAmount: Money, toPlanAmount: Money, billingCycle: BillingCycleVO, changeDate: Date, currentPeriodEndDate: Date): Money {
    const totalDays = billingCycle.getTotalCycleDays();
    const remainingDays = Math.ceil((currentPeriodEndDate.getTime() - changeDate.getTime()) / (1000 * 60 * 60 * 24));

    if (remainingDays <= 0) {
      return Money.zero(toPlanAmount.currency);
    }

    // 計算價格差異，允許負數（降級情況）
    const priceDifferenceAmount = toPlanAmount.amount - fromPlanAmount.amount;
    const prorationFactor = remainingDays / totalDays;
    const finalAmount = priceDifferenceAmount * prorationFactor;

    // 手動創建結果，繞過 Money 構造函數的負數限制
    return this.createMoneyWithNegativeAmount(finalAmount, toPlanAmount.currency);
  }

  /**
   * 創建可能為負數的 Money 對象（用於退款計算）
   */
  private createMoneyWithNegativeAmount(amount: number, currency: string): Money {
    // 創建一個 Money 實例，繞過負數檢查
    const money = Object.create(Money.prototype);
    money['_amount'] = Math.round(amount);
    money['_currency'] = currency.toUpperCase();
    return money;
  }

  /**
   * 評估單個扣款規則
   */
  private async evaluateBillingRule(
    rule: IRuleDefinition,
    context: IRuleExecutionContext,
  ): Promise<{
    applied: boolean;
    blockBilling?: boolean;
    adjustAmount?: number;
    delayBilling?: boolean;
    delayMinutes?: number;
    reason?: string;
    nextAttemptDate?: Date;
  }> {
    // 檢查條件是否匹配
    const conditionsMet = this.evaluateConditions(rule.conditions, context.data);

    if (!conditionsMet) {
      return { applied: false };
    }

    // 執行動作
    for (const action of rule.actions) {
      switch (action.actionType) {
        case 'BLOCK_BILLING':
          return {
            applied: true,
            blockBilling: true,
            reason: action.parameters.reason,
            nextAttemptDate: action.parameters.nextAttemptDate ? new Date(action.parameters.nextAttemptDate) : undefined,
          };

        case 'ADJUST_AMOUNT':
          const adjustmentType = action.parameters.adjustmentType;
          const adjustmentValue = action.parameters.adjustmentValue;
          const currentAmount = context.data.subscription.amount;

          let newAmount = currentAmount;
          if (adjustmentType === 'PERCENTAGE') {
            newAmount = currentAmount * (1 + adjustmentValue / 100);
          } else if (adjustmentType === 'FIXED') {
            newAmount = currentAmount + adjustmentValue;
          }

          return {
            applied: true,
            adjustAmount: newAmount,
            reason: `Amount adjusted by rule: ${rule.name}`,
          };

        case 'DELAY_BILLING':
          return {
            applied: true,
            delayBilling: true,
            delayMinutes: action.parameters.delayMinutes,
            reason: `Delayed by rule: ${rule.name}`,
          };
      }
    }

    return { applied: true };
  }

  /**
   * 評估條件
   */
  private evaluateConditions(conditions: any[], data: any): boolean {
    return conditions.every((condition) => {
      const fieldValue = this.getNestedValue(data, condition.field);

      switch (condition.operator) {
        case RuleConditionOperator.EQUALS:
          return fieldValue === condition.value;
        case RuleConditionOperator.NOT_EQUALS:
          return fieldValue !== condition.value;
        case RuleConditionOperator.GREATER_THAN:
          return fieldValue > condition.value;
        case RuleConditionOperator.LESS_THAN:
          return fieldValue < condition.value;
        case RuleConditionOperator.IN:
          return Array.isArray(condition.value) && condition.value.includes(fieldValue);
        case RuleConditionOperator.NOT_IN:
          return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
        default:
          return false;
      }
    });
  }

  /**
   * 獲取嵌套對象值
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * 初始化預設扣款規則
   */
  private initializeBillingRules(): void {
    const defaultRules: IRuleDefinition[] = [
      {
        id: 'billing-block-inactive-payment-method',
        name: '無效付款方式阻擋規則',
        type: RuleType.BILLING,
        priority: 1000,
        conditions: [
          {
            field: 'subscription.paymentMethodValid',
            operator: RuleConditionOperator.EQUALS,
            value: false,
          },
        ],
        actions: [
          {
            actionType: 'BLOCK_BILLING',
            parameters: {
              reason: 'Payment method is invalid or expired',
            },
          },
        ],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'billing-grace-period-expired',
        name: '寬限期過期阻擋規則',
        type: RuleType.BILLING,
        priority: 900,
        conditions: [
          {
            field: 'subscription.status',
            operator: RuleConditionOperator.EQUALS,
            value: SubscriptionStatus.PAST_DUE,
          },
          {
            field: 'subscription.gracePeriodEndDate',
            operator: RuleConditionOperator.LESS_THAN,
            value: new Date(),
          },
        ],
        actions: [
          {
            actionType: 'BLOCK_BILLING',
            parameters: {
              reason: 'Grace period has expired',
            },
          },
        ],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'billing-premium-tier-discount',
        name: '高級會員扣款優惠',
        type: RuleType.BILLING,
        priority: 100,
        conditions: [
          {
            field: 'subscription.customerTier',
            operator: RuleConditionOperator.EQUALS,
            value: 'PREMIUM',
          },
        ],
        actions: [
          {
            actionType: 'ADJUST_AMOUNT',
            parameters: {
              adjustmentType: 'PERCENTAGE',
              adjustmentValue: -5, // 5% 折扣
              reason: 'Premium tier discount applied',
            },
          },
        ],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'billing-high-failure-count-delay',
        name: '高失敗次數延遲規則',
        type: RuleType.BILLING,
        priority: 200,
        conditions: [
          {
            field: 'subscription.failureCount',
            operator: RuleConditionOperator.GREATER_THAN,
            value: 2,
          },
        ],
        actions: [
          {
            actionType: 'DELAY_BILLING',
            parameters: {
              delayMinutes: 60, // 延遲1小時
              reason: 'High failure count - applying delay',
            },
          },
        ],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // 註冊預設規則
    defaultRules.forEach((rule) => {
      this.ruleRegistry.registerRule(rule);
    });

    this.logger.log(`Initialized ${defaultRules.length} default billing rules`);
  }
}
