# 支付失敗與重試流程（測試指引）

本文件說明此次改動的重點、使用方式，以及如何在本地執行對應的測試，並列出常見注意事項。

## 整合總覽（Rules Engine ↔ Services）

- 前置計費決策：BillingService 在每次扣款前呼叫 BillingRulesEngine.evaluateBillingDecision，若規則阻擋（如風險分群、黑名單、冷卻期），則跳過本輪扣款。
- 支付處理：PaymentService.processPaymentWithRetry → PaymentProcessingService.processPayment → PaymentGatewayManager（實/模擬）。
  - 失敗類別由共用 util 推導：src/domain/utils/payment-failure.util.ts。
  - 決定「是否重試、下一次時間、最大次數、策略」由 RetryStrategyEngine.evaluateRetryDecision 規則驅動。
- 成功路徑：BillingService.handlePaymentSuccess 會委派 SubscriptionService.recordSuccessfulBilling 進行帳期推進與（首次成功）啟用訂閱；完整地經由 SubscriptionService 串好日期邏輯。
- 失敗路徑：BillingService.handlePaymentFailure 依 RetryStrategyEngine 決策進入 RETRY（含 nextRetryDate），否則先進 GRACE，再轉 PAST_DUE，並利用狀態機 metadata 作為守門條件（paymentFailed/paymentResolved）。

## 這次的主要變更

- PaymentService 切換至實際處理器
  - `PaymentService.processPaymentWithRetry` 不再使用模擬邏輯，改為呼叫 `PaymentProcessingService.processPayment`（串接 `PaymentGatewayManager`）。
  - 失敗時會根據 gateway 的回傳（errorCode/status）判斷 `failureCategory`，並將 `failureDetails` 寫回 `PaymentEntity`（含 `category` 與 `isRetriable`）。
  - 仍由 `RetryStrategyEngine` 決策是否重試、最大次數與延遲；若決策不重試或已達上限，將最終失敗狀態落盤。

- 計費服務失敗路徑的狀態轉換
  - `BillingService.handlePaymentFailure`：
    - 若可重試且有下一次時間：`subscription.enterRetryState(nextRetryDate)`，狀態 → `RETRY`，並帶出 `nextRetryDate`。
    - 若不可重試：先 `enterGracePeriod`（`metadata.paymentFailed=true`），再轉為 `PAST_DUE`（符合狀態機規則）。

- 狀態機守門條件（重要）
  - 從 `PENDING` → `ACTIVE`：需要 `metadata.paymentSuccessful: true`。
  - 從 `GRACE/RETRY/PAST_DUE` → `ACTIVE`：需要 `metadata.paymentResolved: true`。

## 失敗類別對照與來源（Single Source of Truth）

共用工具：`src/domain/utils/payment-failure.util.ts`

- 來源一：Gateway 狀態/錯誤碼 → mapFailureCategoryFromGateway(status, errorCode)
  - RETRIABLE：`GATEWAY_TIMEOUT`、`NETWORK_ERROR`、`TIMEOUT`、`SERVICE_UNAVAILABLE`，或 status 在 `TIMEOUT/NETWORK_ERROR/SERVICE_UNAVAILABLE/PROCESSING/PENDING`
  - DELAYED_RETRY：`INSUFFICIENT_FUNDS`、`DAILY_LIMIT_EXCEEDED`、`TEMPORARILY_UNAVAILABLE`
  - NON_RETRIABLE：`CARD_DECLINED`、`DO_NOT_HONOR`、`STOLEN_CARD`、`LOST_CARD`、`INVALID_CARD`、`INVALID_REQUEST`、`FRAUD_SUSPECTED`、或 status `FAILED`
- 來源二：文字訊息 → mapFailureCategoryFromMessage(message)
  - `timeout`/`network` → RETRIABLE
  - `insufficient funds`/`balance` → DELAYED_RETRY
  - `declined`/`invalid`/`fraud` → NON_RETRIABLE
- 判定可重試：isCategoryRetriable(category)（RETRIABLE、DELAYED_RETRY）

建議：所有服務以此 util 為單一事實來源；目前 PaymentService 與 PaymentProcessingService 已全面使用。

## 重試策略矩陣（預設 + 可被規則覆蓋）

由 RetryStrategyEngine 管理預設策略並可被規則覆蓋（RuleRegistry）。

- RETRIABLE（預設 LINEAR）
  - maxRetries: 3；baseDelayMinutes: 5；maxDelayMinutes: 30
- DELAYED_RETRY（預設 EXPONENTIAL_BACKOFF）
  - maxRetries: 5；baseDelayMinutes: 60；maxDelayMinutes: 2880；multiplier: 2
- NON_RETRIABLE（NONE）
  - maxRetries: 0；不重試

規則範例（已內建）：
- 高額支付且多次失敗 → 立即升級（FORCE_NO_RETRY, IMMEDIATE_ESCALATION）
- 高級客戶 → 延長上限（EXTEND_RETRY_LIMIT newMaxRetries: 7）

## 相關檔案

- 服務層
  - `src/domain/services/payment.service.ts`
  - `src/domain/services/payment-processing.service.ts`
  - `src/domain/services/billing.service.ts`
- 共用工具（失敗類別 mapping）
  - `src/domain/utils/payment-failure.util.ts`（`mapFailureCategoryFromGateway`、`mapFailureCategoryFromMessage`、`isCategoryRetriable`）
  - 服務已改為以此工具為單一事實來源（避免重複邏輯）。
- 實體與狀態機
  - `src/domain/entities/payment.entity.ts`
  - `src/domain/entities/subscription.entity.ts`
  - `src/domain/value-objects/state-machine.ts`
