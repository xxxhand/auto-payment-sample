# 訂閱管理 API 設計 (Subscription Management API)

## 1. API 設計原則

### 1.1 RESTful 設計準則
- **資源導向**：以業務實體為 API 資源設計核心
- **HTTP 方法語義**：正確使用 GET, POST, PUT, PATCH, DELETE
- **統一介面**：一致的請求/回應格式和錯誤處理
- **無狀態性**：每個請求都包含完整的資訊

### 1.2 API 版本策略
- **URL 版本控制**：`/api/v1/subscriptions`
- **向後相容**：新版本保持向後相容性
- **棄用通知**：提前通知 API 棄用時程

### 1.3 安全性原則
- **JWT 認證**：使用 Bearer Token 進行身份驗證
- **權限控制**：基於角色的存取控制 (RBAC)
- **輸入驗證**：嚴格的請求資料驗證
- **速率限制**：防止 API 濫用

### 1.4 統一回應格式

所有 API 回應都遵循以下統一格式：

```typescript
interface IResponse<T = any> {
  traceId: string;    // 請求追蹤 ID
  code: number;       // 業務狀態碼 (200: 成功, 其他: 錯誤)
  message: string;    // 回應訊息
  result?: T;         // 回應資料 (成功時)
}
```

**成功回應範例**：
```json
{
  "traceId": "trace_1234567890abcdef",
  "code": 200,
  "message": "Success",
  "result": {
    // 具體業務資料
  }
}
```

**錯誤回應範例**：
```json
{
  "traceId": "trace_1234567890abcdef",
  "code": 4001,
  "message": "Subscription not found"
}
```

## 2. 核心 API 端點設計

### 2.1 訂閱管理 API

#### 2.1.1 創建訂閱

```http
POST /api/v1/subscriptions
Content-Type: application/json
Authorization: Bearer <token>

{
  "productId": "64f5c8e5a1b2c3d4e5f67890",
  "planId": "64f5c8e5a1b2c3d4e5f67891",
  "paymentMethodId": "64f5c8e5a1b2c3d4e5f67892",
  "promotionCode": "WELCOME2024",
  "startDate": "2024-01-01T00:00:00Z",
  "billingAddress": {
    "country": "TW",
    "city": "Taipei",
    "postalCode": "10001"
  }
}
```

