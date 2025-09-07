# Phase 4 開發計劃 - 整合與測試

## 🎯 Phase 4 目標

基於Phase 3完成的API層實作，Phase 4將專注於三個核心目標：

1. **API整合測試**: 完整的E2E測試覆蓋主要業務流程
2. **業務服務實作**: 連接實際的資料庫操作，替換模擬數據
3. **支付閘道整合**: 整合Stripe、PayPal和綠界支付服務

## 📊 當前狀態分析

### ✅ Phase 3 完成狀況
- **API控制器**: 8個控制器，24個端點
- **模擬數據**: 所有端點都有完整的模擬響應
- **代碼品質**: 100% 編譯、格式化、風格檢查通過
- **架構完整性**: 統一的錯誤處理和響應格式

### 🔍 現有測試結構分析
```
test/
├── __helpers__/
│   ├── app.helper.ts          # 應用測試輔助工具
│   ├── mongo.helper.ts        # MongoDB測試輔助  
│   └── e2e-global-setup.ts    # 全域測試設定
├── __upload-files__/          # 測試檔案資源
├── app.e2e-spec.ts           # 應用基本測試
├── get-v1-examples.e2e-spec.ts    # GET API測試範例
├── post-v1-examples.e2e-spec.ts   # POST API測試範例
├── post-v1-examples-upload.e2e-spec.ts  # 檔案上傳測試
└── jest-e2e.json             # E2E測試配置
```

### 🔧 現有業務服務狀況
- **CustomerService**: 已有基本CRUD實作
- **SubscriptionService**: 已有部分業務邏輯
- **PaymentService**: 基本支付流程實作
- **BillingService**: 帳單處理邏輯

## 🚀 Phase 4 實作規劃

### 📝 第一階段：API整合測試 (1-2週)

#### 1.1 測試基礎設施建立
- ✅ 擴展`AppHelper`支援新的控制器測試
- ✅ 建立通用的測試工具函數
- ✅ 配置測試數據庫環境

#### 1.2 核心業務流程E2E測試
```typescript
// 規劃的測試檔案結構
test/
├── customers.e2e-spec.ts         # 客戶管理測試
├── subscriptions.e2e-spec.ts     # 訂閱管理測試
├── payments.e2e-spec.ts          # 支付處理測試
├── billing.e2e-spec.ts           # 帳單處理測試
├── products.e2e-spec.ts          # 產品查詢測試
├── promotions.e2e-spec.ts        # 優惠管理測試
├── refunds.e2e-spec.ts           # 退款處理測試
├── account.e2e-spec.ts           # 帳戶管理測試
└── workflows/
    ├── subscription-lifecycle.e2e-spec.ts  # 訂閱完整生命週期
    ├── payment-retry.e2e-spec.ts           # 支付重試流程
    └── plan-change.e2e-spec.ts             # 方案變更流程
```

#### 1.3 主要測試場景
1. **訂閱生命週期測試**
   ```typescript
   describe('Subscription Lifecycle', () => {
     test('Complete subscription workflow', async () => {
       // 1. 創建客戶
       // 2. 查詢產品和方案
       // 3. 驗證優惠碼
       // 4. 創建訂閱
       // 5. 啟用訂閱
       // 6. 方案變更
       // 7. 暫停/恢復
       // 8. 取消訂閱
     });
   });
   ```

2. **支付處理測試**
   ```typescript
   describe('Payment Processing', () => {
     test('Payment success flow', async () => {
       // 支付成功流程
     });
     
     test('Payment failure and retry', async () => {
       // 支付失敗重試流程
     });
   });
   ```

3. **錯誤處理測試**
   - 無效請求參數
   - 資源不存在
   - 業務規則違反
   - 系統錯誤處理

### 🗄️ 第二階段：業務服務實作 (2-3週)

#### 2.1 資料庫操作完善

**CustomerService增強**
```typescript
// 目前已有基礎實作，需要擴展：
- 客戶標籤管理 (addTag, removeTag)
- 客戶搜尋和篩選
- 客戶狀態管理
- 支付方式關聯
```

**SubscriptionService實作**
```typescript
// 需要實作的核心方法：
- planChange(subscriptionId, targetPlanId, options)
- pauseSubscription(subscriptionId, resumeDate?)
- resumeSubscription(subscriptionId)
- getSubscriptionsByStatus(status, pagination)
- calculateProration(currentPlan, targetPlan, periodInfo)
```

**PaymentService增強**
```typescript
// 需要實作：
- retryPayment(paymentId, newPaymentMethodId?)
- getSubscriptionPayments(subscriptionId, filters)
- updatePaymentStatus(paymentId, status, metadata)
```

**新增服務**
```typescript
// ProductService - 產品和方案管理
class ProductService {
  async getProducts(includeInactive: boolean)
  async getProduct(productId: string)
  async getProductPlans(productId: string)
}

// PromotionService - 優惠管理
class PromotionService {
  async validatePromotion(code, productId, planId)
  async getAvailablePromotions(productId?, planId?)
  async applyPromotion(subscriptionId, promotionCode)
}

// RefundService - 退款管理
class RefundService {
  async requestRefund(subscriptionId, paymentId, options)
  async getRefundStatus(refundId)
  async getSubscriptionRefunds(subscriptionId)
}
```

