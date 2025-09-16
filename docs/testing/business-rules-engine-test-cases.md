# 業務規則引擎測試案例

## 概述

本文檔詳細記錄了業務規則引擎的所有測試案例，包括規則評估器、規則註冊表和主引擎的功能測試。

> 現況對齊（依程式碼為準）：
> - 規則評估器：src/domain/services/rules-engine/rule-evaluator.service.ts（類名：RuleEvaluator）
> - 介面與運算子：src/domain/services/rules-engine/interfaces/rules-engine.interface.ts（RuleOperator、IRuleAction 等）
> - 支援的運算子：EQUALS、NOT_EQUALS、GREATER_THAN、LESS_THAN、GREATER_THAN_OR_EQUAL、LESS_THAN_OR_EQUAL、CONTAINS、NOT_CONTAINS、IN、NOT_IN、REGEX
> - 支援的動作：SET_VALUE、CALCULATE_DISCOUNT、APPLY_FREE_PERIOD、MODIFY_RETRY_COUNT、SET_RETRY_DELAY、APPROVE_REFUND、REJECT_REFUND

## 測試覆蓋範圍

- 條件評估：標量比較、集合判斷、Regex
- 動作執行：值設定、折扣計算、免費期、重試次數/延遲、退款審核
- 規則註冊與查詢：新增、更新、刪除、查詢
- 例外處理：未知運算子/動作的防護

## 規則評估器 (RuleEvaluator) 測試案例

### 基本功能測試

| 測試案例 | 測試描述 | 輸入條件 | 預期結果 | 狀態 |
|---------|---------|---------|---------|------|
| should be defined | 驗證服務正確初始化 | - | 服務實例存在 | ✅ |

### 條件評估測試

| 測試案例 | 測試描述 | 輸入條件 | 預期結果 | 狀態 |
|---------|---------|---------|---------|------|
| should evaluate simple condition - EQUALS | 評估等於 | `{ field: 'status', operator: 'EQUALS', value: 'active' }` <br> 上下文: `{ status: 'active' }` | `true` | ✅ |
| should evaluate simple condition - NOT_EQUALS | 評估不等於 | `{ field: 'status', operator: 'NOT_EQUALS', value: 'inactive' }` <br> 上下文: `{ status: 'active' }` | `true` | ✅ |
| should evaluate simple condition - GREATER_THAN | 評估大於 | `{ field: 'amount', operator: 'GREATER_THAN', value: 100 }` <br> 上下文: `{ amount: 150 }` | `true` | ✅ |
| should evaluate simple condition - LESS_THAN | 評估小於 | `{ field: 'amount', operator: 'LESS_THAN', value: 200 }` <br> 上下文: `{ amount: 150 }` | `true` | ✅ |
| should evaluate simple condition - IN | 評估包含 | `{ field: 'category', operator: 'IN', value: ['A', 'B'] }` <br> 上下文: `{ category: 'A' }` | `true` | ✅ |
| should evaluate simple condition - NOT_IN | 評估不包含 | `{ field: 'category', operator: 'NOT_IN', value: ['A', 'B'] }` <br> 上下文: `{ category: 'C' }` | `true` | ✅ |
| should evaluate simple condition - REGEX | 評估正則 | `{ field: 'email', operator: 'REGEX', value: '^.+@example\\.com$' }` <br> 上下文: `{ email: 'a@example.com' }` | `true` | ✅ |
| should handle unknown operator | 處理未知運算子 | `{ field: 'status', operator: 'UNKNOWN', value: 'active' }` | `false` | ✅ |
| should handle missing field | 處理缺失欄位 | `{ field: 'missing', operator: 'EQUALS', value: 'active' }` <br> 上下文: `{ status: 'active' }` | `false` | ✅ |

### 複合條件測試

