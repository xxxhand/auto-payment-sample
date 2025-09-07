# Phase 4.2 業務服務實作計劃

## 🎯 目標

將目前基於模擬數據的控制器轉換為具有實際業務邏輯和數據庫操作的完整實作。

## 📋 實作範圍

### 優先級一：核心業務服務增強

#### 1. CustomerService 重新實作
- [x] **基礎架構**: 重新添加 CustomerRepository 依賴
- [ ] **客戶管理**: CRUD 操作實作
- [ ] **標籤管理**: addTag, removeTag, getCustomerTags
- [ ] **搜尋篩選**: searchCustomers, getCustomersByStatus
- [ ] **支付方式**: 關聯支付方式管理

#### 2. SubscriptionService 核心方法實作
- [x] **基礎修復**: 修復 CustomerRepository 依賴
- [ ] **方案變更**: planChange 實作
- [ ] **暫停恢復**: pauseSubscription, resumeSubscription
- [ ] **狀態查詢**: getSubscriptionsByStatus
- [ ] **計費計算**: calculateProration

#### 3. PaymentService 增強
- [ ] **重試機制**: retryPayment 實作
- [ ] **查詢功能**: getSubscriptionPayments
- [ ] **狀態管理**: updatePaymentStatus

#### 4. ProductService 完整實作
- [ ] **產品管理**: getProducts, getProduct
- [ ] **方案管理**: getProductPlans
- [ ] **升級選項**: getUpgradeOptions

#### 5. PromotionService 完整實作
- [ ] **優惠驗證**: validatePromotion
- [ ] **優惠查詢**: getAvailablePromotions
- [ ] **優惠應用**: applyPromotion

#### 6. RefundService 完整實作
- [ ] **退款申請**: requestRefund
- [ ] **狀態查詢**: getRefundStatus
- [ ] **歷史查詢**: getSubscriptionRefunds

#### 7. AccountService 增強
- [ ] **帳戶管理**: 完善帳戶相關操作
- [ ] **支付方式**: 完善支付方式管理
- [ ] **安全機制**: 增加安全檢查

### 優先級二：資料庫操作層

#### Repository 層完善
- [x] **CustomerRepository**: 重新添加並完善
- [ ] **ProductRepository**: 新增產品數據操作
- [ ] **PromotionRepository**: 新增優惠數據操作
- [ ] **RefundRepository**: 新增退款數據操作

#### 實體和模型
- [ ] **Product 實體**: 產品相關實體定義
- [ ] **Promotion 實體**: 優惠相關實體定義
- [ ] **Refund 實體**: 退款相關實體定義

## 🚀 實作策略

### 階段一：基礎設施修復 (今天)
1. **重新添加 CustomerService 和 Repository**
2. **修復 SubscriptionService 依賴**
3. **確保所有測試仍然通過**

### 階段二：核心業務邏輯 (接下來 2-3 天)
1. **從模擬數據遷移至真實業務邏輯**
2. **實作核心服務方法**
3. **保持 API 合約不變**

### 階段三：擴展功能 (後續)
1. **實作高級功能**
2. **優化性能**
3. **增加業務規則驗證**

## ⚡ 實作原則

1. **測試驅動**: 確保所有 E2E 測試持續通過
2. **漸進式替換**: 逐步將模擬邏輯替換為真實實作
3. **向後兼容**: 保持 API 接口不變
4. **業務邏輯優先**: 專注於業務邏輯實作，數據庫暫時使用 Repository 抽象層

## 📅 今日目標

- [x] 移除不需要的控制器
- [ ] 重新實作 CustomerService 和 CustomerRepository
- [ ] 修復 SubscriptionService 依賴
- [ ] 確保所有測試通過
- [ ] 開始核心業務邏輯實作

**Phase 4.2 開始！** 🚀