#### 2.2 資料庫Schema擴展
```typescript
// 需要新增的Collection/Schema
- Products
- BillingPlans
- Promotions
- Refunds
- PaymentMethods
- UserAccounts
```

### 💳 第三階段：支付閘道整合 (2-3週)

#### 3.1 支付抽象層設計
```typescript
// 支付閘道抽象介面
interface IPaymentGateway {
  getName(): string;
  createPayment(amount: number, currency: string, options: PaymentOptions): Promise<PaymentResult>;
  retryPayment(paymentId: string, options?: RetryOptions): Promise<PaymentResult>;
  refundPayment(paymentId: string, amount?: number): Promise<RefundResult>;
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
}
```

#### 3.2 支付閘道實作

**3.2.1 Stripe整合**
```typescript
class StripeGateway implements IPaymentGateway {
  // Stripe API 整合
  // - 支付意圖創建
  // - 支付確認
  // - Webhook處理
  // - 退款處理
}
```

**3.2.2 PayPal整合**
```typescript
class PayPalGateway implements IPaymentGateway {
  // PayPal API 整合
  // - 支付訂單創建
  // - 支付執行
  // - 訂閱管理
  // - 退款處理
}
```

**3.2.3 綠界(ECPay)整合**
```typescript
class ECPayGateway implements IPaymentGateway {
  // 綠界 API 整合
  // - 信用卡支付
  // - ATM轉帳
  // - 便利商店代碼
  // - 定期定額扣款
}

// 綠界特有功能
interface IECPayGateway extends IPaymentGateway {
  // 信用卡定期定額
  createPeriodPayment(options: PeriodPaymentOptions): Promise<PeriodPaymentResult>;
  
  // ATM虛擬帳號
  createATMPayment(options: ATMPaymentOptions): Promise<ATMPaymentResult>;
  
  // 便利商店代碼
  createCVSPayment(options: CVSPaymentOptions): Promise<CVSPaymentResult>;
  
  // 查詢交易
  queryTradeInfo(merchantTradeNo: string): Promise<TradeInfo>;
}
```

#### 3.3 支付策略管理
```typescript
class PaymentGatewayManager {
  private gateways: Map<string, IPaymentGateway> = new Map();
  
  // 註冊支付閘道
  registerGateway(name: string, gateway: IPaymentGateway);
  
  // 選擇合適的支付閘道
  selectGateway(paymentMethodType: string, amount: number, currency: string): IPaymentGateway;
  
  // 處理支付
  async processPayment(gatewayName: string, paymentData: PaymentData): Promise<PaymentResult>;
}
```

#### 3.4 Mock支付閘道
```typescript
class MockPaymentGateway implements IPaymentGateway {
  // 用於測試的Mock實作
  // - 模擬成功/失敗場景
  // - 延時處理
  // - 狀態轉換
}
```

## 🛠️ 實作優先順序

### 第一批 (高優先級)
1. **客戶管理E2E測試** - 基礎功能驗證
2. **訂閱流程E2E測試** - 核心業務驗證  
3. **CustomerService完善** - 基礎資料操作
4. **SubscriptionService核心方法** - 訂閱業務邏輯

### 第二批 (中優先級)  
1. **支付處理E2E測試** - 支付流程驗證
2. **ProductService/PromotionService** - 產品和優惠服務
3. **Mock支付閘道** - 測試支援
4. **PaymentService增強** - 支付業務完善

### 第三批 (標準優先級)
1. **退款和帳戶管理測試** - 擴展功能驗證
2. **RefundService實作** - 退款業務邏輯
3. **真實支付閘道整合** - 生產環境準備
4. **綠界特殊功能** - 本土化支援

## 📅 時程規劃

| 階段 | 工作項目 | 預估時間 | 里程碑 |
|------|---------|---------|--------|
| 4.1 | E2E測試基礎建設 | 3-4天 | 測試框架完成 |
| 4.1 | 核心API測試實作 | 7-10天 | 主要流程測試覆蓋 |
| 4.2 | 業務服務完善 | 10-12天 | 資料庫操作實作 |
| 4.2 | 資料Schema擴展 | 3-4天 | 資料結構完善 |
| 4.3 | 支付抽象層設計 | 2-3天 | 介面設計完成 |
| 4.3 | Mock支付閘道 | 3-4天 | 測試支援完成 |
| 4.3 | 真實閘道整合 | 8-10天 | 生產環境就緒 |

**總預估時間**: 6-8週

## 🔍 成功指標

### 測試覆蓋率
- **API端點覆蓋**: 100% (24/24)
- **業務流程覆蓋**: 90%+ 主要場景
- **錯誤處理覆蓋**: 80%+ 異常場景

### 功能完整性
- **業務服務**: 完全替換模擬數據
- **資料持久化**: 完整的CRUD操作
- **支付整合**: 3個主要支付閘道

### 品質保證
- **所有測試通過**: E2E + 單元測試
- **代碼覆蓋率**: 80%+
- **性能基準**: API響應時間 < 500ms

## 🎯 Phase 4 交付成果

1. **完整的E2E測試套件** (15+ 測試檔案)
2. **實作完整的業務服務層** (6個核心服務)
3. **支付閘道整合框架** (3個支付提供商)
4. **完善的資料庫Schema** (支援所有業務場景)
5. **生產就緒的系統** (可部署運行)

Phase 4完成後，系統將具備完整的生產環境運行能力！
