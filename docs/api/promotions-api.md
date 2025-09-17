# Promotions API

Base Path: /api/v1/promotions

1. Validate Promotion Code
- POST /api/v1/promotions/validate
- Request
  {
    "promotionCode": "WELCOME2025",
    "productId": "prod_xxx",
    "planId": "plan_monthly",
    "orderAmount": 999
  }
  - customerId 由 JWT 取得
- Response
  {
    "traceId": "...",
    "code": 200,
    "message": "Promotion code validated",
    "result": {
      "isValid": true,
      "reasons": [],
      "promotion": {
        "id": "prom_123",
        "code": "WELCOME2025",
        "name": "新戶歡迎",
        "priority": 100,
        "type": "CODE"
      },
      "discount": {
        "type": "FIXED_AMOUNT",
        "value": 100,
        "currency": "TWD",
        "maxCycles": 1
      },
      "validPeriod": { "startAt": "2025-01-01T00:00:00Z", "endAt": "2025-12-31T23:59:59Z" },
      "usage": { "remainingForCustomer": 1, "globalRemaining": null }
    }
  }

2. List Available Promotions
- GET /api/v1/promotions/available?productId=prod_xxx&planId=plan_monthly&includeIneligible=false
- Response
  {
    "traceId": "...",
    "code": 200,
    "message": "Success",
    "result": {
      "promotions": [
        {
          "isValid": true,
          "reasons": [],
          "promotion": { "id": "prom_anniv", "code": null, "name": "周年慶", "priority": 90, "type": "CAMPAIGN" },
          "discount": { "type": "PERCENTAGE", "value": 20, "maxCycles": 1 },
          "validPeriod": { "startAt": "2025-09-01T00:00:00Z", "endAt": "2025-09-30T23:59:59Z" },
          "usage": { "remainingForCustomer": 1, "globalRemaining": null }
        }
      ]
    }
  }

錯誤碼（對齊全域）
- PROMOTION_CODE_INVALID
- PROMOTION_EXPIRED
- PROMOTION_ALREADY_USED
- PROMOTION_NOT_ELIGIBLE
- PROMOTION_NOT_APPLICABLE_TO_PLAN

排序與選擇規則
- 優先級 desc → 節省金額 desc → ID 升冪（穩定）。

備註
- 僅能套用一種優惠；期滿自動重新挑選。
- 幣別與金額使用最小單位；四捨五入。
