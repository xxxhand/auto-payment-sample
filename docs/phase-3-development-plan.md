# Phase 3 開發計劃：API 層開發 (修正版)

## 階段目標
基於現有 NestJS 架構和 Phase 2 完善的業務服務層，在 `src/controllers/` 目錄下開發完整的 RESTful API 控制器。

## 現有架構分析

### 控制器架構
- **目錄位置**：`src/controllers/`
- **版本控制**：使用 `@Controller({ path: 'resource', version: '1' })` 
- **回應格式**：使用 `CustomResult` 統一格式
- **參考範例**：`exemple.controller.ts`

### 統一回應格式 (參考 subscription-api.md)
```typescript
interface IResponse<T = any> {
  traceId: string;    // 請求追蹤 ID  
  code: number;       // 業務狀態碼 (200: 成功, 其他: 錯誤)
  message: string;    // 回應訊息
  result?: T;         // 回應資料 (成功時)
}
```

### 現有服務依賴
- **CommonService**：提供 `newResultInstance()` 方法
- **LoggerService**：統一日誌記錄
- **業務服務層**：Phase 2 完成的 `CustomerService`, `SubscriptionService`, `PaymentService`, `BillingService`

## 核心目標

### 🎯 目標 1：實現核心業務 API 控制器
- **客戶管理控制器** (`customers.controller.ts`)
- **訂閱管理控制器** (`subscriptions.controller.ts`) 
- **支付管理控制器** (`payments.controller.ts`)
- **計費管理控制器** (`billing.controller.ts`)

### 🎯 目標 2：定義 DTO 和驗證
- **請求 DTO** - 使用 `class-validator` 進行驗證
- **響應轉換** - 實體到 DTO 的映射
- **分頁查詢** - 支持分頁和排序參數

### 🎯 目標 3：集成業務服務層
- **依賴注入** - 注入 Phase 2 業務服務
- **錯誤處理** - 使用 `ErrException` 統一錯誤格式
- **業務邏輯調用** - 控制器專注於 HTTP 層邏輯

## 技術實施方案

### 目錄結構 (基於現有架構)
```
src/
├── controllers/
│   ├── exemple.controller.ts        # 現有範例 (保持不變)
│   ├── customers.controller.ts      # 新增：客戶管理
│   ├── subscriptions.controller.ts  # 新增：訂閱管理  
│   ├── payments.controller.ts       # 新增：支付管理
│   └── billing.controller.ts        # 新增：計費管理
├── domain/
│   ├── entities/                    # Phase 1 完成
│   ├── services/                    # Phase 2 完成
│   └── value-objects/               # DTO 定義擴展
│       ├── create-example.request.ts  # 現有
│       ├── create-customer.request.ts # 新增
│       ├── create-subscription.request.ts # 新增
│       └── ...
```

### API 端點設計 (基於現有版本策略)

#### 客戶管理 API (`/api/v1/customers`)
```typescript
@Controller({
  path: 'customers',
  version: '1',
})
export class CustomersController {
  // POST /api/v1/customers
  // GET /api/v1/customers/:id  
  // PUT /api/v1/customers/:id
  // DELETE /api/v1/customers/:id
  // GET /api/v1/customers (分頁查詢)
  // POST /api/v1/customers/:id/tags
}
```

#### 訂閱管理 API (`/api/v1/subscriptions`)  
```typescript
@Controller({
  path: 'subscriptions',
  version: '1', 
})
export class SubscriptionsController {
  // POST /api/v1/subscriptions
  // GET /api/v1/subscriptions/:id
  // PUT /api/v1/subscriptions/:id
  // POST /api/v1/subscriptions/:id/activate
  // POST /api/v1/subscriptions/:id/pause
  // POST /api/v1/subscriptions/:id/cancel
}
```

#### 支付管理 API (`/api/v1/payments`)
```typescript  
@Controller({
  path: 'payments',
  version: '1',
})
export class PaymentsController {
  // POST /api/v1/payments
  // GET /api/v1/payments/:id
  // POST /api/v1/payments/:id/retry
  // POST /api/v1/payments/:id/refund
  // GET /api/v1/payments/statistics
}
```

