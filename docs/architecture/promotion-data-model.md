# Promotion Data Model

Entities
- Promotion
  - id, name, type (CODE|CAMPAIGN|INTRO), priority
  - scope: productIds[], planIds[]
  - discount: type(FIXED_AMOUNT|PERCENTAGE|FREE_CYCLES), value, currency?, maxCycles?
  - period: startAt, endAt
  - eligibility: newCustomerOnly?, minOrderAmount?, regions?, customerSegments?
  - usage: globalLimit?, perCustomerLimit?
  - status: DRAFT|ACTIVE|PAUSED|EXPIRED
  - code?: 僅限 type=CODE
  - metadata: 任意補充欄位

- SubscriptionAppliedPromotion
  - promotionId, code?, cyclesApplied, cyclesRemaining
  - appliedAt, pricingSnapshot { baseAmount, discountAmount, finalAmount, currency }

- Usage Tracking (logical)
  - 全域限額：promotion.usage.globalLimit
  - 每用戶限額：promotion.usage.perCustomerLimit（常見 1）

Key Rules
- 單一優惠原則：同一訂單/帳單周期僅能套用一個 Promotion。
- 節省金額計算：
  - FIXED_AMOUNT: discount = min(value, price)
  - PERCENTAGE: discount = round(price * value / 100)
  - FREE_CYCLES: 該周期金額為 0，cyclesRemaining 減 1
- 排序：priority desc → savings desc → id asc

Consistency & Concurrency
- 唯一鍵：
  - 單碼一次性：code 唯一使用
  - 批次碼每用戶一次：unique(promotionId, customerId)
- 套用操作需以交易保護；支援 Idempotency-Key

Mapping to Code
- src/domain/enums/promotion.enums.ts：枚舉定義
- src/domain/value-objects/promotion.model.ts：介面定義
- src/domain/services/promotion-engine.service.ts：Engine 骨架
