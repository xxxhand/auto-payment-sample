# 自動扣款系統測試案例 (Test Cases)

本文檔基於系統設計文件 (`README.md`) 中定義的核心業務流程和圖表，制定了詳細的測試情境，以確保系統的穩定性、正確性和可靠性。

## 1. 訂閱創建流程 (Subscription Creation)

| 案例 ID | 測試情境 | 預期結果 |
| :--- | :--- | :--- |
| **TC-SUB-001** | 成功創建一個新的月費訂閱 (無優惠) | 1. `SubscriptionModel` 成功創建，狀態為 `ACTIVE`。<br>2. `PurchaseHistoryModel` 產生一筆 `COMPLETED` 交易記錄。<br>3. `nextBillingDate` 和 `serviceEndDate` 設定為一個月後。 |
| **TC-SUB-002** | 成功創建一個帶有首購優惠的年費訂閱 | 1. `SubscriptionModel` 成功創建。<br>2. `PurchaseHistoryModel` 記錄的 `actualAmount` 為優惠價，`originalAmount` 為原價。<br>3. `nextBillingDate` 設定為一年後。 |
| **TC-SUB-003** | 創建訂閱時首次扣款失敗 | 1. `SubscriptionModel` 未創建，或狀態為 `PENDING`/`FAILED`。<br>2. `PurchaseHistoryModel` 記錄為 `FAILED`。<br>3. 用戶的服務未被啟用。 |
| **TC-SUB-004** | 創建訂閱時選擇了無效的產品 ID | 1. 請求被拒絕，返回 4xx 錯誤。<br>2. 資料庫中沒有創建任何訂閱或交易記錄。 |

## 2. 定期扣款流程 (Recurring Billing)

| 案例 ID | 測試情境 | 預期結果 |
| :--- | :--- | :--- |
| **TC-BILL-001** | 成功執行一次正常的月費扣款 | 1. 產生一筆新的 `COMPLETED` 交易記錄。<br>2. `SubscriptionModel` 的 `nextBillingDate` 和 `serviceEndDate` 順延一個月。<br>3. `billingCycleCount` 計數加一。 |
| **TC-BILL-002** | 訂閱已取消 (`CANCELLED`)，不應執行扣款 | 1. 定時任務掃描到該訂閱時應直接跳過。<br>2. 不會產生任何新的交易記錄。 |
| **TC-BILL-003** | 訂閱已暫停 (`PAUSED`)，不應執行扣款 | 1. 系統跳過該訂閱的扣款流程。<br>2. `nextBillingDate` 應保持不變或根據業務規則順延。 |
| **TC-BILL-004** | 訂閱在 `nextBillingDate` 當天，但尚未到扣款時間 | 1. 系統不應觸發扣款。 |
| **TC-BILL-005** | 扣款成功後，正確發送成功通知 | 1. 扣款流程成功後，觸發通知服務。<br>2. 可在日誌或模擬的通知服務中看到發送記錄。 |

## 3. 智能重試流程 (Smart Retry)

| 案例 ID | 測試情境 | 預期結果 |
| :--- | :--- | :--- |
| **TC-RETRY-001** | **可重試失敗** (如：網路暫時性問題) | 1. `PurchaseHistoryModel` 狀態為 `FAILED`。<br>2. `PaymentRetryLogModel` 創建記錄，`failureCategory` 為 `RETRIABLE`。<br>3. `SubscriptionModel` 狀態仍為 `ACTIVE`，`retryCount` 加一。<br>4. 系統根據 `retryIntervals` 設定，在短時間後安排下一次重試。 |
| **TC-RETRY-002** | **延後重試失敗** (如：餘額不足) | 1. `PaymentRetryLogModel` 創建記錄，`failureCategory` 為 `DELAYED_RETRY`。<br>2. 系統在較長間隔後安排下一次重試。 |
| **TC-RETRY-003** | **不可重試失敗** (如：盜刷或卡片停用) | 1. `SubscriptionModel` 狀態更新為 `EXPIRED` 或 `CANCELLED`。<br>2. `PaymentRetryLogModel` 記錄結果為 `FAILED`。<br>3. 系統不再安排任何重試。 |
| **TC-RETRY-004** | 重試後扣款成功 | 1. `SubscriptionModel` 狀態恢復正常，`nextBillingDate` 更新，`retryCount` 重置為 0。<br>2. `PurchaseHistoryModel` 狀態更新為 `COMPLETED`。<br>3. `PaymentRetryLogModel` 記錄該次重試結果為 `SUCCESS`。 |
| **TC-RETRY-005** | 重試次數耗盡，但**可延長寬限期** | 1. 當 `retryCount` 達到 `maxRetryAttempts` 時，觸發寬限期邏輯。<br>2. `SubscriptionModel` 的 `serviceEndDate` 被延長，`gracePeriodExtensions` 加一，`retryCount` 重置。<br>3. 系統繼續安排新的重試週期。 |
| **TC-RETRY-006** | 重試次數和寬限期**全部耗盡** | 1. 當 `gracePeriodExtensions` 也達到 `maxGraceExtensions` 後，最後一次扣款依然失敗。<br>2. `SubscriptionModel` 狀態最終變為 `EXPIRED`。 |

## 4. 方案轉換流程 (Plan Change)