#### 計費管理 API (`/api/v1/billing`)
```typescript
@Controller({
  path: 'billing', 
  version: '1',
})
export class BillingController {
  // POST /api/v1/billing/process
  // POST /api/v1/billing/retry
  // GET /api/v1/billing/subscription/:id/status
  // POST /api/v1/billing/batch-process
}
```

## 開發計劃

### 第一階段：客戶管理 API (預計 0.5天)
1. **創建 CustomersController** - 基本 CRUD 操作
2. **定義請求 DTO** - 客戶創建、更新的驗證邏輯
3. **集成 CustomerService** - 調用業務邏輯層
4. **錯誤處理** - 統一異常處理和響應格式

### 第二階段：訂閱管理 API (預計 0.5天)
1. **創建 SubscriptionsController** - 訂閱生命週期管理
2. **狀態操作端點** - 啟用、暫停、取消等操作
3. **關聯查詢** - 客戶訂閱關聯查詢
4. **集成 SubscriptionService** - 業務邏輯調用

### 第三階段：支付管理 API (預計 0.5天)  
1. **創建 PaymentsController** - 支付記錄管理
2. **支付操作端點** - 重試、退款等操作
3. **統計查詢端點** - 支付統計和報表
4. **集成 PaymentService** - 支付業務邏輯

### 第四階段：計費管理 API (預計 0.5天)
1. **創建 BillingController** - 計費處理管理
2. **批量操作端點** - 批量計費和重試
3. **狀態檢查端點** - 計費狀態查詢
4. **集成 BillingService** - 計費業務邏輯

### 第五階段：模組集成與測試 (預計 0.5天)
1. **模組註冊** - 在 `app.module.ts` 中註冊所有控制器
2. **依賴注入配置** - 確保服務正確注入
3. **E2E 測試** - 編寫 API 端點測試
4. **文檔更新** - 更新 API 文檔

## 實施細節

### 控制器基礎模板
```typescript
import { Controller, Post, Get, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { CommonService, LoggerService } from '@myapp/common';
import { CustomResult } from '@xxxhand/app-common';

@Controller({
  path: 'resource',
  version: '1',
})
export class ResourceController {
  private readonly _Logger: LoggerService;
  
  constructor(
    private readonly cmmService: CommonService,
    private readonly resourceService: ResourceService,
  ) {
    this._Logger = this.cmmService.getDefaultLogger(ResourceController.name);
  }
  
  @Post()
  public async create(@Body() body: CreateResourceRequest): Promise<CustomResult> {
    this._Logger.log(`Creating resource: ${JSON.stringify(body)}`);
    const result = await this.resourceService.createResource(body);
    return this.cmmService.newResultInstance().withResult(result);
  }
}
```

### DTO 驗證模板
```typescript
import { IsString, IsNotEmpty, IsOptional, IsEmail } from 'class-validator';

export class CreateResourceRequest {
  @IsString()
  @IsNotEmpty()
  name: string;
  
  @IsEmail()
  @IsOptional() 
  email?: string;
}
```

### 錯誤處理策略
- 使用現有 `ErrException` 和 `errConstants`
- 業務邏輯錯誤由服務層拋出，控制器捕獲並轉換
- HTTP 狀態碼遵循 RESTful 標準

## 成功標準

### 功能完整性
- ✅ 所有 Phase 2 業務服務都有對應的 API 端點
- ✅ 支持完整的 CRUD 操作和業務操作
- ✅ 提供分頁查詢和統計功能
- ✅ 實現狀態管理相關端點

### 技術品質  
- ✅ 遵循現有架構和編碼規範
- ✅ 通過 TypeScript 編譯檢查
- ✅ 使用統一的響應格式和錯誤處理
- ✅ 完整的請求參數驗證

### 可維護性
- ✅ 清晰的控制器職責分離
- ✅ 良好的錯誤提示信息
- ✅ 一致的 API 設計模式
- ✅ 完整的日誌記錄

---

**預計完成時間：** 2.5天  
**依賴項目：** Phase 2 業務服務層 ✅  
**交付成果：** 完整的 RESTful API 控制器 + 統一響應格式
