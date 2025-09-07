import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IRulesEngine, IRuleLoader, IRuleExecutionContext, IRuleExecutionResult, IRuleDefinition, RuleType } from './interfaces/rules-engine.interface';
import { RuleRegistry } from './rule-registry.service';
import { RuleEvaluator } from './rule-evaluator.service';

/**
 * 業務規則引擎核心實現
 * 統一管理和執行業務規則
 */
@Injectable()
export class RulesEngine implements IRulesEngine, OnModuleInit {
  private readonly logger = new Logger(RulesEngine.name);

  constructor(
    private readonly ruleRegistry: RuleRegistry,
    private readonly ruleEvaluator: RuleEvaluator,
  ) {}

  /**
   * 模組初始化
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Rules Engine initialized');
  }

  /**
   * 執行指定類型的規則
   */
  async execute<T = any>(type: RuleType, context: IRuleExecutionContext): Promise<IRuleExecutionResult<T>> {
    const startTime = Date.now();
    const appliedRules: string[] = [];
    const errors: any[] = [];
    let result: T | undefined = undefined;

    try {
      this.logger.debug(`Executing rules of type: ${type}`, {
        traceId: context.traceId,
        dataKeys: Object.keys(context.data),
      });

      // 獲取指定類型的有效規則
      const rules = this.ruleRegistry.getValidRulesAtTime(type, context.timestamp);

      if (rules.length === 0) {
        this.logger.debug(`No valid rules found for type: ${type}`);
        return {
          success: true,
          appliedRules: [],
          executionTime: Date.now() - startTime,
        };
      }

      // 按優先級執行規則
      for (const rule of rules) {
        try {
          // 評估規則條件
          const conditionsMet = await this.ruleEvaluator.evaluateRule(rule, context);

          if (conditionsMet) {
            this.logger.debug(`Rule conditions met: ${rule.id}`, {
              traceId: context.traceId,
            });

            // 執行規則動作
            const actionResult = await this.ruleEvaluator.executeRuleActions(rule, context);

            // 記錄已應用的規則
            appliedRules.push(rule.id);

            // 合併結果
            result = this.mergeResults(result, actionResult);

            this.logger.debug(`Rule applied successfully: ${rule.id}`, {
              traceId: context.traceId,
              actionResult,
            });

            // 如果是終止規則，停止後續規則執行
            if (rule.terminal) {
              this.logger.debug(`Terminal rule applied, stopping execution: ${rule.id}`, {
                traceId: context.traceId,
              });
              break;
            }
          } else {
            this.logger.debug(`Rule conditions not met: ${rule.id}`, {
              traceId: context.traceId,
            });
          }
        } catch (error) {
          const errorDetail = {
            ruleId: rule.id,
            message: error.message,
            code: 'RULE_EXECUTION_ERROR',
            details: error,
          };

          errors.push(errorDetail);

          this.logger.error(`Error executing rule ${rule.id}: ${error.message}`, {
            traceId: context.traceId,
            error: errorDetail,
          });

          // 根據規則的錯誤處理策略決定是否繼續
          if (rule.metadata?.errorHandling === 'FAIL_FAST') {
            throw error;
          }
        }
      }

      const executionTime = Date.now() - startTime;
      const success = errors.length === 0;

      this.logger.log(`Rules execution completed for type: ${type}`, {
        traceId: context.traceId,
        appliedRules: appliedRules.length,
        totalRules: rules.length,
        executionTime,
        success,
      });

      return {
        success,
        result,
        appliedRules,
        errors: errors.length > 0 ? errors : undefined,
        executionTime,
        metadata: {
          totalRulesEvaluated: rules.length,
          rulesApplied: appliedRules.length,
          type,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logger.error(`Fatal error executing rules for type: ${type}`, {
        traceId: context.traceId,
        error: error.message,
        executionTime,
      });

      return {
        success: false,
        appliedRules,
        errors: [
          {
            ruleId: 'ENGINE',
            message: error.message,
            code: 'ENGINE_ERROR',
            details: error,
          },
        ],
        executionTime,
      };
    }
  }

  /**
   * 執行指定規則
   */
  async executeRule<T = any>(ruleId: string, context: IRuleExecutionContext): Promise<IRuleExecutionResult<T>> {
    const startTime = Date.now();

    try {
      this.logger.debug(`Executing specific rule: ${ruleId}`, {
        traceId: context.traceId,
      });

      // 獲取規則
      const rule = this.ruleRegistry.getRule(ruleId);
      if (!rule) {
        return {
          success: false,
          appliedRules: [],
          errors: [
            {
              ruleId,
              message: `Rule not found: ${ruleId}`,
              code: 'RULE_NOT_FOUND',
            },
          ],
          executionTime: Date.now() - startTime,
        };
      }

      // 檢查規則是否啟用
      if (!rule.enabled) {
        return {
          success: false,
          appliedRules: [],
          errors: [
            {
              ruleId,
              message: `Rule is disabled: ${ruleId}`,
              code: 'RULE_DISABLED',
            },
          ],
          executionTime: Date.now() - startTime,
        };
      }

      // 評估規則條件
      const conditionsMet = await this.ruleEvaluator.evaluateRule(rule, context);

      if (!conditionsMet) {
        return {
          success: true,
          appliedRules: [],
          executionTime: Date.now() - startTime,
          metadata: {
            conditionsMet: false,
            reason: 'Rule conditions not satisfied',
          },
        };
      }

      // 執行規則動作
      const actionResult = await this.ruleEvaluator.executeRuleActions(rule, context);

      const executionTime = Date.now() - startTime;

      this.logger.log(`Rule executed successfully: ${ruleId}`, {
        traceId: context.traceId,
        executionTime,
      });

      return {
        success: true,
        result: actionResult as T,
        appliedRules: [ruleId],
        executionTime,
        metadata: {
          conditionsMet: true,
          ruleType: rule.type,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logger.error(`Error executing rule ${ruleId}: ${error.message}`, {
        traceId: context.traceId,
        error: error.message,
        executionTime,
      });

      return {
        success: false,
        appliedRules: [],
        errors: [
          {
            ruleId,
            message: error.message,
            code: 'RULE_EXECUTION_ERROR',
            details: error,
          },
        ],
        executionTime,
      };
    }
  }

  /**
   * 載入規則定義
   */
  async loadRules(loader: IRuleLoader): Promise<void> {
    try {
      this.logger.log('Loading rules from loader...');

      const rules = await loader.loadRules();

      this.logger.log(`Loading ${rules.length} rules...`);

      // 註冊所有規則
      for (const rule of rules) {
        try {
          this.ruleRegistry.registerRule(rule);
        } catch (error) {
          this.logger.error(`Failed to register rule ${rule.id}: ${error.message}`, error.stack);
        }
      }

      const statistics = this.getStatistics();
      this.logger.log('Rules loaded successfully', statistics);
    } catch (error) {
      this.logger.error(`Failed to load rules: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 註冊規則
   */
  registerRule(rule: IRuleDefinition): void {
    this.ruleRegistry.registerRule(rule);
  }

  /**
   * 獲取規則統計信息
   */
  getStatistics(): {
    totalRules: number;
    rulesByType: Record<RuleType, number>;
    enabledRules: number;
    disabledRules: number;
  } {
    return this.ruleRegistry.getStatistics();
  }

  /**
   * 合併執行結果
   */
  private mergeResults<T>(existing: T | undefined, newResult: any): T {
    if (existing === undefined) {
      return newResult;
    }

    // 如果兩個結果都是對象，進行合併
    if (typeof existing === 'object' && typeof newResult === 'object' && existing !== null && newResult !== null) {
      return { ...existing, ...newResult } as T;
    }

    // 如果兩個結果都是數組，進行連接
    if (Array.isArray(existing) && Array.isArray(newResult)) {
      return [...existing, ...newResult] as unknown as T;
    }

    // 否則新結果覆蓋舊結果
    return newResult;
  }
}