| 案例 ID | 測試情境 | 預期結果 |
| :--- | :--- | :--- |
| **TC-CHG-001** | **立即生效**：從低價月費轉為高價月費 | 1. 系統立即執行補款操作。<br>2. 補款成功後，`SubscriptionModel` 的 `currentPlanId` 更新為新方案。<br>3. `PlanChangeHistoryModel` 創建一筆 `COMPLETED` 記錄。<br>4. `nextBillingDate` 維持不變。 |
| **TC-CHG-002** | **立即生效**：從高價月費轉為低價月費 | 1. 系統計算差額並創建退款記錄 (`RefundModel`) 或返還點數。<br>2. `SubscriptionModel` 的 `currentPlanId` 更新。<br>3. `PlanChangeHistoryModel` 創建記錄。 |
| **TC-CHG-003** | **下期生效**：從月費轉為年費 | 1. `SubscriptionModel` 的 `pendingPlanChangeId` 被設定為目標方案 ID。<br>2. `PlanChangeHistoryModel` 創建一筆 `PENDING` 記錄。<br>3. 在下次扣款日，系統會以年費方案進行扣款，並更新 `currentPlanId`。 |
| **TC-CHG-004** | 立即轉換時，補款失敗 | 1. 方案轉換失敗，`SubscriptionModel` 維持原方案。<br>2. `PlanChangeHistoryModel` 記錄為 `FAILED`。<br>3. 返回錯誤訊息給用戶。 |
| **TC-CHG-005** | 請求轉換到一個不被允許的方案 | 1. 根據 `ProductModel` 的 `allowedPlanConversions` 規則，請求被拒絕。<br>2. 返回 4xx 錯誤。 |
| **TC-CHG-006** | 在有待處理的下期生效轉換時，再次請求轉換 | 1. 系統應拒絕新的轉換請求，或提供取消前次變更的選項。 |

## 5. 優惠計算流程 (Promotion & Discount)

| 案例 ID | 測試情境 | 預期結果 |
| :--- | :--- | :--- |
| **TC-PROMO-001** | 扣款時套用**階段式優惠** (如：第三期半價) | 1. 當 `billingCycleCount` 符合優惠條件時，`actualAmount` 應為折扣後的金額。 |
| **TC-PROMO-002** | 扣款時套用有效的**優惠碼** | 1. `actualAmount` 為優惠碼折扣後的金額。<br>2. `SubscriptionPromotionModel` 記錄該次優惠使用。 |
| **TC-PROMO-003** | 使用一個已過期或無效的優惠碼 | 1. 綁定優惠碼時或計算金額時，系統應驗證失敗並返回錯誤。<br>2. 扣款金額應為原價。 |
| **TC-PROMO-004** | 扣款時同時符合多種優惠 (階段、優惠碼) | 1. 系統根據優惠組合規則 (例如：不可疊加，則優選取)，計算出最終的 `actualAmount`。 |
| **TC-PROMO-005** | 優惠碼有使用次數限制 | 1. 當優惠碼的 `usedCount` 達到 `usageLimit` 後，其他用戶無法再使用。<br>2. `PromotionModel` 的 `isActive` 可能會變為 `false`。 |
| **TC-PROMO-006** | 促銷期優惠 | 1. 在促銷期間 (`startDate` 到 `endDate`) 的所有扣款都應享有折扣。<br>2. 促銷期結束後，扣款恢復原價。 |

## 6. 退款處理流程 (Refund Processing)

| 案例 ID | 測試情境 | 預期結果 |
| :--- | :--- | :--- |
| **TC-REFUND-001** | 用戶為最近一筆交易申請**全額退款** | 1. `RefundModel` 成功創建，狀態從 `PENDING` 變為 `COMPLETED`。<br>2. `PurchaseHistoryModel` 中對應的交易記錄狀態更新為 `REFUNDED`。<br>3. 根據業務規則，`SubscriptionModel` 的狀態可能變為 `CANCELLED` 或 `serviceEndDate` 被調整。 |
| **TC-REFUND-002** | 為一筆不存在或不符合退款條件的交易申請退款 | 1. 請求被拒絕，返回明確的錯誤訊息。<br>2. 資料庫中不應創建任何 `RefundModel` 記錄。 |

## 7. 特殊日期與極值測試 (Special Dates & Edge Cases)

| 案例 ID | 測試情境 | 預期結果 |
| :--- | :--- | :--- |
| **TC-DATE-001** | **閏年處理**：在 2 月 29 日訂閱的月費方案 | 1. 在非閏年，下次扣款日應為 2 月 28 日。<br>2. 在下一個閏年，下次扣款日應恢復為 2 月 29 日。 |
| **TC-DATE-002** | **大小月處理**：在 1 月 31 日訂閱的月費方案 | 1. 下次扣款日應為 2 月 28 日 (或 29 日)。<br>2. 再下一次扣款日應恢復為 3 月 31 日。 |
| **TC-EDGE-001** | **價格為 0** 的免費方案 | 1. 訂閱成功創建，狀態為 `ACTIVE`。<br>2. `PurchaseHistoryModel` 創建 `actualAmount` 為 0 的記錄，狀態為 `COMPLETED`。<br>3. 不會觸發實際的支付閘道扣款。<br>4. `nextBillingDate` 正常設定。 |
| **TC-EDGE-002** | **重試間隔設為 0** | 1. 當發生可重試的失敗時，系統應幾乎立即觸發下一次重試，無明顯延遲。 |
| **TC-EDGE-003** | **寬限期設為 0** (`graceExtensionDays` = 0) | 1. 當重試次數耗盡後，即使 `maxGraceExtensions` > 0，服務到期日 `serviceEndDate` 也不會被延長。<br>2. 訂閱會立即進入失效狀態。 |
