import { Injectable, Logger } from '@nestjs/common';
import { PaymentFailureCategory, RetryStrategyType } from '../../enums/codes.const';
import { IRuleDefinition, IRuleExecutionContext, RuleType, RuleConditionOperator } from './interfaces/rules.interface';
import { RuleRegistry } from './rule-registry.service';

/**
 * 重試決策上下文
 */
export interface RetryDecisionContext {
  paymentId: string;
  subscriptionId: string;
  failureCategory: PaymentFailureCategory;
  failureReason: string;
  attemptNumber: number;
  lastAttemptDate: Date;
  totalFailureCount: number;
  customerTier?: string;
  paymentAmount: number;
  currency: string;
  metadata?: Record<string, any>;
}

/**
 * 重試決策結果
 */
export interface RetryDecisionResult {
  shouldRetry: boolean;
  nextRetryDate?: Date;
  retryStrategy: RetryStrategyType;
  maxRetries: number;
  delayMinutes: number;
  escalateToManual: boolean;
  notifyCustomer: boolean;
  reason: string;
  appliedRules: string[];
  metadata?: Record<string, any>;
}

/**
 * 重試配置
 */
export interface RetryConfiguration {
  strategyType: RetryStrategyType;
  maxRetries: number;
  baseDelayMinutes: number;
  maxDelayMinutes: number;
  multiplier?: number; // 指數退避使用
  escalateAfterAttempts?: number;
  notifyCustomerAfterAttempts?: number;
}

/**
 * 重試策略引擎
 * 負責支付失敗後的智能重試決策
 */
@Injectable()
export class RetryStrategyEngine {
  private readonly logger = new Logger(RetryStrategyEngine.name);

  // 預設重試策略配置
  private readonly DEFAULT_RETRY_STRATEGIES: Map<PaymentFailureCategory, RetryConfiguration> = new Map([
    [
      PaymentFailureCategory.RETRIABLE,
      {
        strategyType: RetryStrategyType.LINEAR,
        maxRetries: 3,
        baseDelayMinutes: 5,
        maxDelayMinutes: 30,
        escalateAfterAttempts: 3,
        notifyCustomerAfterAttempts: 2,
      },
    ],
    [
      PaymentFailureCategory.DELAYED_RETRY,
      {
        strategyType: RetryStrategyType.EXPONENTIAL_BACKOFF,
        maxRetries: 5,
        baseDelayMinutes: 60,
        maxDelayMinutes: 2880, // 48小時
        multiplier: 2,
        escalateAfterAttempts: 4,
        notifyCustomerAfterAttempts: 1,
      },
    ],
    [
      PaymentFailureCategory.NON_RETRIABLE,
      {
        strategyType: RetryStrategyType.NONE,
        maxRetries: 0,
        baseDelayMinutes: 0,
        maxDelayMinutes: 0,
        escalateAfterAttempts: 1,
        notifyCustomerAfterAttempts: 1,
      },
    ],
  ]);

  constructor(private readonly ruleRegistry: RuleRegistry) {
    this.initializeRetryRules();
  }

