# 自動扣款機器人系統 (Subscription Billing Robot)

## Description

這是一個靈活且可擴展的自動扣款機器人系統，專為處理複雜的訂閱制商品計費場景而設計。系統支援多樣化的計費週期、智能優惠管理、失敗重試機制，以及無縫的方案轉換功能。

### 主要特色
- 🔄 **彈性計費週期**：支援月扣、年扣、自定義週期
- 🎯 **智能優惠系統**：階段式優惠、優惠碼、促銷期管理
- 🛡️ **智能重試機制**：產品層級配置，支援寬限期延長
- 🔄 **方案轉換**：支援即時或下期生效的方案變更
- 📊 **完整審計**：所有操作都有完整的歷史記錄
- 🎛️ **高度配置化**：業務邏輯可透過配置調整，無需修改程式碼

## Concept

### 核心設計理念

#### 1. 分層架構
```
用戶層 → 訂閱管理層 → 計費規則引擎 → 優惠計算引擎 → 扣款執行層 → 支付閘道
```

#### 2. 關鍵設計原則
- **狀態分離**：訂閱狀態、交易狀態、退款狀態獨立管理
- **時間分離**：下次扣款時間與服務到期時間分開追蹤
- **配置化**：重試策略、優惠規則、轉換規則均可配置
- **事件驅動**：採用事件驅動架構，便於擴展和整合
- **向後相容**：在現有表結構基礎上擴展，最小化既有系統影響

#### 3. 智能重試策略
- **分類處理**：可重試、延後重試、不可重試三種失敗類型
- **產品配置**：每個產品可定義專屬的重試策略
- **寬限期管理**：支援延長服務時間，給用戶處理支付問題的緩衝期
- **次數控制**：重試次數和寬限期延長次數都有上限控制

#### 4. 優惠系統架構
- **多層優惠**：支援基礎優惠、階段優惠、優惠碼、促銷期優惠的組合
- **時序控制**：可設定第N期免費、第N期折扣等時序性優惠
- **條件判斷**：基於用戶資格、時間窗口、使用次數的動態優惠計算

## Diagrams

### Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    %% 基礎實體 (現有表結構擴充)
    AccountModel {
        ObjectId _id PK
        string email
        string name
        string password
        string domain
        string backupEmail
        boolean valid
        number confirmEmailAt
        ObjectId avatarId
        number purchaseExpiresAt
        ObjectId defaultPaymentMethodId "新增"
        string accountStatus "新增：ACTIVE|FROZEN|RISK"
    }

    ProductModel {
        ObjectId _id PK
        string productName
        object title
        object description
        number originalPrice
        number firstPrice
        number salePrice
        number period
        string periodUnit
        string productType
        string platform
        string googleProductId
        string appleProductId
        string officialProductId
        boolean basic
        number promoDiscount
        number promoPeriod
        number promoExpiresAt
        string promoGoogleCode
        string promoAppleCode
        number maxRetryAttempts "新增：預設3"
        number maxGraceExtensions "新增：預設2"
        number graceExtensionDays "新增：預設3"
        array retryIntervals "新增：[1,6,24,72]小時"
        array allowedPlanConversions "新增"
    }

    PurchaseHistoryModel {
        ObjectId _id PK
        ObjectId accountId FK
        ObjectId productId FK
        string productType
        string receiptId
        number startTime
        number endTime
        number cancelTime
        string store
        string receiptData
        string eventType
        string originalReceiptId
        ObjectId subscriptionId FK "新增：關聯訂閱"
        number actualAmount "新增"
        number originalAmount "新增"
        number discountAmount "新增"
        string transactionStatus "新增：PENDING|COMPLETED|FAILED|REFUNDED|CANCELLED"
        string failureReason "新增"
        number billingCycleNumber "新增：第幾期"
        ObjectId billingPlanId FK "新增"
    }

    %% 核心新增實體
    SubscriptionModel {
        ObjectId _id PK
        string subscriptionId UK
        ObjectId accountId FK
        ObjectId productId FK
        ObjectId currentPlanId FK
        string status "ACTIVE|PAUSED|CANCELLED|EXPIRED|PENDING"
        number subscriptionStartDate
        number nextBillingDate
        number serviceEndDate
        number billingCycleCount
        number gracePeriodExtensions
        number retryCount
        number lastBillingDate
        number cancelledAt
        string cancellationReason
        ObjectId pendingPlanChangeId FK
    }

    BillingPlanModel {
        ObjectId _id PK
        string planName
        ObjectId productId FK
        string cycleType "MONTHLY|YEARLY|CUSTOM"
        number cycleDays
        number planPrice
        boolean isActive
        object conversionRules
    }

    RefundModel {
        ObjectId _id PK
        string refundId UK
        ObjectId subscriptionId FK
        ObjectId originalTransactionId FK
        number refundAmount
        string refundReason
        string refundType "FULL|PARTIAL|PRORATION"
        number processedAt
        string status "PENDING|COMPLETED|FAILED|CANCELLED"
        ObjectId refundPaymentMethodId FK
        string externalRefundId
    }

    PromotionModel {
        ObjectId _id PK
        string promotionName
        string promotionType "STAGED_DISCOUNT|PROMO_CODE|SEASONAL_PROMOTION|FIRST_TIME_FREE"
        array applicableProductIds
        number startDate
        number endDate
        object promotionConfig
        string promoCode
        number usageLimit
        number usedCount
        boolean isActive
    }

    SubscriptionPromotionModel {
        ObjectId _id PK
        ObjectId subscriptionId FK
        ObjectId promotionId FK
        number appliedCycleNumber
        string status "PENDING|ACTIVE|EXPIRED|CANCELLED"
        number discountAmount
        number appliedAt
    }

    PaymentRetryLogModel {
        ObjectId _id PK
        ObjectId subscriptionId FK
        ObjectId purchaseHistoryId FK
        number retryAttempt
        number retryTime
        string failureReason
        string failureCategory "RETRIABLE|DELAYED_RETRY|NON_RETRIABLE"
        number nextRetryTime
        boolean gracePeriodExtended
        string retryResult "PENDING|SUCCESS|FAILED|SKIPPED"
    }

    PlanChangeHistoryModel {
        ObjectId _id PK
        ObjectId subscriptionId FK
        ObjectId fromPlanId FK
        ObjectId toPlanId FK
        string changeType "IMMEDIATE|NEXT_CYCLE"
        number requestedAt
        number effectiveAt
        number priceDifference
        string status "PENDING|COMPLETED|CANCELLED|FAILED"
        string changeReason
    }

    PaymentMethodModel {
        ObjectId _id PK
        ObjectId accountId FK
        string paymentType "CREDIT_CARD|DEBIT_CARD|BANK_ACCOUNT|DIGITAL_WALLET"
        string displayName
        string paymentToken
        boolean isDefault
        number expiresAt
        string status "ACTIVE|EXPIRED|INVALID|SUSPENDED"
    }

    %% 關聯關係
    AccountModel ||--o{ SubscriptionModel : "1對多"
    AccountModel ||--o{ PaymentMethodModel : "1對多"
    AccountModel ||--o{ PurchaseHistoryModel : "1對多"
    
    ProductModel ||--o{ SubscriptionModel : "1對多"
    ProductModel ||--o{ BillingPlanModel : "1對多"
    ProductModel ||--o{ PromotionModel : "1對多"
    ProductModel ||--o{ PurchaseHistoryModel : "1對多"
    
    BillingPlanModel ||--o{ SubscriptionModel : "1對多"
    BillingPlanModel ||--o{ PurchaseHistoryModel : "1對多"
    BillingPlanModel ||--o{ PlanChangeHistoryModel : "1對多-from"
    BillingPlanModel ||--o{ PlanChangeHistoryModel : "1對多-to"
    
    SubscriptionModel ||--o{ PurchaseHistoryModel : "1對多"
    SubscriptionModel ||--o{ RefundModel : "1對多"
    SubscriptionModel ||--o{ PaymentRetryLogModel : "1對多"
    SubscriptionModel ||--o{ PlanChangeHistoryModel : "1對多"
    SubscriptionModel ||--o{ SubscriptionPromotionModel : "1對多"
    
    PromotionModel ||--o{ SubscriptionPromotionModel : "1對多"
    
    PurchaseHistoryModel ||--o{ RefundModel : "1對多"
    PurchaseHistoryModel ||--o{ PaymentRetryLogModel : "1對多"
    
    PaymentMethodModel ||--o{ RefundModel : "1對多"
```

### Activity Flow - 自動扣款流程

```mermaid
flowchart TD
    A[定時任務掃描到期訂閱] --> B[檢查訂閱狀態]
    B --> C{訂閱是否有效?}
    C -->|否| Z[跳過處理]
    C -->|是| D[獲取計費方案]
    
    D --> E[計算本期應付金額]
    E --> F[套用優惠計算]
    F --> G[執行扣款]
    
    G --> H{扣款是否成功?}
    H -->|成功| I[更新訂閱狀態]
    I --> J[記錄交易成功]
    J --> K[計算下期扣款時間]
    K --> L[發送成功通知]
    
    H -->|失敗| M[分析失敗原因]
    M --> N{失敗類型判斷}
    
    N -->|不可重試| O[標記訂閱失效]
    O --> P[發送失敗通知]
    
    N -->|可重試| Q{是否超過重試上限?}
    Q -->|是| R{是否可延長寬限期?}
    R -->|否| O
    R -->|是| S[延長寬限期]
    S --> T[安排下次重試]
    
    Q -->|否| U[增加重試計數]
    U --> V[安排下次重試時間]
    V --> W[記錄重試日誌]
    
    N -->|延後重試| X{是否可延長寬限期?}
    X -->|是| S
    X -->|否| Y[安排延後重試]
    Y --> W
    
    T --> AA[重試流程結束]
    W --> AA
    L --> AA
    P --> AA
```

### Activity Flow - 方案轉換流程

```mermaid
flowchart TD
    A[用戶請求方案轉換] --> B[驗證轉換資格]
    B --> C{轉換是否被允許?}
    C -->|否| D[返回錯誤訊息]
    C -->|是| E[檢查目標方案]
    
    E --> F[計算價格差異]
    F --> G{轉換類型?}
    
    G -->|立即生效| H[執行立即轉換]
    H --> I[處理價格差額]
    I --> J{差額處理}
    J -->|需退費| K[創建退款記錄]
    J -->|需補款| L[執行補款]
    J -->|無差額| M[更新訂閱方案]
    
    K --> M
    L --> N{補款是否成功?}
    N -->|失敗| O[轉換失敗，維持原方案]
    N -->|成功| M
    
    G -->|下期生效| P[設定待變更方案]
    P --> Q[更新 pendingPlanChangeId]
    
    M --> R[記錄方案變更歷史]
    Q --> R
    R --> S[發送確認通知]
    
    O --> T[發送失敗通知]
    D --> T
    S --> U[流程結束]
    T --> U
```

### Activity Flow - 優惠計算引擎

```mermaid
flowchart TD
    A[開始計算扣款金額] --> B[獲取基礎價格]
    B --> C[檢查階段式優惠]
    C --> D{當前週期有階段優惠?}
    D -->|是| E[套用階段優惠]
    D -->|否| F[檢查優惠碼]
    
    E --> F
    F --> G{用戶有使用優惠碼?}
    G -->|是| H[驗證優惠碼有效性]
    H --> I{優惠碼是否有效?}
    I -->|是| J[套用優惠碼折扣]
    I -->|否| K[檢查促銷期優惠]
    G -->|否| K
    
    J --> K
    K --> L{當前時間在促銷期內?}
    L -->|是| M[套用促銷優惠]
    L -->|否| N[計算最終金額]
    
    M --> O[檢查優惠組合規則]
    O --> P{優惠是否可疊加?}
    P -->|是| N
    P -->|否| Q[選擇最優惠的方案]
    Q --> N
    
    N --> R[驗證最低收費限制]
    R --> S[返回最終計費金額]
```

### Activity Flow - 智能重試機制

```mermaid
flowchart TD
    A[扣款失敗] --> B[記錄失敗原因]
    B --> C[分析失敗類型]
    C --> D{失敗原因分類}
    
    D -->|網路錯誤/暫時性問題| E[標記為可重試]
    D -->|餘額不足/卡片過期| F[標記為延後重試]
    D -->|卡片停用/詐欺風險| G[標記為不可重試]
    
    G --> H[標記訂閱為失效]
    H --> I[發送最終失敗通知]
    
    E --> J{是否超過重試上限?}
    F --> K{是否超過重試上限?}
    
    J -->|是| L{是否可延長寬限期?}
    K -->|是| L
    
    L -->|否| H
    L -->|是| M[延長寬限期]
    M --> N[增加延長計數]
    N --> O[重置重試計數]
    
    J -->|否| P[增加重試計數]
    K -->|否| Q[增加重試計數]
    
    P --> R[計算下次重試時間-短間隔]
    Q --> S[計算下次重試時間-長間隔]
    
    R --> T[創建重試記錄]
    S --> T
    O --> U[創建重試記錄-新週期]
    
    T --> V[安排重試任務]
    U --> V
    V --> W[發送重試通知]
    
    I --> X[流程結束]
    W --> X
```

### System Architecture Overview

```mermaid
graph TB
    subgraph "用戶介面層"
        UI[Web/Mobile Interface]
        API[REST API]
    end
    
    subgraph "業務邏輯層"
        SM[訂閱管理服務]
        PE[優惠計算引擎]
        RE[重試引擎]
        CM[週期管理器]
        PM[方案管理器]
    end
    
    subgraph "數據層"
        DB[(MongoDB Database)]
        CACHE[(Redis Cache)]
    end
    
    subgraph "外部服務"
        PAY[支付閘道]
        NOTIFY[通知服務]
        SCHEDULER[定時任務]
    end
    
    UI --> API
    API --> SM
    SM --> PE
    SM --> RE
    SM --> CM
    SM --> PM
    
    PE --> DB
    RE --> DB
    CM --> DB
    PM --> DB
    
    SM --> CACHE
    
    RE --> PAY
    SM --> NOTIFY
    SCHEDULER --> SM
    
    PAY -.-> RE
    NOTIFY -.-> UI
```

### Project Structure (專案結構)

這是一個典型的 NestJS 專案結構，採用了 Monorepo (單一程式碼庫) 的模式，並融入了部分領域驅動設計 (DDD) 的概念。

```mermaid
graph TD
    subgraph "專案根目錄 (auto-payment-sample)"
        A["/"]
    end

    subgraph "主要應用程式 (src)"
        B["src/"]
    end

    subgraph "共用函式庫 (libs)"
        C["libs/"]
    end

    subgraph "測試 (test)"
        D["test/"]
    end

    subgraph "靜態資源 (resources)"
        E["resources/"]
    end
    
    subgraph "設定檔 & 工具"
        F["package.json"]
        G["docker-compose.yml"]
        H["nest-cli.json"]
        I["tsconfig.json"]
    end

    A --> B
    A --> C
    A --> D
    A --> E
    A --> F & G & H & I

    B --> B1["main.ts (應用程式進入點)"]
    B --> B2["app.module.ts (根模組)"]
    B --> B3["app-components/ (全域元件)"]
    B --> B4["controllers/ (API 控制器)"]
    B --> B5["domain/ (核心領域層)"]
    B --> B6["infra/ (基礎設施層)"]

    C --> C1["common/ (通用函式庫)"]
    C --> C2["conf/ (設定檔管理庫)"]

    D --> D1["*.e2e-spec.ts (端對端測試)"]
    D --> D2["__helpers__/ (測試輔助工具)"]

    E --> E1["langs/ (多國語言檔)"]
```

#### 資料夾作用說明

以下是每個主要資料夾和其中關鍵檔案的職責說明：

##### 根目錄 (`/`)

這是專案的基礎，包含設定檔和工具腳本。

*   `package.json`: 定義專案的依賴套件和可執行的腳本 (如 `start`, `build`, `test`)。
*   `nest-cli.json`: NestJS 命令列工具的設定檔。這裡面定義了這是一個 "monorepo" 專案，並管理 `libs` 裡的函式庫。
*   `tsconfig.json`: TypeScript 的主要設定檔。
*   `docker-compose.yml` & `Dockerfile`: 用於建立和管理 Docker 容器，方便部署和建立一致的開發環境。
*   `jest-*.json`/`.ts`: 測試框架 Jest 的設定檔。

##### `src/` - 主要應用程式

這是應用程式的核心程式碼所在。

*   `main.ts`: **應用程式的進入點**。它會建立 NestJS 應用程式實例並啟動伺服器。
*   `app.module.ts`: 應用程式的**根模組**，它負責組織和串連所有的控制器、服務和模組。
*   `app-components/`: 存放應用程式級別的共用元件，例如：
    *   `app-exception.filter.ts`: 全域的例外錯誤處理器。
    *   `app-tracer.middleware.ts`: 用於追蹤請求的 Middleware (中介層)。
*   `controllers/`: 存放 API 的**控制器 (Controller)**。每個控制器負責處理特定的路由請求，例如 `exemple.controller.ts`。
*   `domain/`: **核心領域層**。這是業務邏輯的核心，與框架和基礎設施無關。
    *   `entities/`: 定義業務實體，代表核心的業務物件 (例如 `Example`)。
    *   `value-objects/`: 定義值物件，用於描述事物的屬性 (例如 `CreateExampleRequest`)。
*   `infra/`: **基礎設施層**。負責與外部系統互動，例如資料庫。
    *   `models/`: 定義資料庫的 Schema 或 Model，通常與特定 ORM (如 Mongoose, TypeORM) 相關。
    *   `repositories/`: **倉儲模式**的實作。它封裝了資料庫的操作邏輯，提供一個清晰的介面給 `domain` 層使用，將業務邏輯與資料庫存取分離。

##### `libs/` - 共用函式庫

在 Monorepo 架構下，這裡存放可以被多個應用程式或函式庫共用的程式碼。

*   `common/`: 一個通用的函式庫，可能包含：
    *   `default-logger.service.ts`: 自訂的日誌服務。
    *   `err.code.ts`, `err.const.ts`: 統一的錯誤碼和常數定義。
    *   `async-local-storage.provider.ts`: 用於在非同步操作中傳遞上下文 (例如追蹤 ID)。
*   `conf/`: 專門用來管理和提供設定檔的函式庫。

##### `test/` - 端對端測試 (E2E)

存放端對端測試案例。這些測試會模擬真實的使用者請求，從 API 入口一路測試到資料庫，確保整個系統流程的正確性。

*   `*.e2e-spec.ts`: 具體的測試案例檔案。
*   `__helpers__/`: 存放測試時會用到的輔助工具，例如啟動測試用的 App 或操作資料庫。

##### `resources/` - 靜態資源

存放非程式碼的靜態檔案。

*   `langs/`: 存放多國語言的翻譯檔案 (i18n)，例如 `dev.json`, `zh-tw.json`。

## 核心業務流程說明

### 1. 訂閱創建流程
1. 用戶選擇產品和計費方案
2. 系統創建 SubscriptionModel 記錄
3. 執行首次扣款
4. 根據計費週期設定下次扣款時間
5. 套用首購優惠（如有）

### 2. 定期扣款流程
1. 定時任務掃描 `nextBillingDate` 到期的訂閱
2. 優惠計算引擎計算本期應付金額
3. 執行扣款並記錄到 PurchaseHistoryModel
4. 扣款成功：更新訂閱狀態，計算下期時間
5. 扣款失敗：觸發智能重試機制

### 3. 智能重試流程
1. 根據失敗原因分類處理策略
2. 檢查產品配置的重試上限
3. 計算重試間隔時間
4. 必要時延長寬限期（serviceEndDate）
5. 記錄完整的重試歷史

### 4. 方案轉換流程
1. 驗證轉換規則和用戶資格
2. 計算價格差異
3. 選擇轉換時機（立即/下期）
4. 處理差額退費或補款
5. 更新訂閱配置並記錄歷史

## 技術特點

- **MongoDB** 作為主要數據存儲
- **TypeScript** + **Typegoose** 提供類型安全
- **事件驅動架構** 支援系統解耦和擴展
- **配置化設計** 支援業務規則的動態調整
- **完整審計** 確保金流操作的可追溯性