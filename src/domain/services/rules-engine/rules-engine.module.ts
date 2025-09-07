import { Module } from '@nestjs/common';
import { RulesEngine } from './rules-engine.service';
import { RuleRegistry } from './rule-registry.service';
import { RuleEvaluator } from './rule-evaluator.service';

/**
 * 業務規則引擎模組
 * 提供規則引擎相關服務
 */
@Module({
  providers: [RulesEngine, RuleRegistry, RuleEvaluator],
  exports: [RulesEngine, RuleRegistry, RuleEvaluator],
})
export class RulesEngineModule {}