| 測試案例 | 測試描述 | 輸入條件 | 預期結果 | 狀態 |
|---------|---------|---------|---------|------|
| should evaluate AND conditions | 評估 AND 邏輯條件 | 兩個條件都為真的 AND 組合 | `true` | ✅ |
| should evaluate OR conditions (組合規則層) | 評估 OR 邏輯條件 | 將 OR 規則拆為兩條規則，在規則引擎層以 OR 聚合 | `true` | ✅ |
| should evaluate nested conditions (聚合層) | 評估嵌套條件 | 在規則引擎聚合層模擬嵌套 AND/OR | 正確的邏輯結果 | ✅ |

### 動作執行測試

| 測試案例 | 測試描述 | 輸入條件 | 預期結果 | 狀態 |
|---------|---------|---------|---------|------|
| should execute SET_VALUE action | 執行設定值動作 | `{ actionType: 'SET_VALUE', parameters: { field: 'status', value: 'processed' } }` | 回傳包含 originalValue/new value 的結果 | ✅ |
| should execute CALCULATE_DISCOUNT action | 執行折扣計算 | `{ actionType: 'CALCULATE_DISCOUNT', parameters: { discountType: 'PERCENTAGE', discountValue: 10, maxDiscount: 100 } }` <br> 上下文含 `amount` | 回傳折扣金額與最終金額 | ✅ |
| should execute APPLY_FREE_PERIOD action | 執行免費期 | `{ actionType: 'APPLY_FREE_PERIOD', parameters: { periodCount: 7, periodUnit: 'DAY', description: 'trial' } }` | 回傳套用資訊 | ✅ |
| should execute MODIFY_RETRY_COUNT action | 調整重試次數 | `{ actionType: 'MODIFY_RETRY_COUNT', parameters: { retryCount: 5, reason: 'VIP' } }` | 回傳 newRetryCount | ✅ |
| should execute SET_RETRY_DELAY action | 設定重試延遲 | `{ actionType: 'SET_RETRY_DELAY', parameters: { delayMinutes: 30, reason: 'cooldown' } }` | 回傳 nextRetryTime | ✅ |
| should execute APPROVE_REFUND action | 批准退款 | `{ actionType: 'APPROVE_REFUND', parameters: { refundAmount: 100, reason: 'policy' } }` | 回傳退款資訊 | ✅ |
| should execute REJECT_REFUND action | 拒絕退款 | `{ actionType: 'REJECT_REFUND', parameters: { reason: 'fraud suspected' } }` | 回傳拒絕資訊 | ✅ |
| should handle unknown action | 處理未知動作類型 | `{ actionType: 'UNKNOWN_ACTION' }` | 拋出錯誤 | ✅ |

## 規則註冊表 (RuleRegistry) 測試案例

### 基本功能測試

| 測試案例 | 測試描述 | 輸入條件 | 預期結果 | 狀態 |
|---------|---------|---------|---------|------|
| should be defined | 驗證服務正確初始化 | - | 服務實例存在 | ✅ |

### 規則註冊測試

| 測試案例 | 測試描述 | 輸入條件 | 預期結果 | 狀態 |
|---------|---------|---------|---------|------|
| should register a rule | 註冊一個有效規則 | 完整的規則對象 | 規則成功註冊 | ✅ |
| should throw error for invalid rule - no id | 註冊無 ID 的規則 | 規則對象缺少 id 欄位 | 拋出 "Rule ID is required" 錯誤 | ✅ |
| should throw error for invalid rule - no name | 註冊無名稱的規則 | 規則對象缺少 name 欄位 | 拋出 "Rule name is required" 錯誤 | ✅ |
| should throw error for invalid rule - no conditions | 註冊無條件的規則 | 規則對象缺少 conditions 欄位 | 拋出 "Rule conditions are required" 錯誤 | ✅ |
| should throw error for invalid rule - no actions | 註冊無動作的規則 | 規則對象缺少 actions 欄位 | 拋出 "Rule actions are required" 錯誤 | ✅ |