  /**
   * 評估重試決策
   */
  async evaluateRetryDecision(context: RetryDecisionContext): Promise<RetryDecisionResult> {
    const ruleContext: IRuleExecutionContext = {
      data: {
        payment: {
          id: context.paymentId,
          subscriptionId: context.subscriptionId,
          amount: context.paymentAmount,
          currency: context.currency,
        },
        failure: {
          category: context.failureCategory,
          reason: context.failureReason,
          attemptNumber: context.attemptNumber,
          totalFailureCount: context.totalFailureCount,
          lastAttemptDate: context.lastAttemptDate,
        },
        customer: {
          tier: context.customerTier,
        },
        metadata: context.metadata,
      },
      timestamp: new Date(),
    };

    // 獲取適用的重試規則並按優先級排序
    const retryRules = this.ruleRegistry.getEnabledRulesByType(RuleType.RETRY).sort((a, b) => b.priority - a.priority); // 高優先級先執行
    const appliedRules: string[] = [];

    // 預設策略
    const defaultStrategy = this.DEFAULT_RETRY_STRATEGIES.get(context.failureCategory) || this.DEFAULT_RETRY_STRATEGIES.get(PaymentFailureCategory.NON_RETRIABLE)!;

    const finalStrategy = { ...defaultStrategy };
    let customDecision: Partial<RetryDecisionResult> = {};
    let shouldTerminate = false; // 是否因為高優先級規則而終止

    // 按優先級執行規則
    for (const rule of retryRules) {
      const ruleResult = await this.evaluateRetryRule(rule, ruleContext);

      if (ruleResult.applied) {
        appliedRules.push(rule.id);

        // 如果規則要求立即終止（如欺詐檢測），立即應用
        if (ruleResult.customDecision && (ruleResult.customDecision.shouldRetry === false || ruleResult.customDecision.escalateToManual)) {
          customDecision = { ...customDecision, ...ruleResult.customDecision };
          shouldTerminate = true;
          break; // 高優先級阻擋規則，立即終止
        }

        // 合併規則決策，只合併有值的屬性
        if (ruleResult.overrideStrategy && ruleResult.strategyOverride) {
          Object.keys(ruleResult.strategyOverride).forEach((key) => {
            const value = ruleResult.strategyOverride![key as keyof RetryConfiguration];
            if (value !== undefined) {
              (finalStrategy as any)[key] = value;
            }
          });
        }
      }
    }

    // 如果沒有被高優先級規則終止，計算最終決策
    let shouldRetry = false;
    let nextRetryDate: Date | undefined;
    let escalateToManual = false;
    let notifyCustomer = false;
    let reason = `${context.failureCategory} failure`;

    if (!shouldTerminate) {
      // 使用修改後的策略重新評估是否應該重試
      // attemptNumber 表示已經完成的嘗試次數，所以要小於 maxRetries
      shouldRetry = context.attemptNumber < finalStrategy.maxRetries && finalStrategy.strategyType !== RetryStrategyType.NONE;

      nextRetryDate = shouldRetry ? this.calculateNextRetryTime(context.attemptNumber, finalStrategy) : undefined;

      escalateToManual = context.attemptNumber >= (finalStrategy.escalateAfterAttempts || finalStrategy.maxRetries);
      notifyCustomer = context.attemptNumber >= (finalStrategy.notifyCustomerAfterAttempts || 1);

      if (!shouldRetry) {
        reason = context.attemptNumber >= finalStrategy.maxRetries ? 'Maximum retry attempts exceeded' : 'Non-retriable failure category';
      } else {
        reason = `Retry allowed - attempt ${context.attemptNumber + 1} of ${finalStrategy.maxRetries}`;
      }
    }

    return {
      shouldRetry: customDecision.shouldRetry !== undefined ? customDecision.shouldRetry : shouldRetry,
      nextRetryDate: customDecision.nextRetryDate || nextRetryDate,
      retryStrategy: finalStrategy.strategyType,
      maxRetries: finalStrategy.maxRetries,
      delayMinutes: finalStrategy.baseDelayMinutes,
      escalateToManual: customDecision.escalateToManual !== undefined ? customDecision.escalateToManual : escalateToManual,
      notifyCustomer: customDecision.notifyCustomer !== undefined ? customDecision.notifyCustomer : notifyCustomer,
      reason: customDecision.reason || reason,
      appliedRules,
      metadata: {
        originalFailureCategory: context.failureCategory,
        strategyType: finalStrategy.strategyType,
        evaluatedRules: retryRules.length,
        appliedRules: appliedRules.length,
        timestamp: new Date(),
        terminatedByHighPriorityRule: shouldTerminate,
        ...customDecision.metadata,
      },
    };
  }

  /**
   * 計算下次重試時間
   */
  calculateNextRetryTime(attemptNumber: number, strategy: RetryConfiguration): Date {
    let delayMinutes = strategy.baseDelayMinutes;

    switch (strategy.strategyType) {
      case RetryStrategyType.LINEAR:
        delayMinutes = strategy.baseDelayMinutes * attemptNumber;
        break;

      case RetryStrategyType.EXPONENTIAL_BACKOFF:
        const multiplier = strategy.multiplier || 2;
        delayMinutes = strategy.baseDelayMinutes * Math.pow(multiplier, attemptNumber - 1);
        break;

      case RetryStrategyType.FIXED_INTERVAL:
        delayMinutes = strategy.baseDelayMinutes;
        break;
    }

    // 限制最大延遲時間
    delayMinutes = Math.min(delayMinutes, strategy.maxDelayMinutes);

    return new Date(Date.now() + delayMinutes * 60 * 1000);
  }

  /**
   * 獲取失敗類別的重試策略
   */
  getRetryStrategy(failureCategory: PaymentFailureCategory): RetryConfiguration {
    return this.DEFAULT_RETRY_STRATEGIES.get(failureCategory) || this.DEFAULT_RETRY_STRATEGIES.get(PaymentFailureCategory.NON_RETRIABLE)!;
  }

