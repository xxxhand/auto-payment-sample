/**
 * 業務規則引擎 - 核心接口定義
 * 統一規則引擎的接口定義，避免重複和衝突
 */

// 重新導出現有的核心接口，避免重複定義
export {
  RuleType,
  RuleOperator as RuleConditionOperator,
  IRuleCondition,
  IRuleAction,
  IRuleDefinition,
  IRuleExecutionContext,
  IRuleExecutionResult,
  IRuleExecutionError,
  IRuleEvaluator,
  IRuleRegistry,
  IRuleLoader,
  IRulesEngine,
} from './rules-engine.interface';
