import { Module } from '@nestjs/common';
import { RuleRegistry } from './rule-registry.service';
import { RulesEngine } from './rules-engine.service';
import { RuleEvaluator } from './rule-evaluator.service';
import { BillingRulesEngine } from './billing-rules.engine';
import { RetryStrategyEngine } from './retry-strategy.engine';
import { PromotionStackingEngine } from './promotion-stacking.engine';

/**
 * 業務規則引擎模組
 * 統一管理所有業務規則相關的服務
 */
@Module({
  providers: [RuleRegistry, RulesEngine, RuleEvaluator, BillingRulesEngine, RetryStrategyEngine, PromotionStackingEngine],
  exports: [RuleRegistry, RulesEngine, RuleEvaluator, BillingRulesEngine, RetryStrategyEngine, PromotionStackingEngine],
})
export class BusinessRulesEngineModule {}