  /**
   * 評估單個重試規則
   */
  private async evaluateRetryRule(
    rule: IRuleDefinition,
    context: IRuleExecutionContext,
  ): Promise<{
    applied: boolean;
    overrideStrategy?: boolean;
    strategyOverride?: Partial<RetryConfiguration>;
    customDecision?: Partial<RetryDecisionResult>;
  }> {
    // 檢查條件是否匹配
    const conditionsMet = this.evaluateConditions(rule.conditions, context.data);

    if (!conditionsMet) {
      return { applied: false };
    }

    // 執行動作
    for (const action of rule.actions) {
      switch (action.actionType) {
        case 'OVERRIDE_RETRY_STRATEGY':
          return {
            applied: true,
            overrideStrategy: true,
            strategyOverride: {
              strategyType: action.parameters.strategyType,
              maxRetries: action.parameters.maxRetries,
              baseDelayMinutes: action.parameters.baseDelayMinutes,
              maxDelayMinutes: action.parameters.maxDelayMinutes,
              multiplier: action.parameters.multiplier,
            },
          };

        case 'FORCE_NO_RETRY':
          return {
            applied: true,
            customDecision: {
              shouldRetry: false,
              reason: action.parameters.reason,
              escalateToManual: action.parameters.escalateToManual || false,
            },
          };

        case 'EXTEND_RETRY_LIMIT':
          return {
            applied: true,
            overrideStrategy: true,
            strategyOverride: {
              maxRetries: action.parameters.newMaxRetries,
            },
          };

        case 'IMMEDIATE_ESCALATION':
          return {
            applied: true,
            customDecision: {
              shouldRetry: false,
              escalateToManual: true,
              notifyCustomer: true,
              reason: action.parameters.reason,
            },
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
   * 初始化預設重試規則
   */
  private initializeRetryRules(): void {
    const defaultRules: IRuleDefinition[] = [
      {
        id: 'retry-premium-customer-extended',
        name: '高級客戶延長重試規則',
        type: RuleType.RETRY,
        priority: 900,
        conditions: [
          {
            field: 'customer.tier',
            operator: RuleConditionOperator.EQUALS,
            value: 'PREMIUM',
          },
          {
            field: 'failure.category',
            operator: RuleConditionOperator.IN,
            value: [PaymentFailureCategory.RETRIABLE, PaymentFailureCategory.DELAYED_RETRY],
          },
        ],
        actions: [
          {
            actionType: 'EXTEND_RETRY_LIMIT',
            parameters: {
              newMaxRetries: 7,
              reason: 'Extended retry for premium customer',
            },
          },
        ],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'retry-high-amount-immediate-escalation',
        name: '高額支付立即升級規則',
        type: RuleType.RETRY,
        priority: 1000,
        conditions: [
          {
            field: 'payment.amount',
            operator: RuleConditionOperator.GREATER_THAN,
            value: 10000,
          },
          {
            field: 'failure.attemptNumber',
            operator: RuleConditionOperator.GREATER_THAN,
            value: 2,
          },
        ],
        actions: [
          {
            actionType: 'IMMEDIATE_ESCALATION',
            parameters: {
              reason: 'High-value payment requires manual review',
            },
          },
        ],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'retry-fraud-suspected-block',
        name: '疑似欺詐阻擋重試規則',
        type: RuleType.RETRY,
        priority: 1200,
        conditions: [
          {
            field: 'failure.reason',
            operator: RuleConditionOperator.IN,
            value: ['FRAUD_SUSPECTED', 'CARD_BLOCKED', 'SECURITY_VIOLATION'],
          },
        ],
        actions: [
          {
            actionType: 'FORCE_NO_RETRY',
            parameters: {
              reason: 'Security concern detected - no retry allowed',
              escalateToManual: true,
            },
          },
        ],
        enabled: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'retry-weekend-delay-strategy',
        name: '週末延遲重試策略',
        type: RuleType.RETRY,
        priority: 50, // 降低優先級，讓Premium客戶規則優先
        conditions: [
          {
            field: 'failure.category',
            operator: RuleConditionOperator.EQUALS,
            value: PaymentFailureCategory.DELAYED_RETRY,
          },
        ],
        actions: [
          {
            actionType: 'OVERRIDE_RETRY_STRATEGY',
            parameters: {
              strategyType: RetryStrategyType.EXPONENTIAL_BACKOFF,
              // 不要覆蓋 maxRetries，讓其他規則決定
              baseDelayMinutes: 120, // 2小時基礎延遲
              maxDelayMinutes: 4320, // 最大72小時
              multiplier: 3,
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

    this.logger.log(`Initialized ${defaultRules.length} default retry rules`);
  }
}
