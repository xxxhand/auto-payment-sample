# ADR: Promotion Engine Redesign

Date: 2025-09-16

Context
- 優惠碼/優惠邏輯在多處分散（Controller 模擬、Service、Stacking Engine），文件與實作不一致。
- 需求：僅能套用一種優惠，期滿可自動尋找其他可用優惠，需支援優先級/實際節省排序與冪等。

Decision
- 引入 PromotionEngine 作為單一入口，負責 validateCode / listAvailable / selectBest / applyToSubscription。
- 定義統一資料模型（Promotion、SubscriptionAppliedPromotion、DiscountType、PromotionType、Status）。
- API 契約調整：/promotions/validate 與 /promotions/available 回傳統一結果格式，包含不可用原因（reasons）。
- 不支援優惠堆疊（stacking）於訂單層，堆疊僅作為內部評估工具，最終只選一個。
- 以 idempotency + 唯一鍵確保單碼一次性與每用戶限用一致性（Phase 2 落地）。

Consequences
- 控制器薄化，實際規則集中在 Engine 與策略。
- 需補資料層與交易以保證一致性（Phase 2）。
- 文件、測試與範例需調整至 2025 年有效期樣本。

Status
- Accepted（Phase 1 完成骨架與文件）。
