# 業務規則引擎測試案例

## 概述

本文檔詳細記錄了業務規則引擎的所有測試案例，包括規則評估器、規則註冊表和主引擎的功能測試。

## 測試統計

- **總測試數量**: 45個
- **測試通過率**: 100%
- **測試覆蓋範圍**: 完整的功能覆蓋，包括正常流程和異常處理

## 規則評估器 (RuleEvaluator) 測試案例

### 基本功能測試

| 測試案例 | 測試描述 | 輸入條件 | 預期結果 | 狀態 |
|---------|---------|---------|---------|------|
| should be defined | 驗證服務正確初始化 | - | 服務實例存在 | ✅ |

### 條件評估測試

| 測試案例 | 測試描述 | 輸入條件 | 預期結果 | 狀態 |
|---------|---------|---------|---------|------|
| should evaluate simple condition - equals | 評估簡單的等於條件 | `{ field: 'status', operator: 'equals', value: 'active' }` <br> 上下文: `{ status: 'active' }` | `true` | ✅ |
| should evaluate simple condition - not equals | 評估簡單的不等於條件 | `{ field: 'status', operator: 'not_equals', value: 'inactive' }` <br> 上下文: `{ status: 'active' }` | `true` | ✅ |
| should evaluate simple condition - greater than | 評估大於條件 | `{ field: 'amount', operator: 'greater_than', value: 100 }` <br> 上下文: `{ amount: 150 }` | `true` | ✅ |
| should evaluate simple condition - less than | 評估小於條件 | `{ field: 'amount', operator: 'less_than', value: 200 }` <br> 上下文: `{ amount: 150 }` | `true` | ✅ |
| should evaluate simple condition - in | 評估包含條件 | `{ field: 'category', operator: 'in', value: ['A', 'B'] }` <br> 上下文: `{ category: 'A' }` | `true` | ✅ |
| should evaluate simple condition - not in | 評估不包含條件 | `{ field: 'category', operator: 'not_in', value: ['A', 'B'] }` <br> 上下文: `{ category: 'C' }` | `true` | ✅ |
| should handle unknown operator | 處理未知運算子 | `{ field: 'status', operator: 'unknown', value: 'active' }` | `false` | ✅ |
| should handle missing field | 處理缺失欄位 | `{ field: 'missing', operator: 'equals', value: 'active' }` <br> 上下文: `{ status: 'active' }` | `false` | ✅ |

### 複合條件測試

| 測試案例 | 測試描述 | 輸入條件 | 預期結果 | 狀態 |
|---------|---------|---------|---------|------|
| should evaluate AND conditions | 評估 AND 邏輯條件 | 兩個條件都為真的 AND 組合 | `true` | ✅ |
| should evaluate OR conditions | 評估 OR 邏輯條件 | 其中一個條件為真的 OR 組合 | `true` | ✅ |
| should evaluate nested conditions | 評估嵌套條件 | 複雜的嵌套 AND/OR 組合 | 正確的邏輯結果 | ✅ |

### 動作執行測試

| 測試案例 | 測試描述 | 輸入條件 | 預期結果 | 狀態 |
|---------|---------|---------|---------|------|
| should execute CALCULATE action | 執行計算動作 | `{ type: 'CALCULATE', config: { operation: 'add', value: 10 } }` <br> 上下文: `{ amount: 100 }` | 上下文更新為 `{ amount: 110 }` | ✅ |
| should execute UPDATE_FIELD action | 執行欄位更新動作 | `{ type: 'UPDATE_FIELD', config: { field: 'status', value: 'processed' } }` | 上下文欄位被更新 | ✅ |
| should execute LOG action | 執行日誌動作 | `{ type: 'LOG', config: { level: 'info', message: 'Test message' } }` | 日誌被記錄 | ✅ |
| should handle unknown action | 處理未知動作類型 | `{ type: 'UNKNOWN_ACTION' }` | 拋出錯誤 | ✅ |

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

## 效能測試案例

| 測試案例 | 測試描述 | 輸入條件 | 預期結果 | 狀態 |
|---------|---------|---------|---------|------|
| should handle large rule sets efficiently | 高效處理大量規則集 | 100+ 個規則同時執行 | 在合理時間內完成執行 | ✅ |
| should handle complex nested conditions | 處理複雜嵌套條件 | 深度嵌套的 AND/OR 條件 | 正確且高效地評估條件 | ✅ |

## 總結

業務規則引擎的測試覆蓋了以下關鍵領域：

1. **核心功能**: 條件評估、動作執行、規則管理
2. **錯誤處理**: 各種異常情況的優雅處理
3. **效能表現**: 大量規則和複雜條件的處理能力
4. **整合性**: 各組件之間的協同工作

所有測試案例均通過，確保了業務規則引擎的穩定性和可靠性。
