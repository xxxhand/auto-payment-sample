# Promotion Engine

目的
- 提供單一入口管理「優惠碼/優惠活動」的驗證、挑選與套用。
- 對齊 REQUIREMENTS.md 主題：優惠與方案（僅能套用一種優惠；優惠期結束後自動查找其他可用優惠）。

職責
- validateCode：驗證優惠碼的有效性與資格（產品/方案/新客/時效/使用次數）。
- listAvailable：列出可用的（含檔期）優惠，並提供不可用原因（可選）。
- selectBest：在候選清單中依優先級與實際節省金額決策最佳優惠（穩定決策規則）。
- applyToSubscription：將優惠套用到訂閱，寫入使用紀錄（鎖定一次性/每用戶唯一）。
- Re-evaluate hooks：在「方案變更」「週期結束」時重新評估優惠。

決策規則（排序）
1) Priority desc（數字大者優先）
2) Savings desc（以當前金額計算折抵）
3) Tie-break：建立時間 asc → id asc（穩定）

核心流程
- 訂閱建立：
  - 帶碼：validateCode 成功 → applyToSubscription；失敗 → 回傳原因。
  - 無碼：listAvailable → selectBest → applyToSubscription（若無可用則不套用）。
- 週期結束：
  - cyclesRemaining > 0 → 承接；= 0 → listAvailable → selectBest；若無則恢復原價。
- 方案變更：
  - 驗證現有優惠範圍仍適用，否則重新挑選。

併發與冪等
- 單碼一次性：以唯一鍵 code 唯一使用；以交易更新使用紀錄。
- 批次碼/每用戶限用：唯一鍵 (promotionId, customerId)。
- Idempotency-Key：apply 操作需支援重試安全。

資料欄位對齊
- Promotion：id、type、priority、scope(productIds/planIds)、discount、period(startAt/endAt)、eligibility、新增 usage（global/perCustomer）、status。
- SubscriptionAppliedPromotion：promotionId、code?、cyclesApplied、cyclesRemaining、pricingSnapshot。

API 契約（摘要）
- POST /api/v1/promotions/validate：回傳 isValid、reasons、promotion 摘要、discount、validPeriod、usage。
- GET /api/v1/promotions/available：以 priority→savings 排序，支援 includeIneligible。

觀測性
- 決策軌跡（選擇過程、排除原因）。
- 指標：驗證成功率、平均折抵、Top promotions。

落地分期
- Phase 1：資料模型、Engine 骨架、API 契約文件。
- Phase 2：策略/計算器/Eligibility 完整化 + Repo + 交易。
- Phase 3：整合訂閱流程與事件。