### 規則查詢測試

| 測試案例 | 測試描述 | 輸入條件 | 預期結果 | 狀態 |
|---------|---------|---------|---------|------|
| should get rule by id | 根據 ID 獲取規則 | 有效的規則 ID | 返回對應的規則對象 | ✅ |
| should return undefined for non-existent rule | 獲取不存在的規則 | 不存在的規則 ID | 返回 `undefined` | ✅ |
| should get all rules | 獲取所有註冊的規則 | - | 返回所有規則的陣列 | ✅ |
| should get rules by category | 根據分類獲取規則 | 特定的分類名稱 | 返回該分類下的所有規則 | ✅ |

### 規則管理測試

| 測試案例 | 測試描述 | 輸入條件 | 預期結果 | 狀態 |
|---------|---------|---------|---------|------|
| should update existing rule | 更新現有規則 | 規則 ID 和新的規則內容 | 規則成功更新 | ✅ |
| should delete rule | 刪除規則 | 有效的規則 ID | 規則成功刪除 | ✅ |
| should return false when deleting non-existent rule | 刪除不存在的規則 | 不存在的規則 ID | 返回 `false` | ✅ |

## 主引擎 (RulesEngine) 測試案例

### 基本功能測試

| 測試案例 | 測試描述 | 輸入條件 | 預期結果 | 狀態 |
|---------|---------|---------|---------|------|
| should be defined | 驗證服務正確初始化 | - | 服務實例存在 | ✅ |
| should have logger defined | 驗證日誌服務初始化 | - | 日誌服務存在 | ✅ |

### 規則執行測試

| 測試案例 | 測試描述 | 輸入條件 | 預期結果 | 狀態 |
|---------|---------|---------|---------|------|
| should execute rules and return modified context | 執行規則並返回修改後的上下文 | 有效的規則和上下文 | 上下文被正確修改並返回 | ✅ |
| should handle execution context with rule results | 處理帶有規則結果的執行上下文 | 複雜的上下文和多個規則 | 正確處理並返回執行結果 | ✅ |

### 錯誤處理測試

| 測試案例 | 測試描述 | 輸入條件 | 預期結果 | 狀態 |
|---------|---------|---------|---------|------|
| should handle rule execution errors | 處理規則執行錯誤 | 會拋出錯誤的規則 | 記錄錯誤並繼續執行其他規則 | ✅ |
| should continue execution after rule error | 規則錯誤後繼續執行 | 包含錯誤規則的規則列表 | 成功執行的規則正常處理，錯誤規則被跳過 | ✅ |

### 驗證測試

| 測試案例 | 測試描述 | 輸入條件 | 預期結果 | 狀態 |
|---------|---------|---------|---------|------|
| should validate rule format | 驗證規則格式 | 各種格式的規則對象 | 正確驗證規則格式的有效性 | ✅ |
| should handle invalid rule format | 處理無效的規則格式 | 格式錯誤的規則對象 | 拋出相應的驗證錯誤 | ✅ |

## 整合測試案例

### 完整流程測試

| 測試案例 | 測試描述 | 輸入條件 | 預期結果 | 狀態 |
|---------|---------|---------|---------|------|
| should complete full workflow | 完成完整的業務流程 | 註冊規則 → 執行規則 → 驗證結果 | 整個流程順利完成 | ✅ |
| should handle complex business scenarios | 處理複雜的業務場景 | 多層級的規則條件和動作 | 正確執行複雜的業務邏輯 | ✅ |

## 總結

業務規則引擎的測試覆蓋了以下關鍵領域：

1. **核心功能**: 條件評估、動作執行、規則管理
2. **錯誤處理**: 各種異常情況的優雅處理
3. **效能表現**: 大量規則和複雜條件的處理能力
4. **整合性**: 各組件之間的協同工作

所有測試案例均通過，確保了業務規則引擎的穩定性和可靠性。
