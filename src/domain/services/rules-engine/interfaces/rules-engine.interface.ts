/**
 * 業務規則引擎介面定義
 * 定義規則引擎的核心抽象和類型
 */

/**
 * 規則類型枚舉
 */
export enum RuleType {
  PRICING = 'PRICING', // 定價規則
  PROMOTION = 'PROMOTION', // 優惠規則
  RETRY = 'RETRY', // 重試規則
  REFUND = 'REFUND', // 退款規則
  BILLING = 'BILLING', // 計費規則
}

/**
 * 規則條件操作符
 */
export enum RuleOperator {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  GREATER_THAN_OR_EQUAL = 'GREATER_THAN_OR_EQUAL',
  LESS_THAN_OR_EQUAL = 'LESS_THAN_OR_EQUAL',
  CONTAINS = 'CONTAINS',
  NOT_CONTAINS = 'NOT_CONTAINS',
  IN = 'IN',
  NOT_IN = 'NOT_IN',
  REGEX = 'REGEX',
}

/**
 * 規則條件定義
 */
export interface IRuleCondition {
  field: string; // 字段路徑 (支持嵌套，如 'user.subscription.status')
  operator: RuleOperator; // 操作符
  value: any; // 比較值
  valueType?: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ARRAY' | 'DATE';
}

/**
 * 規則動作定義
 */
export interface IRuleAction {
  actionType: string; // 動作類型
  parameters: Record<string, any>; // 動作參數
}

/**
 * 規則定義
 */
export interface IRuleDefinition {
  id: string; // 規則唯一標識
  name: string; // 規則名稱
  description?: string; // 規則描述
  type: RuleType; // 規則類型
  priority: number; // 優先級 (數值越大優先級越高)
  conditions: IRuleCondition[]; // 條件組合 (AND 邏輯)
  actions: IRuleAction[]; // 執行動作
  terminal?: boolean; // 是否為終止規則 (執行後停止後續規則)
  enabled: boolean; // 是否啟用
  validFrom?: Date; // 生效開始時間
  validTo?: Date; // 生效結束時間
  metadata?: Record<string, any>; // 元數據
  version: number; // 版本號
  createdAt: Date; // 創建時間
  updatedAt: Date; // 更新時間
}

/**
 * 規則執行上下文
 */
export interface IRuleExecutionContext {
  data: Record<string, any>; // 業務數據
  metadata?: Record<string, any>; // 上下文元數據
  traceId?: string; // 追蹤ID
  timestamp: Date; // 執行時間
}

/**
 * 規則執行結果
 */
export interface IRuleExecutionResult<T = any> {
  success: boolean; // 是否成功執行
  result?: T; // 執行結果
  appliedRules: string[]; // 已應用的規則ID列表
  errors?: IRuleExecutionError[]; // 錯誤信息
  executionTime: number; // 執行耗時(毫秒)
  metadata?: Record<string, any>; // 結果元數據
}

/**
 * 規則執行錯誤
 */
export interface IRuleExecutionError {
  ruleId: string; // 出錯規則ID
  message: string; // 錯誤消息
  code?: string; // 錯誤代碼
  details?: any; // 錯誤詳情
}

/**
 * 規則評估器介面
 */
export interface IRuleEvaluator {
  /**
   * 評估單個規則是否滿足條件
   */
  evaluateRule(rule: IRuleDefinition, context: IRuleExecutionContext): Promise<boolean>;

  /**
   * 執行規則動作
   */
  executeRuleActions(rule: IRuleDefinition, context: IRuleExecutionContext): Promise<any>;
}

/**
 * 規則註冊表介面
 */
export interface IRuleRegistry {
  /**
   * 註冊規則
   */
  registerRule(rule: IRuleDefinition): void;

  /**
   * 取消註冊規則
   */
  unregisterRule(ruleId: string): void;

  /**
   * 獲取指定類型的所有規則
   */
  getRulesByType(type: RuleType): IRuleDefinition[];

  /**
   * 獲取所有規則
   */
  getAllRules(): IRuleDefinition[];

  /**
   * 獲取特定規則
   */
  getRule(ruleId: string): IRuleDefinition | null;

  /**
   * 清空所有規則
   */
  clearRules(): void;

  // 新增：獲取已啟用規則與在指定時間有效的規則，與 RuleRegistry 實作保持一致
  /** 獲取指定類型的已啟用規則 */
  getEnabledRulesByType(type: RuleType): IRuleDefinition[];
  /** 獲取在指定時間有效的規則 */
  getValidRulesAtTime(type: RuleType, timestamp: Date): IRuleDefinition[];
}

/**
 * 規則載入器介面
 */
export interface IRuleLoader {
  /**
   * 從指定來源載入規則
   */
  loadRules(): Promise<IRuleDefinition[]>;

  /**
   * 重新載入規則
   */
  reloadRules(): Promise<IRuleDefinition[]>;
}

/**
 * 規則引擎核心介面
 */
export interface IRulesEngine {
  /**
   * 執行指定類型的規則
   */
  execute<T = any>(type: RuleType, context: IRuleExecutionContext): Promise<IRuleExecutionResult<T>>;

  /**
   * 執行指定規則
   */
  executeRule<T = any>(ruleId: string, context: IRuleExecutionContext): Promise<IRuleExecutionResult<T>>;

  /**
   * 載入規則定義
   */
  loadRules(loader: IRuleLoader): Promise<void>;

  /**
   * 註冊規則
   */
  registerRule(rule: IRuleDefinition): void;

  /**
   * 獲取規則統計信息
   */
  getStatistics(): {
    totalRules: number;
    rulesByType: Record<RuleType, number>;
    enabledRules: number;
    disabledRules: number;
  };
}