**回應**：
```json
{
  "traceId": "trace_1234567890abcdef",
  "code": 200,
  "message": "Subscription created successfully",
  "result": {
    "subscriptionId": "sub_1234567890",
    "status": "ACTIVE",
    "productId": "64f5c8e5a1b2c3d4e5f67890",
    "planId": "64f5c8e5a1b2c3d4e5f67891",
    "currentPeriod": {
      "startDate": "2024-01-01T00:00:00Z",
      "endDate": "2024-02-01T00:00:00Z",
      "nextBillingDate": "2024-02-01T00:00:00Z"
    },
    "pricing": {
      "baseAmount": 999,
      "discountAmount": 100,
      "finalAmount": 899,
      "currency": "TWD"
    },
    "appliedPromotions": [
      {
        "promotionId": "64f5c8e5a1b2c3d4e5f67893",
        "promotionCode": "WELCOME2024",
        "discountAmount": 100
      }
    ],
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

#### 2.1.2 查詢訂閱列表

```http
GET /api/v1/subscriptions?status=ACTIVE&page=1&limit=20&sort=-createdAt
Authorization: Bearer <token>
```

**回應**：
```json
{
  "traceId": "trace_1234567890abcdef",
  "code": 200,
  "message": "Success",
  "result": {
    "subscriptions": [
      {
        "subscriptionId": "sub_1234567890",
        "status": "ACTIVE",
        "product": {
          "productId": "64f5c8e5a1b2c3d4e5f67890",
          "productName": "Premium Plan",
          "displayName": "高級方案"
        },
        "plan": {
          "planId": "64f5c8e5a1b2c3d4e5f67891",
          "planName": "Monthly Premium",
          "pricing": {
            "amount": 999,
            "currency": "TWD"
          }
        },
        "currentPeriod": {
          "nextBillingDate": "2024-02-01T00:00:00Z"
        },
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 98,
      "itemsPerPage": 20,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

#### 2.1.3 查詢單一訂閱詳情

```http
GET /api/v1/subscriptions/{subscriptionId}
Authorization: Bearer <token>
```

**回應**：
```json
{
  "traceId": "trace_1234567890abcdef",
  "code": 200,
  "message": "Success",
  "result": {
    "subscriptionId": "sub_1234567890",
    "status": "ACTIVE",
    "product": {
      "productId": "64f5c8e5a1b2c3d4e5f67890",
      "productName": "Premium Plan",
      "displayName": "高級方案",
      "description": "完整功能的高級訂閱方案"
    },
    "plan": {
      "planId": "64f5c8e5a1b2c3d4e5f67891",
      "planName": "Monthly Premium",
      "billingCycle": {
        "type": "MONTHLY",
        "intervalDays": 30
      },
      "pricing": {
        "amount": 999,
        "currency": "TWD"
      }
    },
    "currentPeriod": {
      "startDate": "2024-01-01T00:00:00Z",
      "endDate": "2024-02-01T00:00:00Z",
      "nextBillingDate": "2024-02-01T00:00:00Z",
      "cycleNumber": 1
    },
    "paymentHistory": [
      {
        "paymentId": "pay_1234567890",
        "amount": 899,
        "status": "COMPLETED",
        "paidAt": "2024-01-01T00:00:00Z"
      }
    ],
    "statusHistory": [
      {
        "status": "ACTIVE",
        "changedAt": "2024-01-01T00:00:00Z",
        "triggeredBy": "SYSTEM"
      }
    ],
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

#### 2.1.4 方案變更

```http
POST /api/v1/subscriptions/{subscriptionId}/plan-change
Content-Type: application/json
Authorization: Bearer <token>

{
  "targetPlanId": "64f5c8e5a1b2c3d4e5f67894",
  "changeType": "IMMEDIATE", // or "NEXT_CYCLE"
  "reason": "User requested upgrade",
  "prorationMode": "CREATE_PRORATION" // or "NONE"
}
```

**回應**：
```json
{
  "traceId": "trace_1234567890abcdef",
  "code": 200,
  "message": "Plan change completed successfully",
  "result": {
    "planChangeId": "pc_1234567890",
    "subscriptionId": "sub_1234567890",
    "fromPlan": {
      "planId": "64f5c8e5a1b2c3d4e5f67891",
      "planName": "Monthly Premium"
    },
    "toPlan": {
      "planId": "64f5c8e5a1b2c3d4e5f67894",
      "planName": "Monthly Professional"
    },
    "changeType": "IMMEDIATE",
    "status": "COMPLETED",
    "proration": {
      "creditAmount": 300,
      "chargeAmount": 500,
      "netAmount": 200
    },
    "effectiveAt": "2024-01-15T00:00:00Z",
    "createdAt": "2024-01-15T00:00:00Z"
  }
}
```

#### 2.1.5 暫停/恢復訂閱

```http
POST /api/v1/subscriptions/{subscriptionId}/pause
Content-Type: application/json
Authorization: Bearer <token>

{
  "reason": "Temporary suspension requested by user",
  "resumeDate": "2024-03-01T00:00:00Z"
}
```

```http
POST /api/v1/subscriptions/{subscriptionId}/resume
Authorization: Bearer <token>
```

#### 2.1.6 取消訂閱

```http
POST /api/v1/subscriptions/{subscriptionId}/cancel
Content-Type: application/json
Authorization: Bearer <token>

{
  "reason": "User no longer needs the service",
  "cancelImmediately": false, // 立即取消或期末取消
  "requestRefund": true
}
```

### 2.2 產品與方案 API

#### 2.2.1 查詢產品列表

```http
GET /api/v1/products?includeInactive=false
```

**回應**：
```json
{
  "traceId": "trace_1234567890abcdef",
  "code": 200,
  "message": "Success",
  "result": {
    "products": [
      {
        "productId": "64f5c8e5a1b2c3d4e5f67890",
        "productName": "Premium Plan",
        "displayName": "高級方案",
        "description": "完整功能的高級訂閱方案",
        "billingPlans": [
          {
            "planId": "64f5c8e5a1b2c3d4e5f67891",
            "planName": "Monthly Premium",
            "displayName": "月繳高級方案",
            "pricing": {
              "amount": 999,
              "currency": "TWD"
            },
            "billingCycle": {
              "type": "MONTHLY"
            },
            "features": ["feature1", "feature2", "feature3"]
          }
        ],
        "isActive": true
      }
    ]
  }
}
```

#### 2.2.2 查詢方案轉換選項

```http
GET /api/v1/subscriptions/{subscriptionId}/plan-change-options
Authorization: Bearer <token>
```

**回應**：
```json
{
  "traceId": "trace_1234567890abcdef",
  "code": 200,
  "message": "Success",
  "result": {
    "currentPlan": {
      "planId": "64f5c8e5a1b2c3d4e5f67891",
      "planName": "Monthly Premium"
    },
    "availableChanges": [
      {
        "targetPlan": {
          "planId": "64f5c8e5a1b2c3d4e5f67894",
          "planName": "Monthly Professional",
          "pricing": {
            "amount": 1499,
            "currency": "TWD"
          }
        },
        "changeType": ["IMMEDIATE", "NEXT_CYCLE"],
        "proration": {
          "creditAmount": 300,
          "chargeAmount": 500,
          "netAmount": 200
        }
      }
    ]
  }
}
```

### 2.3 優惠管理 API

#### 2.3.1 驗證優惠碼

```http
POST /api/v1/promotions/validate
Content-Type: application/json
Authorization: Bearer <token>

{
  "promotionCode": "WELCOME2024",
  "productId": "64f5c8e5a1b2c3d4e5f67890",
  "planId": "64f5c8e5a1b2c3d4e5f67891"
}
```

**回應**：
```json
{
  "traceId": "trace_1234567890abcdef",
  "code": 200,
  "message": "Promotion code validated successfully",
  "result": {
    "promotionId": "64f5c8e5a1b2c3d4e5f67893",
    "promotionCode": "WELCOME2024",
    "promotionName": "新用戶歡迎優惠",
    "isValid": true,
    "discount": {
      "discountType": "FIXED_AMOUNT",
      "discountValue": 100,
      "currency": "TWD"
    },
    "validPeriod": {
      "startDate": "2024-01-01T00:00:00Z",
      "endDate": "2024-12-31T23:59:59Z"
    },
    "usageInfo": {
      "remainingUses": 1,
      "canUse": true
    }
  }
}
```

#### 2.3.2 查詢可用優惠

```http
GET /api/v1/promotions/available?productId=64f5c8e5a1b2c3d4e5f67890&planId=64f5c8e5a1b2c3d4e5f67891
Authorization: Bearer <token>
```

### 2.4 支付管理 API

#### 2.4.1 查詢支付歷史

```http
GET /api/v1/subscriptions/{subscriptionId}/payments?page=1&limit=10&status=COMPLETED
Authorization: Bearer <token>
```

**回應**：
```json
{
  "traceId": "trace_1234567890abcdef",
  "code": 200,
  "message": "Success",
  "result": {
    "payments": [
      {
        "paymentId": "pay_1234567890",
        "subscriptionId": "sub_1234567890",
        "amount": {
          "original": 999,
          "discount": 100,
          "final": 899,
          "currency": "TWD"
        },
        "status": "COMPLETED",
        "billingCycle": {
          "cycleNumber": 1,
          "periodStart": "2024-01-01T00:00:00Z",
          "periodEnd": "2024-02-01T00:00:00Z"
        },
        "paymentMethod": {
          "type": "CREDIT_CARD",
          "displayName": "**** 1234",
          "provider": "stripe"
        },
        "processedAt": "2024-01-01T00:00:00Z",
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 25,
      "itemsPerPage": 10
    }
  }
}
```

#### 2.4.2 重試失敗的支付

```http
POST /api/v1/payments/{paymentId}/retry
Content-Type: application/json
Authorization: Bearer <token>

{
  "paymentMethodId": "64f5c8e5a1b2c3d4e5f67892"
}
```

#### 2.4.3 手動補款

```http
POST /api/v1/subscriptions/{subscriptionId}/manual-payment
Content-Type: application/json
Authorization: Bearer <token>

{
  "amount": 899,
  "currency": "TWD",
  "paymentMethodId": "64f5c8e5a1b2c3d4e5f67892",
  "reason": "Manual payment for failed billing cycle"
}
```

### 2.5 退款管理 API

#### 2.5.1 申請退款

```http
POST /api/v1/subscriptions/{subscriptionId}/refund
Content-Type: application/json
Authorization: Bearer <token>

{
  "paymentId": "pay_1234567890",
  "refundType": "FULL", // FULL, PARTIAL, PRORATED
  "refundAmount": 899,
  "reason": "Service not satisfactory"
}
```

**回應**：
```json
{
  "traceId": "trace_1234567890abcdef",
  "code": 200,
  "message": "Refund request submitted successfully",
  "result": {
    "refundId": "ref_1234567890",
    "subscriptionId": "sub_1234567890",
    "paymentId": "pay_1234567890",
    "refundAmount": {
      "amount": 899,
      "currency": "TWD"
    },
    "refundType": "FULL",
    "status": "REQUESTED",
    "estimatedProcessingTime": "3-5 business days",
    "createdAt": "2024-01-15T00:00:00Z"
  }
}
```

#### 2.5.2 查詢退款狀態

```http
GET /api/v1/refunds/{refundId}
Authorization: Bearer <token>
```

### 2.6 帳戶管理 API

#### 2.6.1 查詢帳戶資訊

```http
GET /api/v1/account/profile
Authorization: Bearer <token>
```

#### 2.6.2 支付方式管理

```http
GET /api/v1/account/payment-methods
POST /api/v1/account/payment-methods
PUT /api/v1/account/payment-methods/{paymentMethodId}
DELETE /api/v1/account/payment-methods/{paymentMethodId}
Authorization: Bearer <token>
```

## 3. 錯誤處理與回應格式

### 3.1 統一錯誤格式

```json
{
  "traceId": "trace_1234567890abcdef",
  "code": 4001,
  "message": "The specified subscription was not found"
}
```

### 3.2 HTTP 狀態碼與業務錯誤碼對應

| HTTP Status | 業務錯誤碼範圍 | 使用情境 | 錯誤代碼範例 |
|-------------|---------------|----------|--------------|
| 200 OK | 200 | 成功處理請求 | 200 |
| 201 Created | 200 | 成功創建資源 | 200 |
| 400 Bad Request | 4000-4099 | 請求參數錯誤 | 4001: INVALID_PARAMETER |
| 401 Unauthorized | 4100-4199 | 身份驗證失敗 | 4101: AUTHENTICATION_FAILED |
| 403 Forbidden | 4200-4299 | 權限不足 | 4201: ACCESS_DENIED |
| 404 Not Found | 4300-4399 | 資源不存在 | 4301: SUBSCRIPTION_NOT_FOUND |
| 409 Conflict | 4400-4499 | 資源狀態衝突 | 4401: SUBSCRIPTION_ALREADY_CANCELED |
| 422 Unprocessable Entity | 4500-4599 | 業務邏輯錯誤 | 4501: PLAN_CHANGE_NOT_ALLOWED |
| 429 Too Many Requests | 4600-4699 | 速率限制 | 4601: RATE_LIMIT_EXCEEDED |
| 500 Internal Server Error | 5000-5999 | 系統錯誤 | 5001: INTERNAL_ERROR |

### 3.3 業務錯誤碼定義

```typescript
export const ERROR_CODES = {
  // 成功
  SUCCESS: {
    code: 200,
    message: 'Success',
    httpStatus: 200
  },
  
  // 訂閱相關 (4300-4399)
  SUBSCRIPTION_NOT_FOUND: {
    code: 4301,
    message: 'Subscription not found',
    httpStatus: 404
  },
  SUBSCRIPTION_ALREADY_CANCELED: {
    code: 4401,
    message: 'Subscription is already canceled',
    httpStatus: 409
  },
  INVALID_SUBSCRIPTION_STATUS: {
    code: 4501,
    message: 'Operation not allowed for current subscription status',
    httpStatus: 422
  },
  
  // 方案相關 (4310-4319)
  PLAN_NOT_FOUND: {
    code: 4311,
    message: 'Billing plan not found',
    httpStatus: 404
  },
  PLAN_CHANGE_NOT_ALLOWED: {
    code: 4511,
    message: 'Plan change is not allowed for this subscription',
    httpStatus: 422
  },
  
  // 支付相關 (4320-4329)
  PAYMENT_METHOD_INVALID: {
    code: 4521,
    message: 'Payment method is invalid or expired',
    httpStatus: 422
  },
  PAYMENT_PROCESSING_FAILED: {
    code: 4522,
    message: 'Payment processing failed',
    httpStatus: 422
  },
  
  // 優惠相關 (4330-4339)
  PROMOTION_CODE_INVALID: {
    code: 4531,
    message: 'Promotion code is invalid or expired',
    httpStatus: 422
  },
  PROMOTION_ALREADY_USED: {
    code: 4532,
    message: 'Promotion code has already been used',
    httpStatus: 422
  }
} as const;
```

## 4. API 安全性設計

### 4.1 身份驗證與授權

```typescript
// JWT Token 結構
interface JWTPayload {
  sub: string;           // 用戶 ID
  email: string;         // 用戶郵箱
  roles: string[];       // 角色列表
  permissions: string[]; // 權限列表
  iat: number;          // 簽發時間
  exp: number;          // 過期時間
  jti: string;          // Token ID
}

// 權限檢查裝飾器
@ApiController('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionController {
  
  @Get(':id')
  @RequirePermissions('subscription:read')
  async getSubscription(@Param('id') id: string) {
    // 實現邏輯
  }
  
  @Post()
  @RequirePermissions('subscription:create')
  async createSubscription(@Body() dto: CreateSubscriptionDto) {
    // 實現邏輯
  }
}
```

### 4.2 速率限制

```typescript
// 速率限制配置
const RATE_LIMITS = {
  GLOBAL: { windowMs: 15 * 60 * 1000, max: 1000 }, // 15分鐘1000次
  AUTH: { windowMs: 15 * 60 * 1000, max: 5 },      // 15分鐘5次登入
  PAYMENT: { windowMs: 60 * 1000, max: 10 },       // 1分鐘10次支付請求
  CREATE_SUBSCRIPTION: { windowMs: 60 * 1000, max: 3 } // 1分鐘3次創建訂閱
};

@RateLimit(RATE_LIMITS.PAYMENT)
@Post('payments')
async processPayment(@Body() dto: PaymentDto) {
  // 支付處理邏輯
}
```

### 4.3 輸入驗證

```typescript
// DTO 驗證範例
export class CreateSubscriptionDto {
  @IsUUID(4)
  @IsNotEmpty()
  productId: string;
  
  @IsUUID(4)
  @IsNotEmpty()
  planId: string;
  
  @IsUUID(4)
  @IsNotEmpty()
  paymentMethodId: string;
  
  @IsOptional()
  @IsString()
  @Length(4, 20)
  promotionCode?: string;
  
  @IsOptional()
  @IsISO8601()
  startDate?: string;
  
  @ValidateNested()
  @Type(() => BillingAddressDto)
  billingAddress: BillingAddressDto;
}
```

## 5. API 監控與可觀測性

### 5.1 API 指標收集

```typescript
// API 指標中介層
@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: Function) {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const route = req.route?.path || req.path;
      const method = req.method;
      const statusCode = res.statusCode;
      
      // 記錄API調用指標
      this.metricsService.recordApiCall({
        route,
        method,
        statusCode,
        duration,
        timestamp: new Date()
      });
    });
    
    next();
  }
}
```

### 5.2 API 日誌格式

```json
{
  "timestamp": "2024-01-15T10:30:00.123Z",
  "level": "info",
  "requestId": "req_abcd1234efgh5678",
  "userId": "usr_1234567890",
  "method": "POST",
  "path": "/api/v1/subscriptions",
  "statusCode": 201,
  "duration": 245,
  "userAgent": "Mozilla/5.0...",
  "ip": "192.168.1.100",
  "request": {
    "body": {
      "productId": "64f5c8e5a1b2c3d4e5f67890",
      "planId": "64f5c8e5a1b2c3d4e5f67891"
    }
  },
  "response": {
    "subscriptionId": "sub_1234567890"
  }
}
```

這個 API 設計提供了完整的訂閱管理功能，包含安全性、錯誤處理、監控等各個面向，為前端應用和第三方整合提供了穩定可靠的介面。