- 測試
  - `test/payment-processing-mapping.e2e-spec.ts`
  - `test/billing-retry-flow.e2e-spec.ts`

## 如何執行測試

- 全部單元測試（建議序列化執行，易除錯）

```sh
# macOS / zsh
yarn test --runInBand
```

- 僅執行 e2e-lite：支付失敗 mapping 與完整鏈路（使用 e2e 設定）

```sh
# 使用 e2e 設定檔，並以正確引號避免 zsh 對括號/正規表達式做 glob 展開
yarn jest --config ./test/jest-e2e.json --runInBand --passWithNoTests --testPathPattern 'test/(payment-processing-mapping|billing-retry-flow)\.e2e-spec\.ts'
```

- 或直接指定檔名（亦需 e2e 設定）：

```sh
yarn jest --config ./test/jest-e2e.json --runInBand --passWithNoTests test/payment-processing-mapping.e2e-spec.ts test/billing-retry-flow.e2e-spec.ts
```

注意：專案根 `package.json` 的預設 Jest 設定（`jest` 欄位）只會撈 `.*\.spec\.ts`，不會抓 `*.e2e-spec.ts`，因此執行 e2e 測試務必帶上 `--config ./test/jest-e2e.json`。

## 觀測與除錯建議

- 建議在以下點位加入結構化 log：
  - PaymentProcessingService.processPayment：status、errorCode、mapped failureCategory、isRetriable、processingTime
  - PaymentService.processPaymentWithRetry：attemptNumber、engine 決策（shouldRetry/maxRetries/nextRetryDate/retryStrategy）、寫回的 retryState
  - BillingService.handlePaymentSuccess/Failure：導致的訂閱狀態轉換與 metadata（paymentSuccessful/paymentFailed/paymentResolved）
- 排查技巧：
  - 若 e2e 看到「GRACE → ACTIVE」無法轉換，檢查是否有 `metadata.paymentResolved: true`。
  - 若「第一筆成功要啟用」沒生效，檢查 `BillingService.handlePaymentSuccess` 是否有走 SubscriptionService 的成功路徑（first-success-activates）。
  - zsh 正規表達式要記得用單引號包住參數（避免 bad pattern）。

## 測試注意事項

- zsh 正規表達式要加引號
  - 避免 `zsh: bad pattern`，請用單引號包住 `--testPathPattern` 的 regex。

- 可能出現的日誌
  - 在 `test/billing-retry-flow.e2e-spec.ts` 中，如未先設定 gateway 預設 mock 回傳，`PaymentProcessingService` 可能會記錄錯誤日誌（如「Cannot read properties of undefined (reading 'success')」）。這是因為測試替身尚未提供回傳值就先被呼叫一次。若要消音，可於測試中先設置 gateway 的預設回傳。

- 狀態機守門條件（再次提醒）
  - 建立訂閱後要啟用：`sub.activate({ metadata: { paymentSuccessful: true } })`。
  - 支付問題排除後回到 ACTIVE：`sub.transitionToStatus(ACTIVE, { metadata: { paymentResolved: true } })`（或透過服務層統一進入成功路徑）。

- DI 小提醒
  - `PaymentService` 與 `PaymentProcessingService` 之間存在相依性循環，已用 `forwardRef` 處理；若在測試自組 DI，記得 stub 出相依服務或用 Nest `TestingModule` 提供替身。

## 驗收點（快速檢核）

- 卡片被拒（`CARD_DECLINED`）→ `NON_RETRIABLE`，不重試，訂閱進 `PAST_DUE` 並具備寬限時間。
- 餘額不足（`INSUFFICIENT_FUNDS`）→ `DELAYED_RETRY`，允許延後重試。
- 閘道逾時（`GATEWAY_TIMEOUT`）→ `RETRIABLE`，進入 `RETRY` 並帶有 `nextRetryDate`。

## 後續建議（本次先略過優化）

- 已完成：抽出失敗類別 mapping 共用工具，`PaymentService` 與 `PaymentProcessingService` 已統一使用；並補上輕量單元測試。
- 建議：再補成功支付的 e2e，涵蓋從 `GRACE/RETRY/PAST_DUE` 回到 `ACTIVE` 的 metadata 守門條件（現有單元測試已涵蓋，e2e 可做回歸驗證）。

## 持久化注意事項（已知缺口）

- 目前 `Infra` 的 `IPaymentModel`/`PaymentRepository` 尚未持久化 `PaymentEntity.failureDetails` 與 `PaymentEntity.retryState`。
  - 單元測試使用 InMemory Repository 驗證了服務層會寫入這兩個欄位，但正式 Mongo 模組未保存它們。
  - 影響：在實際資料庫查詢時，無法直接讀到最近一次的 `failureCategory`、`nextRetryAt` 等欄位。

建議後續小 PR（目前暫緩 PaymentRepository 持久化測試）：
- 擴充 `src/infra/models/payment.model.ts`：
  - 新增 `failureDetails?: { errorCode?: string; errorMessage?: string; category: number; isRetriable: boolean; failedAt: Date; metadata?: Record<string, any>; }`
  - 新增 `retryState?: { attemptNumber: number; maxRetries: number; nextRetryAt?: Date; lastFailureReason?: string; failureCategory?: number; retryStrategy: string; }`
- 調整 `PaymentRepository.save(...)` 的 insert/update `$set` 與 `documentToEntity(...)` 對應。
- 若有既有資料：提供一次性 migration 腳本（可先略，採 backward compatible optional 欄位）。
- 驗收：
  - 單元測試：儲存後 findById 能讀回 `failureDetails.category` 與 `retryState.nextRetryAt`（repository 測試解開再跑）。
  - e2e-lite：在支付失敗後查詢付款單，能看到對應的 retry 寫回欄位。
