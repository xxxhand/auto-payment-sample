# 支付失敗與重試流程（測試指引）

本文件說明此次改動的重點、使用方式，以及如何在本地執行對應的測試，並列出常見注意事項。

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

## 相關檔案

- 服務層
  - `src/domain/services/payment.service.ts`
  - `src/domain/services/payment-processing.service.ts`
  - `src/domain/services/billing.service.ts`
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

- 抽出失敗類別 mapping 的共用工具，避免 `PaymentService` 與 `PaymentProcessingService` 行為重疊。
- 增補成功支付的 e2e，涵蓋從 `GRACE/RETRY/PAST_DUE` 回到 `ACTIVE` 的 metadata 守門條件。
